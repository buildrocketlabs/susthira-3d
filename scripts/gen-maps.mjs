/**
 * Procedural surface maps for the moulded plastic. Deterministic (seeded), so the
 * committed files in public/tex/maps can always be regenerated:
 *   npm run assets:maps
 *
 * plastic_normal / plastic_rough : tileable micro texture of blow moulded HDPE.
 *   Breaks up highlights so the wall reads as plastic rather than as a CG gradient.
 * captop_normal / captop_rough   : top face of the cap. Fine spark eroded stipple,
 *   a polished rim, a shallow ring and the injection gate dimple in the centre.
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tex', 'maps')
mkdirSync(OUT, { recursive: true })

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** periodic box blur, three passes approximate a gaussian */
function blur(src, n, radius) {
  let a = Float32Array.from(src), b = new Float32Array(n * n)
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let k = -radius; k <= radius; k++) s += a[y * n + ((x + k + n) % n)]; b[y * n + x] = s / (2 * radius + 1) }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let s = 0; for (let k = -radius; k <= radius; k++) s += b[((y + k + n) % n) * n + x]; a[y * n + x] = s / (2 * radius + 1) }
  }
  return a
}
function normalise(a) { let lo = Infinity, hi = -Infinity; for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v) } return a.map((v) => (v - lo) / (hi - lo)) }
function noise(n, radius, seed) { const r = rng(seed); return normalise(blur(Float32Array.from({ length: n * n }, () => r()), n, radius)) }

/** height field (0..1) to a tangent space normal map, periodic */
function toNormal(h, n, strength) {
  const out = Buffer.alloc(n * n * 3)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const l = h[y * n + ((x - 1 + n) % n)], r = h[y * n + ((x + 1) % n)]
    const u = h[((y - 1 + n) % n) * n + x], d = h[((y + 1) % n) * n + x]
    let nx = (l - r) * strength, ny = (d - u) * strength, nz = 1 // image y is down, tangent space y is up
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len
    const o = (y * n + x) * 3
    out[o] = Math.round((nx * 0.5 + 0.5) * 255); out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255); out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
  }
  return out
}
const save = (buf, n, ch, name) => sharp(buf, { raw: { width: n, height: n, channels: ch } }).png({ compressionLevel: 9 }).toFile(join(OUT, name)).then((i) => console.log('  ', name, (i.size / 1024).toFixed(0), 'KB'))

/* ---- HDPE micro texture ---- */
{
  const n = 128
  const fine = noise(n, 1, 11), mid = noise(n, 3, 23), broad = noise(n, 9, 37)
  const h = fine.map((v, i) => v * 0.35 + mid[i] * 0.4 + broad[i] * 0.25)
  await save(toNormal(h, n, 2.2), n, 3, 'plastic_normal.png')
  // roughness multiplier in the green channel: 0.80 to 1.0
  const rough = Buffer.alloc(n * n * 3)
  const r2 = noise(n, 2, 51), r3 = noise(n, 10, 67)
  for (let i = 0; i < n * n; i++) { const v = Math.round((0.8 + 0.2 * (r2[i] * 0.5 + r3[i] * 0.5)) * 255); rough[i * 3] = rough[i * 3 + 1] = rough[i * 3 + 2] = v }
  await save(rough, n, 3, 'plastic_rough.png')
}

/* ---- cap top ---- */
{
  const n = 256
  const stipple = noise(n, 1, 91), soft = noise(n, 4, 97)
  const h = new Float32Array(n * n), rough = Buffer.alloc(n * n * 3)
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (x + 0.5) / n - 0.5, dy = (y + 0.5) / n - 0.5
    const r = Math.hypot(dx, dy) * 2 // 0 centre, 1 rim
    // textured field between the gate and the polished rim
    const field = smooth(0.1, 0.14, r) * (1 - smooth(0.8, 0.84, r))
    let v = field * (stipple[y * n + x] * 0.55 + soft[y * n + x] * 0.25)
    v -= 0.9 * Math.exp(-Math.pow((r - 0.86) / 0.012, 2)) // fine groove inside the rim
    v -= 1.6 * Math.exp(-Math.pow(r / 0.045, 2)) // gate dimple
    v += 0.5 * Math.exp(-Math.pow((r - 0.075) / 0.012, 2)) // gate witness ring
    h[y * n + x] = v
    const rv = Math.round((field * (0.86 + 0.14 * soft[y * n + x]) + (1 - field) * 0.55) * 255)
    const o = (y * n + x) * 3; rough[o] = rough[o + 1] = rough[o + 2] = rv
  }
  await save(toNormal(h, n, 1.6), n, 3, 'captop_normal.png')
  await save(rough, n, 3, 'captop_rough.png')
}
