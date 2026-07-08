'use client'

import { useRef, useMemo, useCallback, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Gateway } from '@/lib/vistara/gateways'

// ── Fresnel orb shader ────────────────────────────────────────────────────────
const ORB_VERT = `
uniform float time;
uniform float pulse;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vNormal  = normalize(normalMatrix * normal);
  vec4 mv  = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mv.xyz);
  float breathe = 1.0 + sin(time * 1.6 + pulse) * 0.035;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * breathe, 1.0);
}
`
const ORB_FRAG = `
uniform vec3  orbColor;
uniform float time;
uniform float hovered;
uniform float pulse;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), 2.8);
  float glow    = fresnel * (0.7 + hovered * 0.5);

  // Subtle inner shimmer
  float shimmer = 0.5 + 0.5 * sin(time * 3.0 + pulse * 4.0 + vNormal.y * 5.0);
  float inner   = (1.0 - fresnel) * shimmer * 0.12 * (1.0 + hovered);

  vec3  col   = orbColor;
  float alpha = glow * 0.9 + inner;
  alpha = clamp(alpha, 0.0, 0.95);

  gl_FragColor = vec4(col + inner * vec3(0.5, 0.5, 0.8), alpha);
}
`

// ── Emission ring shader ───────────────────────────────────────────────────────
const RING_VERT = `
uniform float time;
uniform float active;
varying float vAlpha;

void main() {
  float angle = atan(position.y, position.x);
  float expand = 1.0 + active * (0.5 + 0.5 * sin(time * 4.0));
  vAlpha = 0.6 + 0.4 * sin(angle * 3.0 + time * 2.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * expand, 1.0);
}
`
const RING_FRAG = `
uniform vec3  orbColor;
uniform float active;
varying float vAlpha;

void main() {
  gl_FragColor = vec4(orbColor, vAlpha * active * 0.5);
}
`

// ── 2D position to 3D world mapping ───────────────────────────────────────────
function gatewayTo3D(gw: Gateway): [number, number, number] {
  return [
    (gw.x / 100 - 0.5) * 9,
    -(gw.y / 100 - 0.5) * 5.5,
    -(1 - gw.depth) * 6,
  ]
}

interface OrbProps {
  gateway: Gateway
  isHovered: boolean
  isActive: boolean
  onHover: (id: string | null) => void
  onClick: (id: string) => void
}

function OrbMesh({ gateway, isHovered, isActive, onHover, onClick }: OrbProps) {
  const meshRef  = useRef<THREE.Mesh>(null)
  const ringRef  = useRef<THREE.Mesh>(null)
  const pos3D    = useMemo(() => gatewayTo3D(gateway), [gateway])
  const orbColor = useMemo(() => new THREE.Color(gateway.color), [gateway.color])
  const pulseOffset = useMemo(() => Math.random() * Math.PI * 2, [])
  const orbR     = 0.12 + gateway.depth * 0.12   // near orbs bigger

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   ORB_VERT,
    fragmentShader: ORB_FRAG,
    uniforms: {
      orbColor: { value: orbColor },
      time:     { value: 0 },
      hovered:  { value: 0 },
      pulse:    { value: pulseOffset },
    },
    transparent: true,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.FrontSide,
  }), [orbColor, pulseOffset])

  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      orbColor: { value: orbColor },
      time:     { value: 0 },
      active:   { value: 0 },
    },
    transparent: true,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.DoubleSide,
  }), [orbColor])

  // Orbit drift — each orb follows its own tiny ellipse
  const orbitRef = useRef({ phase: Math.random() * Math.PI * 2 })

  useFrame((_, delta) => {
    const t = (mat.uniforms.time.value += delta)
    ringMat.uniforms.time.value = t

    const targetHov = isHovered || isActive ? 1 : 0
    mat.uniforms.hovered.value += (targetHov - mat.uniforms.hovered.value) * 0.08
    ringMat.uniforms.active.value += (targetHov - ringMat.uniforms.active.value) * 0.06

    if (meshRef.current) {
      orbitRef.current.phase += gateway.orbitSpeed * 0.5
      const ph = orbitRef.current.phase
      meshRef.current.position.set(
        pos3D[0] + Math.cos(ph) * gateway.orbitRadius * 0.004,
        pos3D[1] + Math.sin(ph * 0.7) * gateway.orbitRadius * 0.003,
        pos3D[2],
      )
      if (ringRef.current) {
        ringRef.current.position.copy(meshRef.current.position)
        ringRef.current.rotation.y = t * 0.3
        ringRef.current.rotation.x = t * 0.15
      }
    }
  })

  return (
    <>
      <mesh
        ref={meshRef}
        position={pos3D}
        onPointerOver={() => onHover(gateway.id)}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(gateway.id) }}
      >
        <sphereGeometry args={[orbR, 32, 32]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Outer glow / emission ring */}
      <mesh ref={ringRef} position={pos3D}>
        <torusGeometry args={[orbR * 1.8, orbR * 0.06, 4, 64]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
    </>
  )
}

