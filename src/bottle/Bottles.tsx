/**
 * The three bottles. Geometry and the wall and cap materials are shared; each
 * product owns only its label material and texture. The rig positions them.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferAttribute, type Group, type Mesh } from 'three'
import { PRODUCTS, type ProductKey } from '../config'
import { useStore } from '../store'
import { buildBody, buildCapSide, buildCapTop, buildLabel, buildLabelEdges } from './geometry'
import { createMaterials, setLabelMap, type BottleMaterials } from './materials'
import { loadPreview, onTexture } from './textures'
import { rig } from '../scene/rigState'

/** Bakes soft occlusion into vertex colours: under the cap, around the tamper ring and at the heel. */
function bakeOcclusion(g: ReturnType<typeof buildBody>) {
  const pos = g.getAttribute('position')
  const col = new Float32Array(pos.count * 3)
  const band = (y: number, c: number, w: number) => Math.exp(-Math.pow((y - c) / w, 2))
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const r = Math.hypot(pos.getX(i), pos.getZ(i))
    let ao = 1
    ao -= 0.34 * band(y, 21.72, 0.3) // tucked under the cap skirt
    ao -= 0.16 * band(y, 21.08, 0.1) // crease below the tamper ring
    ao -= 0.1 * band(y, 20.7, 0.25) // neck root
    if (y < 0.9) ao -= 0.3 * Math.pow(1 - y / 0.9, 2) // heel near the ground
    if (y < 0.5 && r < 3.8) ao -= 0.25 // recessed base
    if (y > 21.9) ao = 0.5 // finish inside the cap
    ao = Math.max(0.3, ao)
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao
  }
  g.setAttribute('color', new BufferAttribute(col, 3))
}

function Bottle({ k, geo, mats }: { k: ProductKey; geo: ReturnType<typeof useGeometry>; mats: BottleMaterials }) {
  const group = useRef<Group>(null!)
  const label = useRef<Mesh>(null!)
  const labelMat = useMemo(() => mats.makeLabel(), [mats])

  useLayoutEffect(() => {
    rig.bottles[k] = { group: group.current, label: label.current, labelMat }
    group.current.visible = k === rig.shown
    return () => { delete rig.bottles[k] }
  }, [k, labelMat])

  useEffect(() => {
    const off = onTexture(k, (tex) => { setLabelMap(labelMat, tex); rig.wake(400) })
    return () => { off(); labelMat.dispose() }
  }, [k, labelMat])

  return (
    <group ref={group}>
      <mesh geometry={geo.body} material={mats.body} />
      <mesh geometry={geo.capSide} material={mats.cap} />
      <mesh geometry={geo.capTop} material={mats.capTop} />
      <mesh ref={label} geometry={geo.label} material={labelMat} />
      <mesh geometry={geo.edges} material={mats.edges} renderOrder={1} />
    </group>
  )
}

function useGeometry(low: boolean) {
  return useMemo(() => {
    const body = buildBody(low ? 72 : 128, low ? 0.6 : 1)
    bakeOcclusion(body)
    return {
      body,
      capSide: buildCapSide(low ? 4 : 6),
      capTop: buildCapTop(8, low ? 48 : 72),
      label: buildLabel(low ? 72 : 128),
      edges: buildLabelEdges(low ? 72 : 128),
    }
  }, [low])
}

export function Bottles() {
  const physical = useStore((s) => s.quality.physical)
  const low = useStore((s) => s.quality.tier === 'low')
  const geo = useGeometry(low)
  const mats = useMemo(() => {
    const m = createMaterials(physical)
    ;(m.body as unknown as { vertexColors: boolean }).vertexColors = true
    return m
  }, [physical])

  useEffect(() => { loadPreview(useStore.getState().product) }, [])
  useEffect(() => () => { Object.values(geo).forEach((g) => g.dispose()) }, [geo])

  return <>{PRODUCTS.map((p) => <Bottle key={p.key} k={p.key} geo={geo} mats={mats} />)}</>
}
