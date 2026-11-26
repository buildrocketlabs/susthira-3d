/**
 * "See it on your table". Lazy loaded: Google's model-viewer only downloads when
 * the sheet is opened. The GLB is true to size (a 25 cm bottle) with the label
 * baked in; see scripts/build-glb.ts.
 */
import { createElement, useEffect, useRef, useState } from 'react'
import '@google/model-viewer'
import { COPY, productOf } from '../config'
import { useStore } from '../store'
import { Icon } from './Interface'

export default function ARSheet() {
  const product = useStore((s) => s.product)
  const set = useStore((s) => s.set)
  const ref = useRef<HTMLElement & { canActivateAR?: boolean; activateAR?: () => void }>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unsupported'>('loading')
  const p = productOf(product)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setState('loading')
    const onLoad = () => setState(el.canActivateAR ? 'ready' : 'unsupported')
    el.addEventListener('load', onLoad)
    return () => el.removeEventListener('load', onLoad)
  }, [product])

  return (
    <div className="sheet-wrap" onClick={() => set({ overlay: null })}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={COPY.ar} onClick={(e) => e.stopPropagation()}>
        <button className="x" aria-label="Close" onClick={() => set({ overlay: null })}>{Icon.close}</button>
        <h2>{COPY.ar}</h2>
        <p>{p.name}, at its real size of one litre. Point the camera at a table or the floor.</p>
        {createElement('model-viewer', {
          ref,
          src: `/ar/${product}.glb`,
          alt: `${p.name} bottle`,
          ar: true,
          'ar-modes': 'scene-viewer webxr quick-look',
          'ar-scale': 'fixed',
          'ar-placement': 'floor',
          'camera-controls': true,
          'disable-pan': true,
          'interaction-prompt': 'none',
          'shadow-intensity': '0.9',
          'shadow-softness': '1',
          'environment-image': '/env/studio_small_09_384.hdr',
          exposure: '1',
          'tone-mapping': 'neutral',
          'camera-orbit': '20deg 80deg 0.72m',
          'min-camera-orbit': 'auto 40deg auto',
          'max-camera-orbit': 'auto 95deg auto',
          'field-of-view': '26deg',
          class: 'mv',
        }, createElement('span', { slot: 'ar-button' }))}
        <button
          className="cta"
          disabled={state !== 'ready'}
          onClick={() => ref.current?.activateAR?.()}
        >
          {Icon.ar}
          <span>{state === 'loading' ? 'Preparing the bottle' : state === 'ready' ? 'Place it on your table' : 'This phone cannot place it in the room'}</span>
        </button>
      </section>
    </div>
  )
}
