/**
 * Still photographs of the same bottles, shown when WebGL is unavailable or the
 * graphics context has been lost. These are the composited renders from
 * assets/renders, so the label artwork is identical.
 */
import { productOf } from '../config'
import { useStore } from '../store'

export function Fallback() {
  const product = useStore((s) => s.product)
  const view = useStore((s) => s.view)
  const src = view === 'range' ? '/fallback/range.webp' : `/fallback/${product}.webp`
  return (
    <div className="fallback">
      <img key={src} src={src} alt={view === 'range' ? 'The three Susthira bottles' : `${productOf(product).name} bottle`} />
    </div>
  )
}
