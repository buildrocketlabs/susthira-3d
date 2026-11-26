/**
 * Camera, turntable, gestures and the opening sequence.
 *
 * Gestures (pointer events on the canvas, touch-action: none):
 *   one finger, sideways   turn the bottle, with inertia
 *   one finger, up or down tilt the camera a little (never under the floor, never
 *                          over the top); when zoomed in it slides along the bottle
 *   two fingers            pinch to zoom
 *   double tap             zoom into the tapped spot (it turns to face you);
 *                          double tap again to zoom back out
 *   mouse wheel, arrows    desktop equivalents
 */
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three'
import { HOTSPOTS, PRODUCTS, type ProductKey } from '../config'
import { useStore } from '../store'
import { BODY_R, LABEL_H, LABEL_R, LABEL_Y0, thetaOfU, yawForU } from '../bottle/geometry'
import { loadFull, loadPreview } from '../bottle/textures'
import { HOME_TILT, PIVOT_Y, RANGE_YAW, SCENE_LOOK, ZOOM_MAX, clamp, easeInOut, easeOut, nearestAngle, rig, smooth } from './rigState'
import { hotspotEls } from '../ui/hotspotEls'

/* framing constants, centimetres */
const SINGLE = { dist: 78, halfW: 5.2, pivotZ: 0 }
const RANGE = { dist: 116, halfW: 14.6, pivotZ: -2.4 }
const CONTENT_H = 25.4
export const SIDE_SLOT = { x: 9.5, z: -5 }
const SIDE_HIDDEN = { x: 0, z: -10.6 }

/* opening sequence, seconds */
const YAW_RAO = yawForU(0.33)
const INTRO = { yawStart: YAW_RAO + 1.15, toRao: 2.5, hold: 3.7, toFront: 5.5, lights: 1.9 }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const v3 = new Vector3()
const ndc = new Vector2()
const raycaster = new Raycaster()

/** Lens and principal point so the content sits centred in the area the UI leaves free. */
export function framing(w: number, h: number, rangeT: number) {
  const { insets } = useStore.getState()
  const freeW = Math.max(120, w - insets.left - insets.right)
  const freeH = Math.max(120, h - insets.top - insets.bottom)
  const dist = lerp(SINGLE.dist, RANGE.dist, rangeT)
  const halfW = lerp(SINGLE.halfW, RANGE.halfW, rangeT)
  const tanH = Math.max(((CONTENT_H * 1.1) / (2 * dist)) * (h / freeH), ((halfW * 1.06) / dist) * (h / freeW))
  return {
    dist,
    tanH,
    pivotZ: lerp(SINGLE.pivotZ, RANGE.pivotZ, rangeT),
    cx: insets.left + freeW / 2 - w / 2,
    cy: insets.top + freeH / 2 - h / 2,
  }
}

export function lockedTilt(camHeight: number, dist: number) { return Math.asin((camHeight - PIVOT_Y) / dist) }

