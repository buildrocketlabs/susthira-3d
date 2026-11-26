/**
 * Device tiering. Decides texture format, pixel ratio ceiling, shadows and post
 * processing before the first frame; the governor in scene/Governor.tsx then
 * adapts at run time if the frame rate says the guess was too optimistic.
 *
 *   high : desktop class GPU or flagship phone. Post processing on.
 *   mid  : the target device (Redmi Note, Galaxy A). Native MSAA, no post.
 *   low  : weak GPU or little memory. 2048 WebP labels, simpler materials.
 *
 * Override for testing with ?q=low | mid | high.
 */
import { getGPUTier } from 'detect-gpu'

export type Tier = 'low' | 'mid' | 'high'
export interface Quality {
  tier: Tier
  mobile: boolean
  dprMax: number
  /** starting pixel ratio; the governor may climb to dprMax or drop to dprMin */
  dprStart: number
  dprMin: number
  post: boolean
  ktx2: boolean
  physical: boolean
  softShadows: boolean
}

export function qualityFor(tier: Tier, mobile: boolean): Quality {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  return {
    tier,
    mobile,
    dprMax: Math.min(dpr, tier === 'low' ? 1.5 : 2),
    dprStart: Math.min(dpr, tier === 'low' ? 1.25 : mobile && tier === 'mid' ? 1.75 : 2),
    dprMin: Math.min(dpr, 1),
    post: tier === 'high',
    ktx2: tier !== 'low',
    physical: tier !== 'low',
    softShadows: tier !== 'low',
  }
}

const isMobileUA = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))

/** Fast synchronous guess used for the very first render. */
export function guessQuality(): Quality {
  const mobile = isMobileUA()
  const forced = new URLSearchParams(location.search).get('q') as Tier | null
  if (forced === 'low' || forced === 'mid' || forced === 'high') return qualityFor(forced, mobile)
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency || 4
  if ((mem !== undefined && mem <= 2) || cores <= 2) return qualityFor('low', mobile)
  return qualityFor(mobile ? 'mid' : 'high', mobile)
}

/** Slower benchmark lookup (self hosted tables in /benchmarks). Never throws. */
export async function detectQuality(initial: Quality): Promise<Quality> {
  if (new URLSearchParams(location.search).get('q')) return initial
  try {
    const r = await Promise.race([
      getGPUTier({ benchmarksURL: '/benchmarks' }),
      new Promise<null>((res) => setTimeout(() => res(null), 2500)),
    ])
    if (!r) return initial
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    let tier: Tier = r.tier >= 3 ? 'high' : r.tier === 2 ? 'mid' : 'low'
    // software renderers and blocklisted GPUs report tier 0 or 1
    if (mem !== undefined && mem <= 2) tier = 'low'
    // a phone only earns post processing with a top tier GPU and enough memory
    if (r.isMobile && tier === 'high' && mem !== undefined && mem < 6) tier = 'mid'
    // detect-gpu knows nothing about an unlisted GPU: keep the first guess
    if (r.type === 'FALLBACK') return initial
    return qualityFor(tier, !!r.isMobile || initial.mobile)
  } catch {
    return initial
  }
}
