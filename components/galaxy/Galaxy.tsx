'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { galaxyVertex, galaxyFragment } from './shaders'
import { useGalaxyStore } from '@/lib/store'

const GALAXY_RADIUS = 5.5

export default function Galaxy() {
  const settings = useGalaxyStore((s) => s.settings)
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const buffers = useMemo(() => {
    const count = Math.max(5000, Math.floor(settings.count))
    const branches = Math.max(2, Math.floor(settings.branches))
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const randomness = new Float32Array(count * 3)
    const angles = new Float32Array(count)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)
    const stars = new Float32Array(count)

    const randomnessFactor = 0.11
    const randomnessPower = 3.0

    // Probability of an accent bright cyan star
    const STAR_PROB = 0.012

    for (let i = 0; i < count; i++) {
      // Distribute particles more evenly across the disk for a true disc shape
      const r = Math.pow(Math.random(), 0.85) * GALAXY_RADIUS
      const branch = ((i % branches) / branches) * Math.PI * 2

      angles[i] = branch
      radii[i] = r

      // Disc thickness shrinks toward outside
      const thickness = 0.10 * (1.0 - r / (GALAXY_RADIUS * 1.5))
      heights[i] = (Math.random() - 0.5) * Math.max(thickness, 0.012) * 2.0

      const armWidthScale = (r * 0.35 + 0.12)
      const rx = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomnessFactor * armWidthScale
      const ry = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomnessFactor * 0.08 * armWidthScale
      const rz = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomnessFactor * armWidthScale

      randomness[i * 3 + 0] = rx
      randomness[i * 3 + 1] = ry
      randomness[i * 3 + 2] = rz

      positions[i * 3 + 0] = Math.cos(branch) * r
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(branch) * r

      const coreBias = Math.pow(1.0 - r / GALAXY_RADIUS, 1.3)
      scales[i] = (Math.random() * 0.8 + 0.3) * (0.55 + coreBias * 1.5)

      // Accent bright cyan stars - more likely in the outer disk for the dotted look
      const outerWeight = THREE.MathUtils.smoothstep(r, 1.0, GALAXY_RADIUS)
      const starHit = Math.random() < STAR_PROB * (0.4 + outerWeight)
      stars[i] = starHit ? 1.0 : 0.0
    }

    return { positions, scales, randomness, angles, radii, heights, stars }
  }, [settings.count, settings.branches])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (materialRef.current) {
      const u = materialRef.current.uniforms
      u.uTime.value += delta
      u.uSpin.value = settings.spin
      u.uCoreGlow.value = settings.coreGlow
      u.uDustDensity.value = settings.dustDensity
      u.uGradientIntensity.value = settings.gradientIntensity
      u.uTurbulence.value = settings.turbulence
      u.uSpiralTightness.value = settings.spiralTightness
      u.uStarBrightness.value = settings.starBrightness
    }
  })

  const geomKey = `${settings.count}-${settings.branches}`

  return (
    <points key={geomKey} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position"    args={[buffers.positions, 3]} count={buffers.positions.length / 3} />
        <bufferAttribute attach="attributes-aScale"      args={[buffers.scales, 1]}    count={buffers.scales.length} />
        <bufferAttribute attach="attributes-aRandomness" args={[buffers.randomness, 3]} count={buffers.randomness.length / 3} />
        <bufferAttribute attach="attributes-aAngle"      args={[buffers.angles, 1]}    count={buffers.angles.length} />
        <bufferAttribute attach="attributes-aRadius"     args={[buffers.radii, 1]}     count={buffers.radii.length} />
        <bufferAttribute attach="attributes-aHeight"     args={[buffers.heights, 1]}   count={buffers.heights.length} />
        <bufferAttribute attach="attributes-aStar"       args={[buffers.stars, 1]}     count={buffers.stars.length} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        transparent
        vertexShader={galaxyVertex}
        fragmentShader={galaxyFragment}
        uniforms={{
          uTime: { value: 0 },
          uSize: { value: 32 * (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1) },
          uSpin: { value: settings.spin },
          uTurbulence: { value: settings.turbulence },
          uCoreGlow: { value: settings.coreGlow },
          uDustDensity: { value: settings.dustDensity },
          uGradientIntensity: { value: settings.gradientIntensity },
          uSpiralTightness: { value: settings.spiralTightness },
          uStarBrightness: { value: settings.starBrightness },
          uMaxRadius: { value: GALAXY_RADIUS },
          // White-violet core -> blue mid -> deep cobalt outer
          uColorCore:  { value: new THREE.Color('#e6d8ff') },
          uColorMid:   { value: new THREE.Color('#4a3aff') },
          uColorOuter: { value: new THREE.Color('#0a1a8a') },
          uStarColor:  { value: new THREE.Color('#ff2a44') },
        }}
      />
    </points>
  )
}
