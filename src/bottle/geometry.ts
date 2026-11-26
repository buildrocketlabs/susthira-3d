/**
 * Procedural geometry for the 1 L round HDPE bottle. Units are centimetres.
 * This file depends on three only (no DOM, no React) because the AR export
 * script (scripts/build-glb.ts) runs it in Node as well.
 *
 * Angle convention (same as the prototype in reference_viewer):
 *   x = r sin(theta), z = r cos(theta). theta = 0 faces the camera on +Z and the
 *   label u coordinate grows to the viewer's right.
 */
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from 'three'

/* ---------- label placement (see brief/BRAND.md) ---------- */
export const BODY_R = 4.6
export const LABEL_R = BODY_R + 0.03 // film sits 0.3 mm proud of the wall
export const LABEL_H = 12
export const LABEL_Y0 = 3.2 // bottom edge above the base
export const LABEL_ARC = (2 * Math.PI * 250) / 289 // 250 mm label on a 289 mm circumference
export const LABEL_U_FRONT = 0.59 // u of the front panel centre
export const BOTTLE_H = 24.98

/** Angle on the bottle (radians) of a label u coordinate. */
export const thetaOfU = (u: number) => (u - LABEL_U_FRONT) * LABEL_ARC
/** Bottle yaw that turns label coordinate u to face the camera. */
export const yawForU = (u: number) => -thetaOfU(u)

