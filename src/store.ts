/** Global interface state. The 3D rig subscribes to it without re-rendering React. */
import { create } from 'zustand'
import type { ProductKey, SceneKey } from './config'
import { guessQuality, type Quality } from './quality'

export type Phase = 'loading' | 'intro' | 'hero'
export type View = 'single' | 'range'
export type Overlay = null | 'flat' | 'closing' | 'ar'
export interface Insets { top: number; right: number; bottom: number; left: number }

interface State {
  phase: Phase
  /** scene has rendered its first frames and can be revealed */
  ready: boolean
  /** 0..1 download progress of what the first frame needs */
  progress: number
  webgl: 'ok' | 'none' | 'lost'
  product: ProductKey
  view: View
  scene: SceneKey
  hotspot: string | null
  overlay: Overlay
  /** 1 = default framing; above 1.25 the hotspot dots step back */
  zoomed: boolean
  quality: Quality
  insets: Insets
  hintSeen: boolean
  canvasKey: number
  set: (p: Partial<State>) => void
  setProduct: (p: ProductKey) => void
  setView: (v: View) => void
  setScene: (s: SceneKey) => void
  openHotspot: (k: string | null) => void
  skipIntro: () => void
  markHintSeen: () => void
}

const HINT_KEY = 'susthira.hint'
const hintSeen = (() => { try { return localStorage.getItem(HINT_KEY) === '1' } catch { return false } })()

export const tick = () => { try { navigator.vibrate?.(8) } catch { /* not supported */ } }

export const useStore = create<State>((set, get) => ({
  phase: 'loading',
  ready: false,
  progress: 0,
  webgl: 'ok',
  product: 'banana',
  view: 'single',
  scene: 'studio',
  hotspot: null,
  overlay: null,
  zoomed: false,
  quality: guessQuality(),
  insets: { top: 72, right: 0, bottom: 200, left: 0 },
  hintSeen,
  canvasKey: 0,
  set: (p) => set(p),
  setProduct: (product) => {
    const s = get()
    if (s.product === product && s.view === 'single') return
    tick()
    set({ product, view: 'single', hotspot: null })
  },
  setView: (view) => { if (get().view !== view) { tick(); set({ view, hotspot: null }) } },
  setScene: (scene) => { if (get().scene !== scene) { tick(); set({ scene, hotspot: null }) } },
  openHotspot: (hotspot) => set({ hotspot }),
  skipIntro: () => { if (get().phase !== 'hero') set({ phase: 'hero' }) },
  markHintSeen: () => {
    if (get().hintSeen) return
    try { localStorage.setItem(HINT_KEY, '1') } catch { /* private mode */ }
    set({ hintSeen: true })
  },
}))
