/**
 * Adaptive pixel ratio. The canvas renders on demand (nothing is drawn while the
 * bottle is still, which keeps a phone cool), so drei's PerformanceMonitor, which
 * assumes a continuous loop, would misread idle time as a slow device. This
 * governor only measures runs of consecutive frames.
 *
 *   slow  (under about 45 fps for half a second): lower the pixel ratio a step;
 *         at the floor, switch post processing off and drop to the next tier.
 *   fast  (comfortably 60 fps for a few seconds): climb back one step, once.
 */
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store'
import { qualityFor } from '../quality'

export function Governor() {
  const setDpr = useThree((s) => s.setDpr)
  const st = useRef({ last: 0, slow: 0, fast: 0, dpr: 0, climbed: false, settle: 0 })
  useFrame(() => {
    const s = st.current
    const q = useStore.getState().quality
    if (!s.dpr) s.dpr = q.dprStart
    const now = performance.now()
    const dt = now - s.last
    s.last = now
    if (dt > 120) { s.slow = s.fast = 0; return } // first frame after idling
    if (useStore.getState().phase === 'loading' || now < s.settle) return // shader compiles and uploads are not a fair sample
    if (dt > 23) { s.slow++; s.fast = 0 } else if (dt < 14) { s.fast++; s.slow = Math.max(0, s.slow - 1) } else { s.fast = 0 }
    if (s.slow > 24) {
      s.slow = 0
      s.settle = now + 900
      if (s.dpr > q.dprMin + 0.05) {
        s.dpr = Math.max(q.dprMin, s.dpr * 0.82)
        setDpr(s.dpr)
      } else if (q.post) {
        useStore.setState({ quality: { ...q, post: false } }) // remounts the canvas without the effect chain
      } else if (q.physical) {
        useStore.setState({ quality: { ...qualityFor('low', q.mobile), ktx2: q.ktx2 } })
      }
    } else if (s.fast > 240 && !s.climbed && s.dpr < q.dprMax - 0.05) {
      s.climbed = true; s.fast = 0
      s.dpr = Math.min(q.dprMax, s.dpr / 0.82)
      setDpr(s.dpr)
    }
  })
  return null
}
