/**
 * Flat artwork: the full 250 x 120 mm label, pinch to zoom and drag to pan, so
 * the team can read every line. The image is laid out at its zoomed pixel size
 * (not CSS scaled), which keeps small text sharp at every zoom level.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { PANELS, productOf } from '../config'
import { useStore } from '../store'
import { Chips, Icon } from './Interface'

const W = 5000, H = 2400
const TOP = 150, BOTTOM = 96 // room for the tabs and the chips

export default function FlatView() {
  const product = useStore((s) => s.product)
  const set = useStore((s) => s.set)
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const names = useRef<HTMLDivElement>(null)
  const v = useRef({ s: 0.1, x: 0, y: 0 })
  const anim = useRef(0)
  const [panel, setPanel] = useState<string>('front')
  const [loaded, setLoaded] = useState(false)

  const limits = () => {
    const r = box.current!.getBoundingClientRect()
    const fit = Math.min(r.width / W, (r.height - TOP - BOTTOM) / H)
    return { r, min: fit * 0.98, max: Math.max(1.2, fit * 14) }
  }
  const apply = useCallback(() => {
    const { r, min, max } = limits()
    const t = v.current
    t.s = Math.min(max, Math.max(min, t.s))
    const w = W * t.s, h = H * t.s
    const availH = r.height - TOP - BOTTOM
    t.x = w <= r.width ? (r.width - w) / 2 : Math.min(24, Math.max(r.width - w - 24, t.x))
    t.y = h <= availH ? TOP + (availH - h) / 2 : Math.min(TOP, Math.max(r.height - BOTTOM - h, t.y))
    const el = img.current!
    el.style.width = `${w}px`; el.style.height = `${h}px`
    el.style.transform = `translate3d(${t.x}px,${t.y}px,0)`
    if (names.current) { names.current.style.width = `${w}px`; names.current.style.transform = `translate3d(${t.x}px,${Math.max(TOP - 30, t.y - 30)}px,0)` }
    // which panel is in the middle of the screen
    const u = (r.width / 2 - t.x) / w
    const p = PANELS.find((q) => u >= q.u0 && u < q.u1)
    if (p) setPanel(p.key)
  }, [])

  const goTo = useCallback((key: string, animate = true) => {
    const p = PANELS.find((q) => q.key === key)!
    const { r } = limits()
    const availH = r.height - TOP - BOTTOM
    const s = Math.min((r.width - 24) / (W * (p.u1 - p.u0)), availH / H)
    const target = { s, x: r.width / 2 - W * s * (p.u0 + p.u1) / 2, y: TOP + (availH - H * s) / 2 }
    cancelAnimationFrame(anim.current)
    if (!animate) { Object.assign(v.current, target); apply(); return }
    const from = { ...v.current }, t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 520), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
      v.current.s = from.s + (target.s - from.s) * e
      v.current.x = from.x + (target.x - from.x) * e
      v.current.y = from.y + (target.y - from.y) * e
      apply()
      if (k < 1) anim.current = requestAnimationFrame(step)
    }
    anim.current = requestAnimationFrame(step)
  }, [apply])

  useEffect(() => { goTo('front', false) }, [goTo])
  useEffect(() => {
    const on = () => apply()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [apply])

  /* gestures */
  useEffect(() => {
    const el = box.current!
    const pts = new Map<number, { x: number; y: number }>()
    let d0 = 0, lastTap = 0, moved = 0
    const zoomAt = (cx: number, cy: number, factor: number) => {
      const { min, max } = limits()
      const t = v.current
      const s = Math.min(max, Math.max(min, t.s * factor))
      const k = s / t.s
      t.x = cx - (cx - t.x) * k; t.y = cy - (cy - t.y) * k; t.s = s
      apply()
    }
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      cancelAnimationFrame(anim.current)
      el.setPointerCapture?.(e.pointerId)
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved = 0
      if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.x - b.x, a.y - b.y) }
    }
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x, dy = e.clientY - p.y
      p.x = e.clientX; p.y = e.clientY
      moved += Math.abs(dx) + Math.abs(dy)
      if (pts.size === 1) { v.current.x += dx; v.current.y += dy; apply() }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        v.current.x += dx / 2; v.current.y += dy / 2
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / Math.max(1, d0))
        d0 = d
      }
    }
    const up = (e: PointerEvent) => {
      if (!pts.delete(e.pointerId)) return
      if (pts.size === 0 && moved < 8) {
        if (e.timeStamp - lastTap < 340) {
          const { min } = limits()
          zoomAt(e.clientX, e.clientY, v.current.s > min * 3.5 ? (min / v.current.s) : 3)
          lastTap = 0
        } else lastTap = e.timeStamp
      }
    }
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.002)) }
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [apply])

  useEffect(() => { setLoaded(false) }, [product])

  return (
    <section className="flat" role="dialog" aria-modal="true" aria-label="Flat label artwork" ref={box}>
      {/* the 2048 texture shows at once; the 5000 px master replaces it when it arrives */}
      <img ref={img} className="art" src={loaded ? `/flat/${product}.webp` : `/tex/${product}_2048.webp`} alt={`${productOf(product).name} label artwork, 250 by 120 mm`} draggable={false} />
      <img src={`/flat/${product}.webp`} alt="" hidden onLoad={() => setLoaded(true)} />
      <div className="names" ref={names} aria-hidden="true">
        {PANELS.map((p) => <span key={p.key} style={{ left: `${p.u0 * 100}%`, width: `${(p.u1 - p.u0) * 100}%` }}>{p.name}</span>)}
      </div>
      <header className="flat-top">
        <div className="flat-title"><strong>Flat artwork</strong><span>250 × 120 mm, pinch to zoom</span></div>
        <button className="x" aria-label="Close" onClick={() => set({ overlay: null })}>{Icon.close}</button>
        <nav className="tabs" aria-label="Label panels">
          {PANELS.map((p) => <button key={p.key} aria-pressed={panel === p.key} onClick={() => goTo(p.key)}>{p.name}</button>)}
        </nav>
      </header>
      <footer className="flat-bottom"><Chips compact /></footer>
    </section>
  )
}
