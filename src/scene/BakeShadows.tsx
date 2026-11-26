/**
 * Development tool, never loaded by visitors. Open /?bake=a (or b) to accumulate
 * a soft, area light quality ground shadow, then call window.__bakeShadow() to
 * get it as a PNG data URL. qa/bake-shadows.mjs drives this and writes
 * public/tex/shadow/*.webp.
 *
 *   set a : key light high on the front left (studio, banana field)
 *   set b : light from the back left, shadow reaching forward (red soil)
 */
import { useEffect, useRef } from 'react'
import { AccumulativeShadows, RandomizedLight } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { OrthographicCamera, WebGLRenderTarget, type Mesh } from 'three'
import { useStore } from '../store'
import { rig } from './rigState'
import { SHADOW_CENTRE, SHADOW_SIZE } from './Stage'

const LIGHT: Record<string, [number, number, number]> = { a: [-28, 46, 5], b: [-26, 50, -22] }
const FRAMES = 600

export default function BakeShadows({ set }: { set: string }) {
  const api = useRef<{ getMesh: () => Mesh; count: number }>(null!)
  const { gl, scene } = useThree()
  useEffect(() => {
    scene.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true })
    const layout = new URLSearchParams(location.search).get('layout') === 'range' ? 'range' : 'single'
    // after the rig has subscribed to the store
    setTimeout(() => {
      useStore.setState({ phase: 'hero', view: layout })
      rig.rangeT = layout === 'range' ? 1 : 0
      rig.reveal = 1
      rig.wake(60000)
    }, 150)
    const w = window as unknown as { __bakeShadow: () => string | null }
    w.__bakeShadow = () => {
      if (api.current.count < FRAMES) return null
      const mesh = api.current.getMesh()
      const rt = new WebGLRenderTarget(1024, 1024)
      const cam = new OrthographicCamera(-SHADOW_SIZE / 2, SHADOW_SIZE / 2, SHADOW_SIZE / 2, -SHADOW_SIZE / 2, 0.1, 100)
      cam.position.set(SHADOW_CENTRE[0], 50, SHADOW_CENTRE[2]); cam.up.set(0, 0, -1); cam.lookAt(SHADOW_CENTRE[0], 0, SHADOW_CENTRE[2]); cam.updateMatrixWorld()
      mesh.updateMatrixWorld(true)
      const prev = gl.getRenderTarget(); const alpha = gl.getClearAlpha()
      gl.setRenderTarget(rt); gl.setClearAlpha(0); gl.clear(); gl.render(mesh, cam)
      const px = new Uint8Array(1024 * 1024 * 4)
      gl.readRenderTargetPixels(rt, 0, 0, 1024, 1024, px)
      gl.setRenderTarget(prev); gl.setClearAlpha(alpha)
      const c = document.createElement('canvas'); c.width = c.height = 1024
      const ctx = c.getContext('2d')!; const img = ctx.createImageData(1024, 1024)
      for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
        const a = px[((1023 - y) * 1024 + x) * 4 + 3]
        const o = (y * 1024 + x) * 4
        img.data[o] = img.data[o + 1] = img.data[o + 2] = a; img.data[o + 3] = 255
      }
      ctx.putImageData(img, 0, 0)
      return c.toDataURL('image/png')
    }
  }, [gl, scene])
  return (
    <AccumulativeShadows ref={api as never} temporal frames={FRAMES} alphaTest={0.9} opacity={1} scale={SHADOW_SIZE} position={SHADOW_CENTRE} resolution={1024} color="black" colorBlend={1} toneMapped={false}>
      <RandomizedLight amount={8} radius={26} ambient={0.55} position={LIGHT[set] ?? LIGHT.a} bias={0.0005} size={60} mapSize={1024} near={1} far={260} />
    </AccumulativeShadows>
  )
}