type P = [number, number] // [radius, height]

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): P[] {
  const out: P[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}

/** Bottle body profile from the centre of the base to the neck finish. */
export function bodyProfile(detail = 1): P[] {
  const p: P[] = []
  // recessed push up base with a raised mould code ring
  p.push([0, 0.46], [0.5, 0.455], [1.35, 0.43])
  p.push([1.45, 0.46], [1.55, 0.475], [1.65, 0.46], [1.75, 0.42]) // mould ring
  p.push([2.4, 0.36], [2.95, 0.27], [3.3, 0.14])
  p.push(...arc(3.62, 0.16, 0.16, -Math.PI * 0.75, -Math.PI / 2, 3)) // into the standing ring
  p.push([3.85, 0])
  // heel: quarter round up into the wall
  p.push(...arc(3.85, 0.75, 0.75, -Math.PI / 2, 0, Math.round(10 * detail)).slice(1))
  // straight label panel
  p.push([BODY_R, 3.1], [BODY_R, 9], [BODY_R, 15.3], [BODY_R, 15.9])
  // domed shoulder, a smooth curve through the prototype's control points
  const pts = ([[4.6, 15.2], [4.6, 16.2], [4.52, 17.3], [4.2, 18.4], [3.5, 19.4], [2.7, 20.1], [2.18, 20.5], [2.05, 20.85], [2.05, 21.3]] as P[])
    .map(([r, y]) => new Vector3(r, y, 0))
  const curve = new CatmullRomCurve3(pts, false, 'centripetal')
  const n = Math.round(44 * detail)
  for (let i = 0; i <= n; i++) {
    const v = curve.getPoint(i / n)
    if (v.y > 16.0 && v.y < 20.95) p.push([Math.min(v.x, BODY_R), v.y])
  }
  // neck, tamper ring with small radii, then the finish hidden under the cap
  p.push([2.05, 21.06])
  p.push([2.12, 21.12], [2.24, 21.17], [2.28, 21.24], [2.28, 21.5], [2.24, 21.58], [2.1, 21.64], [2.05, 21.7])
  p.push([2.05, 24.3], [2.0, 24.4], [1.8, 24.4], [1.75, 24.3], [1.75, 22.6]) // wall thickness at the opening
  return p
}

/** Outer skin of the cap, from its bottom edge up to the rim of the top face. */
export function capProfile(): P[] {
  const p: P[] = [[2.06, 21.78], [2.34, 21.76], [2.4, 21.8], [2.42, 21.9]]
  p.push([2.42, 22.4], [2.42, 23.2], [2.42, 24.0], [2.42, 24.42])
  // rounded top edge
  p.push(...arc(2.0, 24.5, 0.42, 0, Math.PI * 0.47, 7).slice(1))
  return p
}
export const CAP_RIBS = 90
export const CAP_TOP_R = 2.0 + 0.42 * Math.cos(Math.PI * 0.47)
export const CAP_TOP_Y = 24.5 + 0.42 * Math.sin(Math.PI * 0.47)

export interface LatheOptions {
  /** angular sample positions, ascending, first 0 and last 2 pi */
  thetas: number[]
  /** radial offset added at (theta, height, profile index) */
  bump?: (theta: number, y: number, i: number) => number
  /** u repeat of the generated uv set */
  uRepeat?: number
  vRepeat?: number
}

/** A lathe with arbitrary angular sampling and an optional radial bump. */
export function lathe(profile: P[], { thetas, bump, uRepeat = 1, vRepeat = 1 }: LatheOptions): BufferGeometry {
  const rows = profile.length
  const cols = thetas.length
  const pos = new Float32Array(rows * cols * 3)
  const uv = new Float32Array(rows * cols * 2)
  // v follows arc length so textures do not stretch on the shoulder
  const len = [0]
  for (let i = 1; i < rows; i++) len.push(len[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  const total = len[rows - 1]
  for (let j = 0; j < cols; j++) {
    const t = thetas[j]
    const s = Math.sin(t), c = Math.cos(t)
    for (let i = 0; i < rows; i++) {
      const [r0, y] = profile[i]
      const r = r0 + (bump && r0 > 0 ? bump(t, y, i) : 0)
      const o = j * rows + i
      pos[o * 3] = r * s; pos[o * 3 + 1] = y; pos[o * 3 + 2] = r * c
      uv[o * 2] = (t / (2 * Math.PI)) * uRepeat
      uv[o * 2 + 1] = (len[i] / total) * vRepeat
    }
  }
  const idx: number[] = []
  for (let j = 0; j < cols - 1; j++) {
    for (let i = 0; i < rows - 1; i++) {
      const a = j * rows + i, b = (j + 1) * rows + i, c2 = (j + 1) * rows + i + 1, d = j * rows + i + 1
      idx.push(a, b, d, b, c2, d)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  // weld the normals across the wrap column so there is no shading seam
  const nrm = g.getAttribute('normal') as BufferAttribute
  for (let i = 0; i < rows; i++) {
    const a = i, b = (cols - 1) * rows + i
    const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b)
    const l = Math.hypot(x, y, z) || 1
    nrm.setXYZ(a, x / l, y / l, z / l); nrm.setXYZ(b, x / l, y / l, z / l)
  }
  return g
}

const uniformThetas = (n: number) => Array.from({ length: n + 1 }, (_, i) => (i / n) * Math.PI * 2)

/** Mould parting line positions: the two sides of the bottle, seen from the front. */
export const SEAM_THETAS = [Math.PI / 2, (3 * Math.PI) / 2]
const SEAM_HALF_WIDTH = 0.022 // cm
const SEAM_HEIGHT = 0.0035 // cm, a 35 micron witness line

export function buildBody(radial = 128, detail = 1): BufferGeometry {
  // Uniform columns plus a tight cluster around each parting line. The line is a
  // real ridge in the mesh, so it stays crisp at any zoom and costs no texture.
  const set = new Set<number>(uniformThetas(radial))
  for (const s of SEAM_THETAS) for (const k of [-3, -1.6, -0.8, 0, 0.8, 1.6, 3]) set.add(s + (k * SEAM_HALF_WIDTH) / BODY_R)
  const thetas = [...set].sort((a, b) => a - b)
  // drop uniform columns that fall inside a seam cluster
  const clean = thetas.filter((t, i) => i === 0 || t - thetas[i - 1] > 1e-4)
  return lathe(bodyProfile(detail), {
    thetas: clean,
    uRepeat: 10,
    vRepeat: 10,
    bump: (t, y) => {
      if (y < 0.05 || y > 21.0) return 0
      let b = 0
      for (const s of SEAM_THETAS) {
        const d = ((t - s) * BODY_R) / SEAM_HALF_WIDTH
        if (Math.abs(d) < 3.2) b += SEAM_HEIGHT * Math.exp(-d * d)
      }
      return b
    },
  })
}

export function buildCapSide(samplesPerRib = 6): BufferGeometry {
  const thetas = uniformThetas(CAP_RIBS * samplesPerRib)
  return lathe(capProfile(), {
    thetas,
    uRepeat: 6,
    vRepeat: 2,
    bump: (t, y) => {
      // knurl: rounded ribs that fade out near the bottom band and the top radius
      const fade = Math.min(1, Math.max(0, (y - 21.95) / 0.2)) * Math.min(1, Math.max(0, (24.5 - y) / 0.2))
      const w = 0.5 + 0.5 * Math.cos(t * CAP_RIBS)
      return 0.075 * fade * (Math.pow(w, 0.6) - 0.45)
    },
  })
}

/** Slightly crowned top face of the cap with planar uvs for its texture. */
export function buildCapTop(rings = 10, seg = 72): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = []
  const crown = 0.05
  for (let i = 0; i <= rings; i++) {
    const f = i / rings
    const r = CAP_TOP_R * f
    for (let j = 0; j <= seg; j++) {
      const t = (j / seg) * Math.PI * 2
      const x = r * Math.sin(t), z = r * Math.cos(t)
      pos.push(x, CAP_TOP_Y + crown * (1 - f * f), z)
      uv.push(0.5 + (x / CAP_TOP_R) * 0.5, 0.5 - (z / CAP_TOP_R) * 0.5)
      const slope = (2 * crown * f) / CAP_TOP_R
      const l = Math.hypot(slope, 1)
      nrm.push((Math.sin(t) * slope) / l, 1 / l, (Math.cos(t) * slope) / l)
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex(idx)
  return g
}

/**
 * The label film: an open cylinder covering LABEL_ARC and leaving the 39 mm gap
 * at the back. u0..u1 selects a slice of the artwork (the AR export splits the
 * label into two halves so each half can carry its own texture).
 */
export function buildLabel(seg = 128, u0 = 0, u1 = 1, radius = LABEL_R): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = []
  for (let j = 0; j <= seg; j++) {
    const f = j / seg
    const u = u0 + (u1 - u0) * f
    const t = thetaOfU(u)
    const s = Math.sin(t), c = Math.cos(t)
    for (let i = 0; i < 2; i++) {
      pos.push(radius * s, LABEL_Y0 + LABEL_H * i, radius * c)
      nrm.push(s, 0, c)
      uv.push(f, i)
    }
  }
  for (let j = 0; j < seg; j++) {
    const a = j * 2
    idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  g.setIndex(idx)
  return g
}

/**
 * Hairline strips just outside the four edges of the label. Rendered dark and
 * half transparent, they read as the thickness and tiny shadow of the film.
 */
export function buildLabelEdges(seg = 128, width = 0.022): BufferGeometry {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = []
  const r = BODY_R + 0.012
  const quadStrip = (y0: number, y1: number, ta: number, tb: number, n: number) => {
    const base = pos.length / 3
    for (let j = 0; j <= n; j++) {
      const t = ta + ((tb - ta) * j) / n
      const s = Math.sin(t), c = Math.cos(t)
      pos.push(r * s, y0, r * c, r * s, y1, r * c)
      nrm.push(s, 0, c, s, 0, c)
    }
    for (let j = 0; j < n; j++) {
      const a = base + j * 2
      idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1)
    }
  }
  const t0 = thetaOfU(0), t1 = thetaOfU(1), dw = width / r
  quadStrip(LABEL_Y0 - width, LABEL_Y0, t0 - dw, t1 + dw, seg) // bottom
  quadStrip(LABEL_Y0 + LABEL_H, LABEL_Y0 + LABEL_H + width, t0 - dw, t1 + dw, seg) // top
  quadStrip(LABEL_Y0, LABEL_Y0 + LABEL_H, t0 - dw, t0, 1) // leading end
  quadStrip(LABEL_Y0, LABEL_Y0 + LABEL_H, t1, t1 + dw, 1) // trailing end
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3))
  g.setIndex(idx)
  return g
}
