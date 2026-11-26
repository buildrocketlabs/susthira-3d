/**
 * Asset pipeline. Converts the masters in ../assets into the web files in public/.
 * The outputs are committed, so Vercel never runs this. Run it again only when a
 * label master changes:   npm run assets:textures
 *
 * Needs: sharp (dev dependency) and the `basisu` encoder on PATH for KTX2
 * (macOS: brew install basis_universal). Without basisu the KTX2 step is skipped
 * and the existing .ktx2 files are left untouched.
 */
import sharp from 'sharp'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync, copyFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(here, '..', '..', 'assets')
const PUB = join(here, '..', 'public')
const TMP = join(here, '.tmp')
const PRODUCTS = ['banana', 'psb', 'jeeva']
const only = process.argv[2] // optional: labels | plates | brand | env

for (const d of ['tex', 'flat', 'plates', 'fallback', 'env', 'brand', 'basis', 'benchmarks', 'ar']) {
  mkdirSync(join(PUB, d), { recursive: true })
}
mkdirSync(TMP, { recursive: true })
const kb = (f) => (statSync(f).size / 1024).toFixed(0) + ' KB'
const log = (f) => console.log('  ', f.replace(PUB, 'public'), kb(f))

/* ---------- label textures ---------- */
// 5000 x 2400 master. 4096 x 1968 keeps the ratio within 0.1 % and is a multiple
// of 4, which block compressed GPU formats need.
async function labels() {
  let hasBasisu = true
  try { execFileSync('basisu', ['-version'], { stdio: 'ignore' }) } catch { hasBasisu = false }
  for (const k of PRODUCTS) {
    const src = join(ASSETS, 'labels', `${k}.png`)
    const base = () => sharp(src, { limitInputPixels: false }).removeAlpha()
    // first paint
    let out = join(PUB, 'tex', `${k}_1024.webp`)
    await base().resize(1024, 492, { kernel: 'lanczos3', fit: 'fill' }).webp({ quality: 80, effort: 6 }).toFile(out); log(out)
    // low tier and no KTX2 fallback
    out = join(PUB, 'tex', `${k}_2048.webp`)
    await base().resize(2048, 984, { kernel: 'lanczos3', fit: 'fill' }).webp({ quality: 86, effort: 6 }).toFile(out); log(out)
    // flat artwork viewer, full master resolution
    out = join(PUB, 'flat', `${k}.webp`)
    await base().webp({ quality: 88, effort: 6 }).toFile(out); log(out)
    // KTX2 (UASTC + RDO + Zstandard, mipmapped)
    if (hasBasisu) {
      const png = join(TMP, `${k}_4096.png`)
      await base().resize(4096, 1968, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 3 }).toFile(png)
      out = join(PUB, 'tex', `${k}_4096.ktx2`)
      execFileSync('basisu', [
        '-ktx2', '-uastc', '-uastc_level', '3', '-uastc_rdo_l', '1.5', '-uastc_rdo_d', '32768',
        '-mipmap', '-mip_srgb', '-mip_filter', 'lanczos4', '-y_flip',
        '-file', png, '-output_file', out,
      ], { stdio: 'ignore' })
      log(out)
    } else {
      console.warn('   basisu not found, skipping KTX2 for', k)
    }
  }
}

/* ---------- photographic back plates and static fallbacks ---------- */
async function plates() {
  for (const [name, file] of [['table', 'plate_table.jpg'], ['soil', 'plate_soil.jpg']]) {
    const out = join(PUB, 'plates', `${name}.webp`)
    await sharp(join(ASSETS, 'photos', file)).resize(2560, 1448, { fit: 'fill' }).webp({ quality: 80, effort: 6 }).toFile(out); log(out)
  }
  // static stills shown when WebGL is unavailable
  for (const [k, file] of [['banana', 'banana_table.jpg'], ['psb', 'psb_soil.jpg'], ['jeeva', 'jeeva_soil.jpg']]) {
    const out = join(PUB, 'fallback', `${k}.webp`)
    await sharp(join(ASSETS, 'renders', file)).resize(1200, 1500).webp({ quality: 80, effort: 6 }).toFile(out); log(out)
  }
  const out = join(PUB, 'fallback', 'range.webp')
  await sharp(join(ASSETS, 'renders', 'range_soil.jpg')).resize(1600, 900).webp({ quality: 80, effort: 6 }).toFile(out); log(out)
}

