/**
 * Physically based materials for the bottle.
 *   HDPE wall : warm white, satin (roughness about 0.45), faint sheen, a micro
 *               texture on normal and roughness so highlights break up like real
 *               blow moulded plastic.
 *   Label     : glossy BOPP film, clearcoat 0.5 over the printed artwork.
 *   Cap       : forest green polypropylene, knurled in geometry.
 * Low tier devices get MeshStandardMaterial versions of the same look.
 */
import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, type Material, type Texture } from 'three'
import { surfaceMap } from './textures'

export interface BottleMaterials { body: Material; cap: Material; capTop: Material; edges: Material; makeLabel: () => MeshPhysicalMaterial | MeshStandardMaterial }

export function createMaterials(physical: boolean): BottleMaterials {
  // uvs repeat 10 times round the bottle; two more tiles of the 128 px map keep the grain fine
  const microN = surfaceMap('plastic_normal', 2)
  const microR = surfaceMap('plastic_rough', 2)

  const bodyParams = {
    color: new Color('#EDECE6'),
    roughness: 0.5, // multiplied by the 0.8 to 1.0 map: 0.40 to 0.50 on the surface
    metalness: 0,
    roughnessMap: microR,
    normalMap: microN,
    normalScale: new Vector2(0.1, 0.1),
    envMapIntensity: 0.5, // keeps the white wall from washing out: its form comes from the key light
    side: DoubleSide, // the neck opening shows its inner wall in AR and from above
  }
  const body = physical
    ? new MeshPhysicalMaterial({ ...bodyParams, sheen: 0.2, sheenRoughness: 0.55, sheenColor: new Color('#FFF6E8'), specularIntensity: 0.9, ior: 1.54 })
    : new MeshStandardMaterial(bodyParams)

  const cap = new MeshStandardMaterial({
    color: new Color('#15402F'), roughness: 0.4, metalness: 0,
    roughnessMap: microR, normalMap: microN, normalScale: new Vector2(0.08, 0.08),
  })
  const capTop = new MeshStandardMaterial({
    color: new Color('#15402F'), roughness: 0.6, metalness: 0,
    roughnessMap: surfaceMap('captop_rough'), normalMap: surfaceMap('captop_normal'), normalScale: new Vector2(0.55, 0.55),
  })
  const edges = new MeshStandardMaterial({ color: new Color('#3d3a33'), roughness: 0.8, transparent: true, opacity: 0.42, depthWrite: false })

  const makeLabel = () => physical
    ? new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.18, ior: 1.49, envMapIntensity: 0.8 })
    : new MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0, envMapIntensity: 0.8 })

  return { body, cap, capTop, edges, makeLabel }
}

export function setLabelMap(m: MeshPhysicalMaterial | MeshStandardMaterial, tex: Texture) {
  const first = !m.map
  m.map = tex
  if (first) m.needsUpdate = true
}
