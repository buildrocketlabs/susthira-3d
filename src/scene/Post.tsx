/**
 * Post processing for capable GPUs only (lazy loaded). Kept light: ambient
 * occlusion at half resolution, SMAA, a very gentle vignette, and the same
 * Khronos PBR Neutral tone mapping the plain renderer uses, so label colours
 * match across device tiers. No bloom, no flares, no chromatic aberration.
 */
import { EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export default function Post() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO halfRes aoRadius={1.6} distanceFalloff={1} intensity={1.6} aoSamples={8} denoiseSamples={4} denoiseRadius={8} quality="medium" />
      <SMAA />
      <Vignette offset={0.28} darkness={0.42} eskil={false} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
