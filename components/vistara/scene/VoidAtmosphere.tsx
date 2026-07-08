'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Background void image ──────────────────────────────────────────────────────
export function VoidBackground() {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef  = useRef<THREE.MeshBasicMaterial>(null)

  useEffect(() => {
    const loader = new THREE.TextureLoader()
    const src = typeof window !== 'undefined' && window.innerWidth <= 768
      ? '/02594BF3-E885-4D46-92BF-0187367C0AC6.png'
      : '/D0070A92-4437-4E55-9AC1-08A7AD47EA1A.png'
    loader.load(src, tex => {
      if (matRef.current) {
        matRef.current.map = tex
        matRef.current.needsUpdate = true
      }
    })
  }, [])

  return (
    <mesh ref={meshRef} position={[0, 0, -22]} scale={[32, 20, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        transparent
        opacity={0.22}
        color="#1a2060"
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── God rays — soft light shafts ───────────────────────────────────────────────
const RAY_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const RAY_FRAG = `
uniform float time;
uniform vec3  rayColor;
uniform float opacity;
varying vec2 vUv;

void main() {
  // Vertical falloff
  float fy = 1.0 - abs(vUv.y - 0.5) * 2.0;
  fy = pow(fy, 2.5);
  // Horizontal bell curve
  float fx = 1.0 - abs(vUv.x - 0.5) * 2.0;
  fx = pow(fx, 1.5);
  // Slow shimmer
  float shimmer = 0.8 + 0.2 * sin(time * 0.4 + vUv.y * 6.0);
  float alpha = fx * fy * shimmer * opacity;
  gl_FragColor = vec4(rayColor, alpha);
}
`

interface RayConfig {
  pos: [number, number, number]
  rot: [number, number, number]
  scale: [number, number, number]
  color: string
  opacity: number
  shimmerOffset: number
}

const RAY_CONFIGS: RayConfig[] = [
  { pos: [1, 3, -8],  rot: [0, 0, 0.1],  scale: [2, 8, 1],  color: '#7090ff', opacity: 0.06, shimmerOffset: 0 },
  { pos: [-2, 4, -7], rot: [0, 0, -0.15], scale: [1.5, 7, 1], color: '#5060dd', opacity: 0.05, shimmerOffset: 1.2 },
  { pos: [3, 2, -9],  rot: [0, 0, 0.25],  scale: [1.2, 6, 1], color: '#8090ee', opacity: 0.04, shimmerOffset: 2.4 },
  { pos: [-4, 1, -6], rot: [0, 0, -0.08], scale: [0.9, 5, 1], color: '#6080ff', opacity: 0.05, shimmerOffset: 3.6 },
]

export function GodRays() {
  const matsRef = useRef<THREE.ShaderMaterial[]>([])

  const mats = useMemo(() =>
    RAY_CONFIGS.map((rc, i) => {
      const m = new THREE.ShaderMaterial({
        vertexShader:   RAY_VERT,
        fragmentShader: RAY_FRAG,
        uniforms: {
          time:     { value: rc.shimmerOffset },
          rayColor: { value: new THREE.Color(rc.color) },
          opacity:  { value: rc.opacity },
        },
        transparent: true,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        side:        THREE.DoubleSide,
      })
      matsRef.current[i] = m
      return m
    }), [])

  useFrame((_, delta) => {
    mats.forEach(m => { m.uniforms.time.value += delta })
  })

  return (
    <>
      {RAY_CONFIGS.map((rc, i) => (
        <mesh key={i} position={rc.pos} rotation={rc.rot} scale={rc.scale}>
          <planeGeometry args={[1, 1]} />
          <primitive object={mats[i]} attach="material" />
        </mesh>
      ))}
    </>
  )
}

// ── Procedural events — occasional waves / geometry flashes ──────────────────
const WAVE_VERT = `
uniform float time;
uniform float radius;
varying float vFade;

void main() {
  float angle = atan(position.y, position.x);
  float r = radius;
  vFade = 1.0 - r / 8.0;
  vec3 p = normalize(position) * r;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`
const WAVE_FRAG = `
uniform vec3  waveColor;
varying float vFade;

void main() {
  gl_FragColor = vec4(waveColor, max(vFade, 0.0) * 0.15);
}
`

export function ProceduralEvents() {
  const waveRef   = useRef<THREE.Mesh>(null)
  const waveMat   = useRef<THREE.ShaderMaterial | null>(null)
  const stateRef  = useRef({ active: false, t: 0, nextAt: 4 + Math.random() * 6 })
  const totalTime = useRef(0)

  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: WAVE_VERT,
      fragmentShader: WAVE_FRAG,
      uniforms: {
        time:      { value: 0 },
        radius:    { value: 0 },
        waveColor: { value: new THREE.Color('#8090ff') },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    waveMat.current = m
    return m
  }, [])

  useFrame((_, delta) => {
    totalTime.current += delta
    const s = stateRef.current

    if (!s.active && totalTime.current > s.nextAt) {
      s.active = true
      s.t = 0
    }

    if (s.active) {
      s.t += delta
      const r = s.t * 3.5
      mat.uniforms.radius.value = r
      mat.uniforms.time.value   = totalTime.current
      if (r > 9) {
        s.active = false
        s.nextAt = totalTime.current + 6 + Math.random() * 10
        mat.uniforms.radius.value = 0
      }
    }
  })

  return (
    <mesh ref={waveRef} position={[0, 0, -4]}>
      <sphereGeometry args={[1, 32, 32]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}