export function Rig() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const introT = useRef(0)
  const frames = useRef(0)
  const pending = useRef<ProductKey | null>(null)
  const rangeGoal = useRef(0)
  const reduced = useRef(typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    rig.invalidate = invalidate
    rig.reveal = 0
    if (useStore.getState().phase === 'hero') {
      // canvas rebuilt after a lost context: come back as the visitor left it
      rig.yawVel = 0; rig.swap = null; rig.shown = useStore.getState().product
      rig.zoom = rig.zoomGoal = 1
    } else {
      rig.yaw = INTRO.yawStart
      rig.tilt = 0.2
      rig.zoom = rig.zoomGoal = 0.84
    }
    rig.wake(1500)
  }, [invalidate])

  /* ---- react to interface state ---- */
  useEffect(() => {
    const resetCamera = () => { rig.zoomGoal = 1; rig.focusGoal.set(0, PIVOT_Y, 0) }
    const applyScene = () => {
      const look = SCENE_LOOK[useStore.getState().scene]
      rig.tiltGoal = look.camHeight === null ? clamp(rig.tiltGoal, Math.max(look.tiltMin, 0.03), look.tiltMax) : lockedTilt(look.camHeight, SINGLE.dist)
      if (look.camHeight === null && Math.abs(rig.tiltGoal) < 0.03) rig.tiltGoal = HOME_TILT
    }
    const unsub = useStore.subscribe((s, p) => {
      if (s.product !== p.product) {
        loadPreview(s.product).then(() => { pending.current = useStore.getState().product; rig.wake() })
      }
      if (s.view !== p.view) {
        rangeGoal.current = s.view === 'range' ? 1 : 0
        rig.yawVel = 0
        rig.yawGoal = nearestAngle(s.view === 'range' ? RANGE_YAW : 0, rig.yaw)
        resetCamera()
        if (s.view === 'range' && SCENE_LOOK[s.scene].camHeight === null) rig.tiltGoal = HOME_TILT
        if (s.view === 'range') PRODUCTS.forEach((pr) => loadPreview(pr.key).then(() => loadFull(pr.key)))
      }
      if (s.scene !== p.scene) { applyScene(); resetCamera() }
      if (s.hotspot !== p.hotspot) {
        const h = HOTSPOTS.find((x) => x.key === s.hotspot)
        if (h) {
          rig.yawVel = 0
          rig.yawGoal = nearestAngle(yawForU(h.focusU), rig.yaw)
          rig.zoomGoal = h.zoom
          rig.focusGoal.set(0, LABEL_Y0 + LABEL_H * (1 - h.focusV), BODY_R)
          if (SCENE_LOOK[s.scene].camHeight === null) rig.tiltGoal = HOME_TILT
        } else if (p.hotspot) resetCamera()
      }
      if (s.phase !== p.phase && s.phase === 'hero') {
        // skipped or finished: settle on the front
        rig.yawGoal = nearestAngle(0, rig.yaw)
        rig.zoomGoal = 1
        applyScene()
        loadFull(s.product)
        PRODUCTS.forEach((pr) => loadPreview(pr.key))
      }
      if (s.insets !== p.insets || s.overlay !== p.overlay) rig.wake(300)
      rig.wake()
    })
    return unsub
  }, [])

  /* ---- gestures ---- */
  useEffect(() => {
    const el = gl.domElement
    const pts = new Map<number, { x: number; y: number }>()
    let moved = 0
    let downAt = 0
    let lastTap = { t: 0, x: 0, y: 0 }
    let pinch0 = 0, zoom0 = 1, midY0 = 0
    let lastMoveT = 0

    const interactive = () => useStore.getState().phase === 'hero' && !useStore.getState().overlay
    const tiltLimits = () => SCENE_LOOK[useStore.getState().scene]

    const hitTest = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect()
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      const cam = rig.camera!
      raycaster.setFromCamera(ndc, cam)
      const o = raycaster.ray.origin, d = raycaster.ray.direction
      let best: { k: ProductKey; t: number; p: Vector3 } | null = null
      for (const pr of PRODUCTS) {
        const b = rig.bottles[pr.key]
        if (!b || !b.group.visible) continue
        const ox = o.x - b.group.position.x, oz = o.z - b.group.position.z
        const a = d.x * d.x + d.z * d.z
        const bb = 2 * (ox * d.x + oz * d.z)
        const c = ox * ox + oz * oz - LABEL_R * LABEL_R
        const disc = bb * bb - 4 * a * c
        if (disc < 0) continue
        const t = (-bb - Math.sqrt(disc)) / (2 * a)
        const y = o.y + d.y * t
        if (t <= 0 || y < 0 || y > 25) continue
        if (!best || t < best.t) best = { k: pr.key, t, p: new Vector3(ox + d.x * t, y, oz + d.z * t) }
      }
      return best
    }

    const doubleTap = (x: number, y: number) => {
      const s = useStore.getState()
      const hit = hitTest(x, y)
      if (s.view === 'range') { if (hit) s.setProduct(hit.k); return }
      if (rig.zoomGoal > 1.2) {
        if (s.hotspot) s.openHotspot(null)
        rig.zoomGoal = 1; rig.focusGoal.set(0, PIVOT_Y, 0)
      } else if (hit) {
        if (s.hotspot) s.openHotspot(null)
        rig.yawVel = 0
        rig.yawGoal = rig.yaw - Math.atan2(hit.p.x, hit.p.z)
        rig.zoomGoal = 2.6
        rig.focusGoal.set(0, clamp(hit.p.y, 3, 23), BODY_R)
      } else {
        rig.zoomGoal = 2; rig.focusGoal.set(0, PIVOT_Y, 0)
      }
      rig.wake()
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const s = useStore.getState()
      if (s.phase !== 'hero') { if (s.ready) s.skipIntro(); return }
      if (!interactive()) return
      el.setPointerCapture?.(e.pointerId)
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pts.size === 1) { moved = 0; downAt = e.timeStamp; rig.dragging = true; rig.yawVel = 0; if (!rig.swap) rig.yawGoal = null; lastMoveT = e.timeStamp }
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = rig.zoomGoal; midY0 = (a.y + b.y) / 2
        moved = 99
      }
      rig.wake()
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX; p.y = e.clientY
      const s = useStore.getState()
      if (pts.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy)
        if (moved < 6) return
        if (!s.hintSeen) s.markHintSeen()
        if (s.hotspot && moved > 24) s.openHotspot(null)
        const dt = Math.max(1, e.timeStamp - lastMoveT) / 1000
        lastMoveT = e.timeStamp
        if (!rig.swap) {
          // the surface of the bottle follows the finger
          const dyaw = (dx * rig.cmPerPx) / BODY_R
          rig.yaw += dyaw
          rig.yawVel = lerp(rig.yawVel, dyaw / dt, 0.35)
        }
        if (rig.zoomGoal > 1.15) {
          const y = clamp(rig.focusGoal.y + dy * rig.cmPerPx, 2, 23.5)
          rig.focusGoal.y = y; rig.focus.y = lerp(rig.focus.y, y, 0.6)
        } else {
          const lim = tiltLimits()
          rig.tiltGoal = clamp(rig.tiltGoal + dy * 0.0042, lim.camHeight === null ? lim.tiltMin : rig.tiltGoal, lim.camHeight === null ? lim.tiltMax : rig.tiltGoal)
        }
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const max = s.view === 'range' ? 3 : ZOOM_MAX
        rig.zoomGoal = clamp(zoom0 * (d / Math.max(1, pinch0)), 1, max)
        rig.zoom = lerp(rig.zoom, rig.zoomGoal, 0.5)
        const midY = (a.y + b.y) / 2
        if (rig.zoomGoal > 1.15) rig.focusGoal.y = clamp(rig.focusGoal.y + (midY - midY0) * rig.cmPerPx, 2, 23.5)
        midY0 = midY
        if (rig.zoomGoal <= 1.02) rig.focusGoal.set(0, PIVOT_Y, 0)
        if (!s.hintSeen) s.markHintSeen()
      }
      rig.wake()
    }
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return
      pts.delete(e.pointerId)
      if (pts.size === 0) {
        rig.dragging = false
        if (e.timeStamp - lastMoveT > 90) rig.yawVel = 0 // finger rested before lifting: no fling
        rig.yawVel = clamp(rig.yawVel, -9, 9)
        if (moved < 8 && e.timeStamp - downAt < 320 && e.type === 'pointerup') {
          const near = Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 36
          if (e.timeStamp - lastTap.t < 340 && near) { doubleTap(e.clientX, e.clientY); lastTap.t = 0 }
          else {
            lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY }
            const s = useStore.getState()
            if (s.hotspot) s.openHotspot(null)
          }
        }
      }
      rig.wake(1600)
    }
    const wheel = (e: WheelEvent) => {
      if (!interactive()) return
      e.preventDefault()
      const max = useStore.getState().view === 'range' ? 3 : ZOOM_MAX
      rig.zoomGoal = clamp(rig.zoomGoal * Math.exp(-e.deltaY * 0.0016), 1, max)
      if (rig.zoomGoal <= 1.02) rig.focusGoal.set(0, PIVOT_Y, 0)
      rig.wake()
    }
    const key = (e: KeyboardEvent) => {
      if (!interactive() || rig.swap) return
      if (e.key === 'ArrowLeft') { rig.yawGoal = (rig.yawGoal ?? rig.yaw) - 0.5; rig.wake() }
      if (e.key === 'ArrowRight') { rig.yawGoal = (rig.yawGoal ?? rig.yaw) + 0.5; rig.wake() }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('keydown', key)
    }
  }, [gl])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = useStore.getState()
    const cam = state.camera as PerspectiveCamera
    rig.camera = cam
    const { width: w, height: h } = state.size
    let moving = false

    /* ---- opening sequence ---- */
    if (s.phase === 'loading') {
      frames.current++
      if (!s.ready && frames.current > 4 && rig.bottles.banana?.labelMat.map) useStore.setState({ ready: true })
      rig.wake(300)
    } else if (s.phase === 'intro') {
      if (reduced.current) { rig.yaw = 0; rig.reveal = 1; rig.zoom = 1; rig.tilt = HOME_TILT; useStore.setState({ phase: 'hero' }) }
      else {
        introT.current += dt
        const t = introT.current
        rig.reveal = smooth(t / INTRO.lights)
        if (t < INTRO.hold) rig.yaw = lerp(INTRO.yawStart, YAW_RAO, easeOut(t / INTRO.toRao))
        else rig.yaw = lerp(YAW_RAO, 0, easeInOut((t - INTRO.hold) / (INTRO.toFront - INTRO.hold)))
        rig.zoom = rig.zoomGoal = lerp(0.84, 1, easeInOut(t / INTRO.toFront))
        rig.tilt = rig.tiltGoal = lerp(0.2, HOME_TILT, easeInOut(t / (INTRO.toFront - 0.6)))
        if (t >= INTRO.toFront) { rig.yaw = 0; rig.yawGoal = null; useStore.setState({ phase: 'hero' }) }
        moving = true
      }
    } else {
      if (rig.reveal < 1) { rig.reveal = Math.min(1, rig.reveal + dt * 2.2); moving = true }
    }

    /* ---- product swap: one quick turn with the labels cross fading ---- */
    if (pending.current && !rig.swap && rig.rangeT < 0.02) {
      const to = pending.current
      pending.current = null
      if (to !== rig.shown && rig.bottles[to]) {
        const two = Math.PI * 2
        rig.swap = { from: rig.shown, to, t: 0, yaw0: rig.yaw, yaw1: two * Math.floor((rig.yaw - Math.PI * 1.1) / two) }
        rig.yawVel = 0; rig.yawGoal = null
        if (reduced.current) rig.swap.t = 0.99
      }
    }
    if (rig.swap) {
      const sw = rig.swap
      sw.t += dt / 0.95
      rig.yaw = lerp(sw.yaw0, sw.yaw1, easeInOut(sw.t))
      if (sw.t >= 1) {
        rig.yaw = sw.yaw1 % (Math.PI * 2)
        rig.shown = sw.to
        rig.swap = null
        if (s.phase === 'hero') loadFull(rig.shown)
      }
      moving = true
    } else if (s.phase === 'hero') {
      /* ---- turntable ---- */
      if (rig.yawGoal !== null && !rig.dragging) {
        const d = rig.yawGoal - rig.yaw
        rig.yaw += d * (1 - Math.exp(-dt * 5))
        if (Math.abs(d) < 0.0008) { rig.yaw = rig.yawGoal; rig.yawGoal = null } else moving = true
      } else if (!rig.dragging && Math.abs(rig.yawVel) > 0.004) {
        rig.yaw += rig.yawVel * dt
        rig.yawVel *= Math.exp(-dt * 3.2)
        moving = true
      }
    }

    /* ---- whole range layout ---- */
    const rGoal = rig.swap || pending.current ? 0 : rangeGoal.current
    if (Math.abs(rGoal - rig.rangeT) > 0.0005) {
      rig.rangeT = clamp(rig.rangeT + Math.sign(rGoal - rig.rangeT) * dt / 0.85, 0, 1)
      moving = true
    }
    const rT = easeInOut(rig.rangeT)

    /* ---- camera smoothing ---- */
    if (s.phase === 'hero') {
      const k = 1 - Math.exp(-dt * 6.5)
      const dz = rig.zoomGoal - rig.zoom, dtl = rig.tiltGoal - rig.tilt
      rig.zoom += dz * k; rig.tilt += dtl * k
      const df = rig.focus.distanceTo(rig.focusGoal)
      rig.focus.lerp(rig.focusGoal, k)
      if (Math.abs(dz) > 0.002 || Math.abs(dtl) > 0.0006 || df > 0.01) moving = true
      const zoomed = rig.zoomGoal > 1.25
      if (zoomed !== s.zoomed) useStore.setState({ zoomed })
    }

    const f = framing(w, h, rT)
    const tanH = f.tanH / rig.zoom
    const fov = (Math.atan(tanH) * 2 * 180) / Math.PI
    const view = cam.view
    if (Math.abs(cam.fov - fov) > 1e-4 || !view || !view.enabled || view.fullWidth !== w || view.fullHeight !== h || Math.abs(view.offsetX + f.cx) > 0.01 || Math.abs(view.offsetY + f.cy) > 0.01) {
      cam.fov = fov
      cam.aspect = w / h
      cam.near = 8; cam.far = 4000
      cam.setViewOffset(w, h, -f.cx, -f.cy, w, h)
    }
    cam.position.set(0, PIVOT_Y + f.dist * Math.sin(rig.tilt), f.pivotZ + f.dist * Math.cos(rig.tilt))
    v3.set(rig.focus.x, rig.focus.y, rig.focus.z + f.pivotZ)
    cam.lookAt(v3)
    cam.updateMatrixWorld()
    rig.cmPerPx = (2 * f.dist * tanH) / h

    /* ---- bottles ---- */
    const sw = rig.swap
    let side = 0
    for (const pr of PRODUCTS) {
      const b = rig.bottles[pr.key]
      if (!b) continue
      const g = b.group
      const isCentre = pr.key === rig.shown || (sw !== null && pr.key === sw.to)
      let opacity = 1
      if (isCentre) {
        g.position.set(0, 0, 0)
        g.visible = sw ? (pr.key === sw.from ? sw.t < 0.62 : sw.t > 0.38) : true
        if (sw && pr.key === sw.to) opacity = smooth((sw.t - 0.4) / 0.2)
      } else {
        const dir = side++ === 0 ? -1 : 1
        g.visible = rig.rangeT > 0.004
        g.position.set(lerp(SIDE_HIDDEN.x, SIDE_SLOT.x * dir, rT), 0, lerp(SIDE_HIDDEN.z, SIDE_SLOT.z, rT))
      }
      g.rotation.y = rig.yaw
      const m = b.labelMat
      const fading = opacity < 1
      if (m.transparent !== fading) { m.transparent = fading; m.needsUpdate = true }
      m.opacity = opacity
      b.label.renderOrder = fading ? 2 : 0
    }

    /* ---- hotspot dots follow the label ---- */
    const dotsOn = s.phase === 'hero' && !sw && rig.rangeT < 0.02 && !s.overlay && rig.zoom < 1.3 && rig.zoomGoal < 1.3
    for (const hs of HOTSPOTS) {
      const el = hotspotEls[hs.key]
      if (!el) continue
      const th = thetaOfU(hs.u) + rig.yaw
      const sn = Math.sin(th), cs = Math.cos(th)
      const y = LABEL_Y0 + LABEL_H * (1 - hs.v)
      v3.set(LABEL_R * sn, y, LABEL_R * cs)
      const toCam = Math.atan2(cam.position.x - v3.x, cam.position.z - v3.z)
      const facing = Math.cos(th - toCam)
      v3.project(cam)
      const vis = dotsOn ? smooth((facing - 0.32) / 0.25) : 0
      el.style.transform = `translate3d(${((v3.x * 0.5 + 0.5) * w).toFixed(1)}px,${((-v3.y * 0.5 + 0.5) * h).toFixed(1)}px,0)`
      el.style.opacity = vis.toFixed(3)
      el.style.pointerEvents = vis > 0.6 ? 'auto' : 'none'
    }

    if (moving || rig.dragging || performance.now() < rig.busyUntil) state.invalidate()
  }, -1)

  return null
}
