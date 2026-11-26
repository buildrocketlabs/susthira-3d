/**
 * Builds the AR models: public/ar/{banana,psb,jeeva}.glb
 *   npm run assets:glb
 *
 * Same procedural geometry as the live scene (src/bottle/geometry.ts), scaled to
 * metres so Google Scene Viewer and AR Quick Look place a true to size bottle.
 * The label is split into two halves, each with its own 2048 px JPEG, so the
 * small print stays readable within the 2048 px texture limit AR viewers apply.
 * The outputs are committed; Vercel never runs this.
 */
import { Document, NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BufferGeometry } from 'three'
import { buildBody, buildCapSide, buildCapTop, buildLabel } from '../src/bottle/geometry'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'public', 'ar')
const LABELS = join(here, '..', '..', 'assets', 'labels')
mkdirSync(OUT, { recursive: true })
const CM = 0.01
const hex = (h: string, a = 1): [number, number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255), a]
}

for (const key of ['banana', 'psb', 'jeeva']) {
  const doc = new Document()
  doc.getRoot().getAsset().generator = 'Susthira live 3D, BuildRocket Labs'
  const buffer = doc.createBuffer()
  const scene = doc.createScene(key)
  const root = doc.createNode('bottle')
  scene.addChild(root)

  const addMesh = (name: string, g: BufferGeometry, material: ReturnType<typeof doc.createMaterial>, flipV = false) => {
    const pos = Float32Array.from(g.getAttribute('position').array as Float32Array, (v) => v * CM)
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.getAttribute('normal').array)).setBuffer(buffer))
      .setMaterial(material)
    const uv = g.getAttribute('uv')
    if (uv && material.getBaseColorTexture()) {
      const arr = new Float32Array(uv.array)
      if (flipV) for (let i = 1; i < arr.length; i += 2) arr[i] = 1 - arr[i]
      prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(arr).setBuffer(buffer))
    }
    const idx = g.getIndex()!
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(pos.length / 3 > 65535 ? new Uint32Array(idx.array) : new Uint16Array(idx.array)).setBuffer(buffer))
    root.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)))
  }

  const hdpe = doc.createMaterial('HDPE').setBaseColorFactor(hex('#F1F0EB')).setRoughnessFactor(0.46).setMetallicFactor(0).setDoubleSided(true)
  const cap = doc.createMaterial('Cap').setBaseColorFactor(hex('#12372A')).setRoughnessFactor(0.42).setMetallicFactor(0)
  addMesh('body', buildBody(72, 0.7), hdpe)
  addMesh('cap', buildCapSide(4), cap)
  addMesh('cap_top', buildCapTop(6, 48), cap)

  const master = sharp(join(LABELS, `${key}.png`), { limitInputPixels: false }).removeAlpha().resize(4096, 1968, { kernel: 'lanczos3', fit: 'fill' })
  const full = await master.png({ compressionLevel: 1 }).toBuffer()
  for (const [i, name] of ['label_left', 'label_right'].entries()) {
    const jpg = await sharp(full).extract({ left: i * 2048, top: 0, width: 2048, height: 1968 }).jpeg({ quality: 86, mozjpeg: true }).toBuffer()
    const tex = doc.createTexture(name).setImage(new Uint8Array(jpg)).setMimeType('image/jpeg')
    const mat = doc.createMaterial(name).setBaseColorTexture(tex).setRoughnessFactor(0.3).setMetallicFactor(0)
    addMesh(name, buildLabel(56, i * 0.5, i * 0.5 + 0.5), mat, true)
  }

  const file = join(OUT, `${key}.glb`)
  await new NodeIO().write(file, doc)
  console.log('  ', `public/ar/${key}.glb`, (statSync(file).size / 1024).toFixed(0), 'KB')
}
