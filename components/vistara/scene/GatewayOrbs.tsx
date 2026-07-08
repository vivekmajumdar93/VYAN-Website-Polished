'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Gateway } from '@/lib/vistara/gateways'

// ── Orb: a billboarded radial glow sprite, not a 3D ball ─────────────────────
// Two quads per orb: tight core + wide aura. Additive blending = light, not plastic.

const CORE_VERT = `
uniform float time;
uniform float pulse;
varying vec2 vUv;

void main() {
  vUv = uv;
  // Billboard: always face camera
  vec3 right   = vec3(modelViewMatrix[0][0], modelViewMatrix[1][0], modelViewMatrix[2][0]);
  vec3 up      = vec3(modelViewMatrix[0][1], modelViewMatrix[1][1], modelViewMatrix[2][1]);
  float breathe = 1.0 + sin(time * 1.8 + pulse) * 0.06;
  vec3 worldPos = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  worldPos += right * position.x * breathe + up * position.y * breathe;
  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}
`
const CORE_FRAG = `
uniform vec3  orbColor;
uniform float time;
uniform float hovered;
uniform float pulse;
varying vec2 vUv;

void main() {
  vec2  p = vUv - 0.5;
  float r = length(p);
  if (r > 0.5) discard;

  // Tight bright core
  float core  = exp(-r * 16.0);
  // Soft inner glow
  float glow  = exp(-r * 5.0) * 0.6;
  // Edge shimmer ring on hover
  float ring  = smoothstep(0.38, 0.42, r) * smoothstep(0.50, 0.44, r) * hovered;
  float shimmer = 0.8 + 0.2 * sin(time * 4.0 + pulse * 6.0 + r * 20.0);

  float alpha = (core + glow + ring * 0.4) * shimmer * (0.85 + hovered * 0.3);
  vec3  col   = mix(orbColor, vec3(1.0), core * 0.6);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`

const AURA_FRAG = `
uniform vec3  orbColor;
uniform float hovered;
varying vec2 vUv;

void main() {
  vec2  p = vUv - 0.5;
  float r = length(p);
  if (r > 0.5) discard;
  float aura  = exp(-r * 3.5) * (0.18 + hovered * 0.22);
  gl_FragColor = vec4(orbColor, aura);
}
`

// 2D position → 3D world
function to3D(gw: Gateway): [number, number, number] {
  return [
    (gw.x / 100 - 0.5) * 10,
    -(gw.y / 100 - 0.5) * 6,
    -(1 - gw.depth) * 5,
  ]
}

interface OrbProps {
  gateway:   Gateway
  isHovered: boolean
  isActive:  boolean
  onHover:   (id: string | null) => void
  onClick:   (id: string) => void
}

function OrbSprite({ gateway, isHovered, isActive, onHover, onClick }: OrbProps) {
  const coreRef = useRef<THREE.Mesh>(null)
  const auraRef = useRef<THREE.Mesh>(null)
  const pos     = useMemo(() => to3D(gateway), [gateway])
  const color   = useMemo(() => new THREE.Color(gateway.color), [gateway.color])
  const pulse   = useMemo(() => Math.random() * Math.PI * 2, [])

  // Core size scales with depth (near = larger apparent size)
  const coreSize = 0.08 + gateway.depth * 0.08
  const auraSize = coreSize * 5.5

  const coreMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   CORE_VERT,
    fragmentShader: CORE_FRAG,
    uniforms: {
      orbColor: { value: color },
      time:     { value: 0 },
      hovered:  { value: 0 },
      pulse:    { value: pulse },
    },
    transparent: true,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.DoubleSide,
  }), [color, pulse])

  const auraMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   CORE_VERT,
    fragmentShader: AURA_FRAG,
    uniforms: {
      orbColor: { value: color },
      time:     { value: 0 },
      hovered:  { value: 0 },
      pulse:    { value: pulse },
    },
    transparent: true,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    side:        THREE.DoubleSide,
  }), [color, pulse])

  const orbitRef = useRef({ phase: Math.random() * Math.PI * 2 })

  useFrame((_, delta) => {
    const t = (coreMat.uniforms.time.value += delta)
    auraMat.uniforms.time.value = t

    const target = isHovered || isActive ? 1 : 0
    coreMat.uniforms.hovered.value += (target - coreMat.uniforms.hovered.value) * 0.08
    auraMat.uniforms.hovered.value  = coreMat.uniforms.hovered.value

    orbitRef.current.phase += gateway.orbitSpeed * 0.6
    const ph = orbitRef.current.phase
    const ox = Math.cos(ph) * gateway.orbitRadius * 0.005
    const oy = Math.sin(ph * 0.7) * gateway.orbitRadius * 0.003

    if (coreRef.current) coreRef.current.position.set(pos[0]+ox, pos[1]+oy, pos[2])
    if (auraRef.current) auraRef.current.position.set(pos[0]+ox, pos[1]+oy, pos[2])
  })

  return (
    <>
      {/* Invisible hit-target sphere — bigger than the sprite so it's easy to click */}
      <mesh
        position={pos}
        onPointerOver={() => onHover(gateway.id)}
        onPointerOut={() => onHover(null)}
        onClick={e => { e.stopPropagation(); onClick(gateway.id) }}
      >
        <sphereGeometry args={[coreSize * 3, 8, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Wide aura glow */}
      <mesh ref={auraRef} position={pos}>
        <planeGeometry args={[auraSize, auraSize]} />
        <primitive object={auraMat} attach="material" />
      </mesh>

      {/* Tight bright core */}
      <mesh ref={coreRef} position={pos}>
        <planeGeometry args={[coreSize * 2, coreSize * 2]} />
        <primitive object={coreMat} attach="material" />
      </mesh>
    </>
  )
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
        <OrbSprite
          key={gw.id}
          gateway={gw}
          isHovered={hoveredId === gw.id}
          isActive={activeId === gw.id}
          onHover={onHover}
          onClick={onClick}
        />
      ))}
    </>
  )
}
