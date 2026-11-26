/**
 * Progressive label textures.
 *
 *   1. 1024 px WebP (about 80 KB) so the bottle is on screen in the first seconds.
 *   2. Upgrade to the 4096 px KTX2 (UASTC, transcoded on a worker to the GPU's own
 *      compressed format: about 11 MB of video memory instead of 43 MB), or to the
 *      2048 px WebP on low tier devices and wherever KTX2 is unavailable.
 *
 * The label artwork is never redrawn: every texel comes from assets/labels.
 */
import {
  ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace,
  Texture, TextureLoader, type WebGLRenderer,
} from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { ProductKey } from '../config'

type Level = 0 | 1 | 2 // none, preview, full
type Listener = (tex: Texture, level: Level) => void

interface Entry { tex: Texture | null; level: Level; loading: Level; listeners: Set<Listener>; preview?: Promise<Texture>; full?: Promise<Texture | null> }

let renderer: WebGLRenderer | null = null
let ktx2: KTX2Loader | null = null
let useKtx2 = false
let maxAniso = 1
const loader = new TextureLoader()
const entries = new Map<ProductKey, Entry>()

const entry = (k: ProductKey): Entry => {
  let e = entries.get(k)
  if (!e) { e = { tex: null, level: 0, loading: 0, listeners: new Set() }; entries.set(k, e) }
  return e
}

function tune(t: Texture) {
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = ClampToEdgeWrapping
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  t.anisotropy = maxAniso
  t.needsUpdate = true
  return t
}

export function initTextures(gl: WebGLRenderer, wantKtx2: boolean) {
  // a rebuilt canvas (after a lost WebGL context) starts with an empty cache
  if (renderer && renderer !== gl) { entries.forEach((e) => { e.tex = null; e.level = 0; e.loading = 0; e.preview = e.full = undefined }); ktx2?.dispose(); ktx2 = null }
  renderer = gl
  maxAniso = gl.capabilities.getMaxAnisotropy()
  useKtx2 = wantKtx2 && gl.capabilities.isWebGL2 && gl.capabilities.maxTextureSize >= 4096 && typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined'
  if (useKtx2 && !ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(1)
    try { ktx2.detectSupport(gl) } catch { useKtx2 = false }
  }
}

function apply(e: Entry, tex: Texture, level: Level) {
  if (level <= e.level) { tex.dispose(); return }
  const old = e.tex
  // upload now, while nothing is animating, instead of on the first frame that shows it
  try { renderer?.initTexture(tex) } catch { /* uploaded lazily instead */ }
  e.tex = tex; e.level = level
  e.listeners.forEach((l) => l(tex, level))
  // free the preview once the full texture is on the bottle
  if (old) setTimeout(() => old.dispose(), 500)
}

/** Loads the small preview. Resolves when it is ready to draw. */
export function loadPreview(k: ProductKey): Promise<Texture> {
  const e = entry(k)
  if (!e.preview) {
    e.preview = loader.loadAsync(`/tex/${k}_1024.webp`).then((t) => { tune(t); apply(e, t, 1); return t })
  }
  return e.preview
}

/** Upgrades to the full resolution texture. Safe to call repeatedly. */
export function loadFull(k: ProductKey): Promise<Texture | null> {
  const e = entry(k)
  if (!e.full) {
    const webp = () => loader.loadAsync(`/tex/${k}_2048.webp`).then(tune)
    const p: Promise<Texture> = useKtx2 && ktx2
      ? ktx2.loadAsync(`/tex/${k}_4096.ktx2`).then((t) => {
          // compressed data carries its own mip chain and was flipped at encode time
          t.colorSpace = SRGBColorSpace; t.anisotropy = maxAniso
          t.wrapS = t.wrapT = ClampToEdgeWrapping
          t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter
          return t as Texture
        }).catch((err) => { console.warn('KTX2 unavailable, using WebP', err); return webp() })
      : webp()
    e.full = p.then((t) => { apply(e, t, 2); return t }).catch(() => null)
  }
  return e.full
}

export function currentTexture(k: ProductKey) { return entry(k).tex }

/** Calls back now (if a texture exists) and on every upgrade. Returns unsubscribe. */
export function onTexture(k: ProductKey, l: Listener) {
  const e = entry(k)
  e.listeners.add(l)
  if (e.tex) l(e.tex, e.level)
  return () => { e.listeners.delete(l) }
}

/* ---------- small tiling surface maps ---------- */
const mapCache = new Map<string, Texture>()
export function surfaceMap(name: string, repeat = 1, srgb = false): Texture {
  const key = `${name}:${repeat}`
  let t = mapCache.get(key)
  if (!t) {
    t = loader.load(`/tex/maps/${name}.png`)
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat, repeat)
    t.anisotropy = 4
    if (srgb) t.colorSpace = SRGBColorSpace
    mapCache.set(key, t)
  }
  return t
}
export function resetSurfaceMaps() { mapCache.forEach((t) => t.dispose()); mapCache.clear() }
