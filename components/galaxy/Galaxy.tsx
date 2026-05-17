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

  const { positions, scales, randomness, angles, radii, heights } = useMemo(() => {
    const count = Math.max(5000, Math.floor(settings.count))
    const branches = Math.max(2, Math.floor(settings.branches))
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const randomness = new Float32Array(count * 3)
    const angles = new Float32Array(count)
    const radii = new Float32Array(count)
    const heights = new Float32Array(count)

    const randomnessFactor = 0.32
    const randomnessPower = 3.1

    for (let i = 0; i < count; i++) {
      // Bias toward the center for a luminous core
      const r = Math.pow(Math.random(), 1.85) * GALAXY_RADIUS
      const branch = ((i % branches) / branches) * Math.PI * 2

      angles[i] = branch
      radii[i] = r

      // disc thickness shrinks toward outside
      const thickness = 0.18 * (1.0 - r / (GALAXY_RADIUS * 1.4))
      heights[i] = (Math.random() - 0.5) * Math.max(thickness, 0.02) * 2.0

      const rx = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomnessFactor * (r * 0.65 + 0.2)
      const ry = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomnessFactor * 0.18 * (r * 0.4 + 0.05)
      const rz = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomnessFactor * (r * 0.65 + 0.2)

      randomness[i * 3 + 0] = rx
      randomness[i * 3 + 1] = ry
      randomness[i * 3 + 2] = rz

      // Pre-positions (the shader rotates them dynamically)
      positions[i * 3 + 0] = Math.cos(branch) * r
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(branch) * r

      // Particle size: slightly larger near the core
      const coreBias = Math.pow(1.0 - r / GALAXY_RADIUS, 1.4)
      scales[i] = (Math.random() * 0.9 + 0.35) * (0.6 + coreBias * 1.4)
    }

    return { positions, scales, randomness, angles, radii, heights }
  }, [settings.count, settings.branches])

  useFrame((state, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (materialRef.current) {
      const u = materialRef.current.uniforms
      u.uTime.value += delta
      // Live-tunable uniforms
      u.uSpin.value = settings.spin
      u.uCoreGlow.value = settings.coreGlow
      u.uDustDensity.value = settings.dustDensity
      u.uGradientIntensity.value = settings.gradientIntensity
      u.uTurbulence.value = settings.turbulence
    }
  })

  // Stable key based on geometry-affecting params: triggers safe re-mount + disposal
  const geomKey = `${settings.count}-${settings.branches}`

  return (
    <points key={geomKey} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position"   args={[positions, 3]} count={positions.length / 3} />
        <bufferAttribute attach="attributes-aScale"     args={[scales, 1]}    count={scales.length} />
        <bufferAttribute attach="attributes-aRandomness" args={[randomness, 3]} count={randomness.length / 3} />
        <bufferAttribute attach="attributes-aAngle"     args={[angles, 1]}    count={angles.length} />
        <bufferAttribute attach="attributes-aRadius"    args={[radii, 1]}     count={radii.length} />
        <bufferAttribute attach="attributes-aHeight"    args={[heights, 1]}   count={heights.length} />
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
          uMaxRadius: { value: GALAXY_RADIUS },
          uColorCore:  { value: new THREE.Color('#ff2a3a') },  // intense blood red
          uColorMid:   { value: new THREE.Color('#3a0d4f') },  // dark rich violet
          uColorOuter: { value: new THREE.Color('#1a3cff') },  // deep cosmic blue
        }}
      />
    </points>
  )
}