/* ---------- brand files: og image, icons, marks ---------- */
async function brand() {
  // og:image, 1200 x 630 crop of the range render centred on the three bottles
  let out = join(PUB, 'og.jpg')
  await sharp(join(ASSETS, 'renders', 'range_soil.jpg'))
    .extract({ left: 150, top: 140, width: 2900, height: 1522 })
    .resize(1200, 630, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toFile(out); log(out)

  const markWhite = join(ASSETS, 'logo', 'mark_white.png')
  const markGreen = join(ASSETS, 'logo', 'mark_green.png')
  out = join(PUB, 'brand', 'mark_white.webp')
  await sharp(markWhite).resize({ height: 220 }).webp({ quality: 90, alphaQuality: 95 }).toFile(out); log(out)
  out = join(PUB, 'brand', 'mark_green.webp')
  await sharp(markGreen).resize({ height: 112 }).webp({ quality: 90, alphaQuality: 95 }).toFile(out); log(out)

  // icons: white mark on forest
  const icon = async (size, file, pad) => {
    const inner = Math.round(size * (1 - pad * 2))
    const mark = await sharp(markWhite).resize({ height: inner, width: inner, fit: 'inside' }).png().toBuffer()
    const o = join(PUB, file)
    await sharp({ create: { width: size, height: size, channels: 4, background: '#12372A' } })
      .composite([{ input: mark, gravity: 'centre' }]).png({ compressionLevel: 9 }).toFile(o); log(o)
  }
  await icon(64, 'favicon.png', 0.12)
  await icon(180, 'apple-touch-icon.png', 0.18)
  await icon(512, 'icon-512.png', 0.18)
}

/* ---------- environment: shrink the Poly Haven HDRI to 384 x 192 ---------- */
// Image based lighting on rough plastic needs very little resolution; a 384 wide
// map is a seventh of the download of the 1k original and prefilters faster on a phone.
function readHDR(buf) {
  let p = 0, line = ''
  const next = () => { let s = ''; while (buf[p] !== 10) s += String.fromCharCode(buf[p++]); p++; return s }
  while ((line = next()) !== '') { /* header */ }
  const m = /-Y (\d+) \+X (\d+)/.exec(next())
  const h = +m[1], w = +m[2]
  const out = new Float32Array(w * h * 3)
  const scan = new Uint8Array(w * 4)
  for (let y = 0; y < h; y++) {
    if (buf[p] !== 2 || buf[p + 1] !== 2) throw new Error('only new RLE supported')
    p += 4
    for (let c = 0; c < 4; c++) {
      let x = 0
      while (x < w) {
        let n = buf[p++]
        if (n > 128) { n -= 128; const v = buf[p++]; while (n--) scan[4 * x++ + c] = v }
        else { while (n--) scan[4 * x++ + c] = buf[p++] }
      }
    }
    for (let x = 0; x < w; x++) {
      const e = scan[4 * x + 3]
      const f = e ? Math.pow(2, e - 136) : 0
      const o = (y * w + x) * 3
      out[o] = scan[4 * x] * f; out[o + 1] = scan[4 * x + 1] * f; out[o + 2] = scan[4 * x + 2] * f
    }
  }
  return { w, h, data: out }
}
function writeHDR({ w, h, data }) {
  const chunks = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'ascii')]
  const scan = new Uint8Array(w * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3
      const r = data[o], g = data[o + 1], b = data[o + 2]
      const v = Math.max(r, g, b)
      if (v < 1e-32) { scan.fill(0, 4 * x, 4 * x + 4); continue }
      let e = Math.ceil(Math.log2(v))
      if (v / Math.pow(2, e) >= 1) e++
      const f = 256 / Math.pow(2, e)
      scan[4 * x] = Math.min(255, r * f); scan[4 * x + 1] = Math.min(255, g * f); scan[4 * x + 2] = Math.min(255, b * f); scan[4 * x + 3] = e + 128
    }
    const line = [2, 2, w >> 8, w & 255]
    for (let c = 0; c < 4; c++) {
      let x = 0
      while (x < w) {
        let run = 1
        while (x + run < w && run < 127 && scan[4 * (x + run) + c] === scan[4 * x + c]) run++
        if (run >= 3) { line.push(128 + run, scan[4 * x + c]); x += run; continue }
        // literal run until the next repeat of 3
        const start = x; let n = 0
        while (x < w && n < 128) {
          if (x + 2 < w && scan[4 * x + c] === scan[4 * (x + 1) + c] && scan[4 * x + c] === scan[4 * (x + 2) + c]) break
          x++; n++
        }
        line.push(n); for (let i = start; i < start + n; i++) line.push(scan[4 * i + c])
      }
    }
    chunks.push(Buffer.from(line))
  }
  return Buffer.concat(chunks)
}
function env() {
  const src = join(here, 'studio_small_09_1k.hdr')
  const img = readHDR(readFileSync(src))
  const W = 384, H = 192, fx = img.w / W, fy = img.h / H
  const out = new Float32Array(W * H * 3)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, n = 0
    for (let yy = Math.floor(y * fy); yy < Math.floor((y + 1) * fy); yy++)
      for (let xx = Math.floor(x * fx); xx < Math.floor((x + 1) * fx); xx++) {
        const o = (yy * img.w + xx) * 3; r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; n++
      }
    const o = (y * W + x) * 3; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n
  }
  const f = join(PUB, 'env', 'studio_small_09_384.hdr')
  writeFileSync(f, writeHDR({ w: W, h: H, data: out })); log(f)
}

/* ---------- runtime support files copied out of node_modules ---------- */
function vendor() {
  const nm = join(here, '..', 'node_modules')
  for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm'])
    copyFileSync(join(nm, 'three/examples/jsm/libs/basis', f), join(PUB, 'basis', f))
  // detect-gpu benchmark tables, self hosted so no third party request is made
  const b = join(nm, 'detect-gpu/dist/benchmarks')
  for (const f of readdirSync(b)) copyFileSync(join(b, f), join(PUB, 'benchmarks', f))
  console.log('   copied basis transcoder and GPU benchmark tables')
}

const steps = { labels, plates, brand, env, vendor }
for (const [name, fn] of Object.entries(steps)) {
  if (only && only !== name) continue
  console.log(name)
  await fn()
}
rmSync(TMP, { recursive: true, force: true })