// ── Orb particle halo ─────────────────────────────────────────────────────────
const HALO_VERT = `
attribute float life;
attribute float speed;
varying float vLife;
uniform float time;

void main() {
  vLife = life;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 2.5 * (1.0 - life) * (6.0 / max(-mv.z, 0.5));
  gl_Position  = projectionMatrix * mv;
}
`
const HALO_FRAG = `
uniform vec3 haloColor;
varying float vLife;

void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float a = (1.0 - r * 2.0) * (1.0 - vLife) * 0.7;
  gl_FragColor = vec4(haloColor, a);
}
`

function OrbHalo({ gateway, active }: { gateway: Gateway; active: boolean }) {
  const N   = 80
  const pos = useMemo(() => new Float32Array(N * 3), [])
  const lif = useMemo(() => {
    const a = new Float32Array(N)
    for (let i = 0; i < N; i++) a[i] = Math.random()
    return a
  }, [])
  const spd = useMemo(() => {
    const a = new Float32Array(N)
    for (let i = 0; i < N; i++) a[i] = 0.003 + Math.random() * 0.007
    return a
  }, [])
  const center = useMemo(() => gatewayTo3D(gateway), [gateway])
  const color  = useMemo(() => new THREE.Color(gateway.color), [gateway.color])
  const orbR   = 0.12 + gateway.depth * 0.12

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('life',     new THREE.BufferAttribute(lif, 1))
    g.setAttribute('speed',    new THREE.BufferAttribute(spd, 1))
    return g
  }, [pos, lif, spd])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   HALO_VERT,
    fragmentShader: HALO_FRAG,
    uniforms: { haloColor: { value: color }, time: { value: 0 } },
    transparent: true,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
  }), [color])

  const dirRef = useRef<THREE.Vector3[]>(
    Array.from({ length: N }, () =>
      new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ).normalize()
    )
  )

  useFrame((_, delta) => {
    if (!active) {
      // reset all particles
      lif.fill(1)
      const pa = geo.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < N; i++) {
        pa.setXYZ(i, center[0], center[1], center[2])
      }
      pa.needsUpdate = true
      return
    }
    mat.uniforms.time.value += delta
    for (let i = 0; i < N; i++) {
      lif[i] += spd[i]
      if (lif[i] >= 1) {
        lif[i] = 0
        // respawn at random point on orb surface
        const d = dirRef.current[i]
        d.set(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize()
        pos[i*3]   = center[0] + d.x * orbR
        pos[i*3+1] = center[1] + d.y * orbR
        pos[i*3+2] = center[2] + d.z * orbR
      } else {
        const d = dirRef.current[i]
        pos[i*3]   += d.x * 0.006
        pos[i*3+1] += d.y * 0.006
        pos[i*3+2] += d.z * 0.004
      }
    }
    const pa = geo.getAttribute('position') as THREE.BufferAttribute
    pa.array = pos
    pa.needsUpdate = true
    const la = geo.getAttribute('life') as THREE.BufferAttribute
    ;(la.array as Float32Array).set(lif)
    la.needsUpdate = true
  })

  return <points geometry={geo} material={mat} />
}

// ── Main export ───────────────────────────────────────────────────────────────
interface GatewayOrbsProps {
  gateways:  Gateway[]
  onHover:   (id: string | null) => void
  onClick:   (id: string) => void
  activeId:  string | null
  hoveredId: string | null
}

export function GatewayOrbs({ gateways, onHover, onClick, activeId, hoveredId }: GatewayOrbsProps) {
  return (
    <>
      {gateways.map(gw => (
        <group key={gw.id}>
          <OrbMesh
            gateway={gw}
            isHovered={hoveredId === gw.id}
            isActive={activeId === gw.id}
            onHover={onHover}
            onClick={onClick}
          />
          <OrbHalo
            gateway={gw}
            active={hoveredId === gw.id || activeId === gw.id}
          />
        </group>
      ))}
    </>
  )
}
