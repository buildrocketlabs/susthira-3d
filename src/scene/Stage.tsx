/**
 * The WebGL stage: canvas, studio lighting, the paper sweep, photographic back
 * plates, baked ground shadows and (on capable GPUs) post processing.
 */
import { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import {
  BufferAttribute, BufferGeometry, Color, DefaultLoadingManager, DirectionalLight, HemisphereLight, Mesh,
  MeshBasicMaterial, NeutralToneMapping, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, ShaderMaterial, TextureLoader, Vector3,
  type Texture,
} from 'three'
import type { SceneKey } from '../config'
import { useStore } from '../store'
import { Bottles } from '../bottle/Bottles'
import { initTextures, resetSurfaceMaps } from '../bottle/textures'
import { Rig, framing, lockedTilt } from './Rig'
import { PIVOT_Y, SCENE_LOOK, rig, smooth } from './rigState'
import { Governor } from './Governor'

const Post = lazy(() => import('./Post'))
const BakeShadows = lazy(() => import('./BakeShadows'))
export const BAKE = new URLSearchParams(location.search).get('bake') // dev tool, see scripts/README in site/README.md

/* ------------------------------------------------------------------ */
/* Lighting per scene                                                  */
/* ------------------------------------------------------------------ */
interface Look {
  key: [string, number, [number, number, number]]
  rim: [string, number, [number, number, number]]
  sky: string; ground: string; hemi: number
  env: number; envRotation: number
  shadow: { set: 'a' | 'b'; color: string; opacity: number }
}
const LOOKS: Record<SceneKey, Look> = {
  studio: {
    key: ['#fffdf8', 2.5, [-40, 38, 40]], rim: ['#eef3ff', 2.2, [44, 22, -26]],
    sky: '#ffffff', ground: '#e0d6c4', hemi: 0.22, env: 1.25, envRotation: 0.6,
    shadow: { set: 'a', color: '#241a0e', opacity: 0.8 },
  },
  field: {
    key: ['#fff0cf', 2.6, [-38, 50, 34]], rim: ['#d9f5b5', 2.0, [40, 26, -30]],
    sky: '#e9f7d6', ground: '#7a5231', hemi: 0.6, env: 0.7, envRotation: 0.6,
    shadow: { set: 'a', color: '#1a0e05', opacity: 0.88 },
  },
  soil: {
    key: ['#ffe6c8', 2.4, [-40, 38, 36]], rim: ['#ffd9b8', 1.8, [-34, 40, -40]],
    sky: '#f6e3d0', ground: '#a04f2c', hemi: 0.75, env: 0.66, envRotation: 0.6,
    shadow: { set: 'b', color: '#1c0802', opacity: 1 },
  },
}

function Lights() {
  const scene = useStore((s) => s.scene)
  const look = LOOKS[scene]
  const key = useRef<DirectionalLight>(null!)
  const rim = useRef<DirectionalLight>(null!)
  const hemi = useRef<HemisphereLight>(null!)
  const three = useThree((s) => s.scene)
  useFrame(() => {
    const r = rig.reveal
    key.current.intensity = look.key[1] * r
    rim.current.intensity = look.rim[1] * r
    hemi.current.intensity = look.hemi * r
    three.environmentIntensity = look.env * (0.04 + 0.96 * r)
    three.environmentRotation.y = look.envRotation
  })
  return (
    <>
      <directionalLight ref={key} color={look.key[0]} position={look.key[2]} intensity={0} />
      <directionalLight ref={rim} color={look.rim[0]} position={look.rim[2]} intensity={0} />
      <hemisphereLight ref={hemi} args={[look.sky, look.ground, 0]} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Studio sweep: an infinity cove of warm paper with a pool of light   */
/* ------------------------------------------------------------------ */
function sweepGeometry() {
  // side profile: floor running back from the camera, a wide radius, then the wall
  const prof: [number, number][] = [] // [z, y]
  prof.push([700, 0], [200, 0], [60, 0], [-60, 0])
  const R = 90
  for (let i = 1; i <= 14; i++) { const a = (i / 14) * (Math.PI / 2); prof.push([-60 - R * Math.sin(a), R - R * Math.cos(a)]) }
  prof.push([-150, 260], [-150, 900])
  const xs = [-1400, -500, -160, -60, 0, 60, 160, 500, 1400]
  const pos: number[] = [], along: number[] = [], idx: number[] = []
  let s = -700
  prof.forEach(([z, y], i) => {
    if (i > 0) s += Math.hypot(z - prof[i - 1][0], y - prof[i - 1][1])
    for (const x of xs) { pos.push(x, y, z); along.push(s) }
  })
  for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < xs.length - 1; j++) {
    const a = i * xs.length + j, b = a + xs.length
    idx.push(a, a + 1, b, a + 1, b + 1, b)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  g.setAttribute('aAlong', new BufferAttribute(new Float32Array(along), 1))
  g.setIndex(idx)
  return g
}

function Sweep() {
  const mat = useMemo(() => new ShaderMaterial({
    depthWrite: false,
    uniforms: {
      uReveal: { value: 0 },
      uPool: { value: new Color('#F1E5CD') },
      uMid: { value: new Color('#CBB692') },
      uFar: { value: new Color('#9A8262') },
      uDark: { value: new Color('#0B271D') },
    },
    vertexShader: /* glsl */ `
      attribute float aAlong;
      varying vec2 vP;
      void main() {
        vP = vec2(position.x, aAlong);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uReveal;
      uniform vec3 uPool, uMid, uFar, uDark;
      varying vec2 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        // distance from the pool of light, measured along the paper so the
        // gradient runs smoothly up the cove
        float d = length(vec2(vP.x * 0.8, vP.y + 4.0));
        vec3 c = mix(uPool, uMid, smoothstep(6.0, 78.0, d));
        c = mix(c, uFar, smoothstep(70.0, 420.0, d));
        // the pool opens up as the lights come on
        float lit = uReveal * mix(0.55, 1.0, smoothstep(0.0, 1.0, uReveal * 1.4 - smoothstep(0.0, 300.0, d) * 0.4));
        c = mix(uDark, c, clamp(lit, 0.0, 1.0));
        // a little grain hides banding on 8 bit phone panels
        c += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }), [])
  const geo = useMemo(sweepGeometry, [])
  useFrame(() => { mat.uniforms.uReveal.value = rig.reveal })
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <mesh geometry={geo} material={mat} renderOrder={-3} frustumCulled={false} />
}

/* ------------------------------------------------------------------ */
/* Photographic back plates, registered to the locked camera           */
/* ------------------------------------------------------------------ */
interface PlateSpec { file: string; aspect: number; /** row of the photo (0 top, 1 bottom) that passes through world height lineY at the bottle */ line: number; lineY: number; scale: number }
const PLATES: Partial<Record<SceneKey, PlateSpec>> = {
  // table: its far edge crosses the bottle a little below half height
  field: { file: '/plates/table.webp', aspect: 2560 / 1448, line: 0.665, lineY: 11.2, scale: 1.3 },
  // soil: the horizon sits at camera height
  soil: { file: '/plates/soil.webp', aspect: 2560 / 1448, line: 0.716, lineY: 5.5, scale: 1.08 },
}
const plateCache = new Map<string, Texture>()
const PLATE_DIST = 420

function Plate({ k, spec }: { k: SceneKey; spec: PlateSpec }) {
  const scene = useStore((s) => s.scene)
  const insets = useStore((s) => s.insets)
  const size = useThree((s) => s.size)
  const mesh = useRef<Mesh>(null!)
  const mat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [])
  const geo = useMemo(() => new PlaneGeometry(1, 1), [])
  const active = scene === k

  useEffect(() => {
    let t = plateCache.get(spec.file)
    if (!t) {
      t = new TextureLoader().load(spec.file, () => rig.wake(900))
      t.colorSpace = SRGBColorSpace
      plateCache.set(spec.file, t)
    }
    mat.map = t; mat.needsUpdate = true
    return () => { mat.dispose(); geo.dispose() }
  }, [spec.file, mat, geo])

  // place the plate on the far side of the stage, square to the home camera
  useEffect(() => {
    const f = framing(size.width, size.height, 0)
    const tilt = lockedTilt(SCENE_LOOK[k].camHeight!, f.dist)
    const cam = new PerspectiveCamera((Math.atan(f.tanH) * 360) / Math.PI, size.width / size.height, 8, 4000)
    cam.setViewOffset(size.width, size.height, -f.cx, -f.cy, size.width, size.height)
    cam.position.set(0, PIVOT_Y + f.dist * Math.sin(tilt), f.dist * Math.cos(tilt))
    cam.lookAt(0, PIVOT_Y, 0)
    cam.updateMatrixWorld(); cam.updateProjectionMatrix()
    const fwd = new Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
    const up = new Vector3(0, 1, 0).applyQuaternion(cam.quaternion)
    /** world point on the plate plane seen at a screen position (ndc) */
    const onPlate = (nx: number, ny: number) => {
      const dir = new Vector3(nx, ny, 0.5).unproject(cam).sub(cam.position).normalize()
      return dir.multiplyScalar(PLATE_DIST / dir.dot(fwd)).add(cam.position)
    }
    const viewH = 2 * PLATE_DIST * f.tanH
    const viewW = viewH * (size.width / size.height)
    // the photo row `line` must pass through this point of the bottle
    const ndc = new Vector3(0, spec.lineY, 0).project(cam)
    const anchor = onPlate(ndc.x, ndc.y)
    const toTop = onPlate(ndc.x, 1).distanceTo(anchor)
    const toBottom = onPlate(ndc.x, -1).distanceTo(anchor)
    // cover the viewport, apply the art directed scale, never leave a gap
    const hgt = Math.max(Math.max(viewH, viewW / spec.aspect) * spec.scale, toTop / spec.line, toBottom / (1 - spec.line)) * 1.002
    const m = mesh.current
    m.scale.set(hgt * spec.aspect, hgt, 1)
    m.position.copy(anchor).addScaledVector(up, (spec.line - 0.5) * hgt)
    m.quaternion.copy(cam.quaternion)
    rig.wake()
  }, [size.width, size.height, insets, k, spec])

  useFrame((_, dt) => {
    const goal = active ? 1 : 0
    if (mat.opacity !== goal) {
      mat.opacity = Math.min(1, Math.max(0, mat.opacity + Math.sign(goal - mat.opacity) * dt / 0.55))
      mesh.current.visible = mat.opacity > 0.001
      rig.wake(200)
    }
  })
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={active ? -1.5 : -2} visible={false} frustumCulled={false} />
}

function Plates() {
  const scene = useStore((s) => s.scene)
  const seen = useRef(new Set<SceneKey>())
  if (PLATES[scene]) seen.current.add(scene)
  return <>{[...seen.current].map((k) => <Plate key={k} k={k} spec={PLATES[k]!} />)}</>
}

/* ------------------------------------------------------------------ */
/* Ground shadows, baked once (scripts in qa/) because a round bottle   */
/* casts the same shadow however it is turned                          */
/* ------------------------------------------------------------------ */
export const SHADOW_SIZE = 90 // cm, side of the baked square
export const SHADOW_CENTRE: [number, number, number] = [4, 0.03, -6]
const shadowTex = new Map<string, Texture>()
function shadowTexture(name: string) {
  let t = shadowTex.get(name)
  if (!t) { t = new TextureLoader().load(`/tex/shadow/${name}.webp`, () => rig.wake(600)); shadowTex.set(name, t) }
  return t
}

function Shadows() {
  const scene = useStore((s) => s.scene)
  const view = useStore((s) => s.view)
  const look = LOOKS[scene].shadow
  const single = useRef<MeshBasicMaterial>(null!)
  const range = useRef<MeshBasicMaterial>(null!)
  const geo = useMemo(() => { const g = new PlaneGeometry(SHADOW_SIZE, SHADOW_SIZE); g.rotateX(-Math.PI / 2); return g }, [])
  const wantRange = useRef(false)
  if (view === 'range') wantRange.current = true
  useFrame(() => {
    const r = smooth((rig.rangeT - 0.55) / 0.45)
    const o = look.opacity * rig.reveal
    single.current.opacity = o * (1 - r)
    if (range.current) range.current.opacity = o * r
  })
  return (
    <group position={SHADOW_CENTRE}>
      <mesh geometry={geo} renderOrder={-1}>
        <meshBasicMaterial ref={single} color={look.color} alphaMap={shadowTexture(`${look.set}_single`)} transparent depthWrite={false} opacity={0} />
      </mesh>
      {wantRange.current && (
        <mesh geometry={geo} renderOrder={-1}>
          <meshBasicMaterial ref={range} color={look.color} alphaMap={shadowTexture(`${look.set}_range`)} transparent depthWrite={false} opacity={0} />
        </mesh>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
function Progress() {
  useEffect(() => {
    const prev = DefaultLoadingManager.onProgress
    DefaultLoadingManager.onProgress = (_url, loaded, total) => {
      const p = 0.35 + 0.6 * (loaded / Math.max(total, 4))
      if (p > useStore.getState().progress) useStore.setState({ progress: Math.min(0.97, p) })
    }
    return () => { DefaultLoadingManager.onProgress = prev }
  }, [])
  return null
}

export default function Stage() {
  const quality = useStore((s) => s.quality)
  const canvasKey = useStore((s) => s.canvasKey)
  return (
    <Canvas
      key={`${canvasKey}:${quality.post ? 'p' : 'n'}`}
      className="stage"
      frameloop="demand"
      shadows={!!BAKE}
      dpr={quality.dprStart}
      gl={{ antialias: !quality.post, alpha: false, stencil: false, powerPreference: 'high-performance' }}
      camera={{ fov: 28, near: 8, far: 4000, position: [0, 14, 78] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = NeutralToneMapping
        gl.toneMappingExposure = 1
        gl.setClearColor('#0B271D', 1)
        scene.environmentIntensity = 0
        resetSurfaceMaps()
        initTextures(gl, quality.ktx2)
        const el = gl.domElement
        el.addEventListener('webglcontextlost', (e) => {
          if (!el.isConnected) return // our own teardown of a replaced canvas, not a real loss
          e.preventDefault(); useStore.setState({ webgl: 'lost' })
        })
        el.addEventListener('webglcontextrestored', () => {
          if (!el.isConnected) return
          // rebuild the whole canvas; every file comes back from the HTTP cache
          const s = useStore.getState()
          useStore.setState({ webgl: 'ok', canvasKey: s.canvasKey + 1, phase: s.phase === 'hero' ? 'hero' : 'loading', ready: false })
        })
      }}
    >
      <Progress />
      <Suspense fallback={null}>
        <Environment files="/env/studio_small_09_384.hdr" />
        <Lights />
        <Sweep />
        <Plates />
        <Bottles />
        {BAKE ? <BakeShadows set={BAKE} /> : <Shadows />}
        <Rig />
      </Suspense>
      {quality.post && !BAKE && <Suspense fallback={null}><Post /></Suspense>}
      <Governor />
    </Canvas>
  )
}
