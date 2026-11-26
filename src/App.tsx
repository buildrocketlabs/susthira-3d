import { Suspense, lazy, useEffect } from 'react'
import { useStore } from './store'
import { detectQuality } from './quality'
import { Interface } from './ui/Interface'
import { Closing } from './ui/Closing'
import { Fallback } from './ui/Fallback'

const Stage = lazy(() => import('./scene/Stage'))
const FlatView = lazy(() => import('./ui/FlatView'))
const ARSheet = lazy(() => import('./ui/ARSheet'))

const INTRO_MIN_MS = 3600 // the dedication stays on screen at least this long
const BAKE = new URLSearchParams(location.search).has('bake')
const NO_INTRO = BAKE || new URLSearchParams(location.search).has('nointro')

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

/** Drives the opening screen that index.html painted before any script ran. */
function useIntro() {
  const ready = useStore((s) => s.ready)
  const progress = useStore((s) => s.progress)
  const webgl = useStore((s) => s.webgl)
  useEffect(() => {
    const bar = document.getElementById('intro-bar')
    if (bar) bar.style.transform = `scaleX(${Math.max(0.04, ready ? 1 : progress)})`
  }, [progress, ready])

  useEffect(() => {
    const intro = document.getElementById('intro')
    if (!intro) return
    const dismiss = (phase: 'intro' | 'hero') => {
      intro.classList.add('out')
      setTimeout(() => intro.remove(), 1300)
      if (useStore.getState().phase === 'loading') useStore.setState({ phase })
    }
    if (webgl === 'none') { const t = setTimeout(() => dismiss('hero'), 2600); return () => clearTimeout(t) }
    if (!ready) {
      // a tap before the scene is ready is remembered: go straight to the bottle
      const early = () => { intro.dataset.skip = '1' }
      intro.addEventListener('pointerdown', early)
      return () => intro.removeEventListener('pointerdown', early)
    }
    if (NO_INTRO || intro.dataset.skip) { dismiss('hero'); return }
    const wait = Math.max(0, INTRO_MIN_MS - performance.now())
    const t = setTimeout(() => dismiss('intro'), wait)
    const skip = () => { clearTimeout(t); dismiss('hero') }
    intro.addEventListener('pointerdown', skip)
    return () => { clearTimeout(t); intro.removeEventListener('pointerdown', skip) }
  }, [ready, webgl])
}

export default function App() {
  const webgl = useStore((s) => s.webgl)
  const overlay = useStore((s) => s.overlay)
  const post = useStore((s) => s.quality.post)
  useIntro()

  useEffect(() => {
    if (!hasWebGL()) { useStore.setState({ webgl: 'none', phase: 'hero' }); return }
    useStore.setState({ progress: 0.3 })
  }, [])

  // Refine the device tier from the GPU benchmark tables once the bottle is on
  // screen and the browser is idle. It can only lower quality: the first guess
  // already gives phones the mid tier and desktops the high tier.
  const phase = useStore((s) => s.phase)
  useEffect(() => {
    if (phase !== 'hero' || webgl !== 'ok') return
    const run = () => {
      const first = useStore.getState().quality
      detectQuality(first).then((q) => {
        const order = { low: 0, mid: 1, high: 2 }
        if (order[q.tier] < order[first.tier]) useStore.setState({ quality: q })
      })
    }
    const t = setTimeout(run, 2500)
    return () => clearTimeout(t)
  }, [phase, webgl])

  // Escape closes whatever is open
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const s = useStore.getState()
      if (s.overlay) s.set({ overlay: null }); else if (s.hotspot) s.openHotspot(null)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <>
      {webgl !== 'none' && <Suspense fallback={null}><Stage /></Suspense>}
      {webgl !== 'ok' && <Fallback />}
      {webgl === 'ok' && !post && <div className="vignette" aria-hidden="true" />}
      <Interface />
      {overlay === 'flat' && <Suspense fallback={null}><FlatView /></Suspense>}
      {overlay === 'ar' && <Suspense fallback={<div className="sheet-wrap" />}><ARSheet /></Suspense>}
      <Closing />
    </>
  )
}
