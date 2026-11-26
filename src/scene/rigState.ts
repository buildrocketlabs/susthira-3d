/**
 * Imperative state of the turntable and camera. Lives outside React so that a
 * drag never causes a React render. scene/Rig.tsx advances it every frame.
 *
 * Model: a photographer's turntable. The camera stays on its tripod, the bottle
 * turns on its own axis (yaw), the lights stay put, so highlights slide across
 * the label exactly as they do on a real bottle. Zoom narrows the lens instead
 * of moving the camera, which keeps the photographic back plates registered.
 */
import { Vector3, type PerspectiveCamera, type Group, type Mesh, type MeshPhysicalMaterial, type MeshStandardMaterial } from 'three'
import type { ProductKey, SceneKey } from '../config'

export interface BottleHandle {
  group: Group
  label: Mesh
  labelMat: MeshPhysicalMaterial | MeshStandardMaterial
}

export interface SceneLook {
  /** camera height above the ground in cm when the tilt is locked to a back plate */
  camHeight: number | null
  tiltMin: number
  tiltMax: number
}

export const SCENE_LOOK: Record<SceneKey, SceneLook> = {
  studio: { camHeight: null, tiltMin: -0.04, tiltMax: 0.6 },
  field: { camHeight: 15.5, tiltMin: 0, tiltMax: 0 },
  soil: { camHeight: 5.5, tiltMin: 0, tiltMax: 0 },
}

export const PIVOT_Y = 12.3
export const HOME_TILT = 0.085
export const RANGE_YAW = 0.2
export const ZOOM_MAX = 6

export const rig = {
  // turntable
  yaw: 0,
  yawVel: 0,
  yawGoal: null as number | null,
  // camera
  tilt: HOME_TILT,
  tiltGoal: HOME_TILT,
  zoom: 1,
  zoomGoal: 1,
  focus: new Vector3(0, PIVOT_Y, 0),
  focusGoal: new Vector3(0, PIVOT_Y, 0),
  /** 0 = lights down, 1 = fully lit */
  reveal: 0,
  /** 0 = single bottle, 1 = whole range */
  rangeT: 0,
  /** product whose bottle currently stands in the centre */
  shown: 'banana' as ProductKey,
  swap: null as null | { from: ProductKey; to: ProductKey; t: number; yaw0: number; yaw1: number },
  dragging: false,
  /** centimetres per CSS pixel at the bottle, for gesture scaling */
  cmPerPx: 0.05,
  bottles: {} as Partial<Record<ProductKey, BottleHandle>>,
  camera: null as PerspectiveCamera | null,
  busyUntil: 0,
  invalidate: (() => {}) as () => void,
  /** keep rendering for a while (the canvas only draws when something moves) */
  wake(ms = 700) {
    const t = performance.now() + ms
    if (t > rig.busyUntil) rig.busyUntil = t
    rig.invalidate()
  },
}

/** The equivalent of angle `a` (mod 2 pi) nearest to `ref`. */
export function nearestAngle(a: number, ref: number) {
  const two = Math.PI * 2
  return a + Math.round((ref - a) / two) * two
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const smooth = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t) }
export const easeInOut = (t: number) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3)

if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) (window as unknown as { __rig: typeof rig }).__rig = rig
