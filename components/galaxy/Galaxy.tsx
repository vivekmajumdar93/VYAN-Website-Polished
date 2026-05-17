'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { galaxyVertex, galaxyFragment } from './shaders'

type Props = {
  count?: number
  radius?: number
  branches?: number
  spin?: number
  randomness?: number
  randomnessPower?: number
  insideColor?: string
  outsideColor?: string
}

export default function Galaxy({
  count = 220000,
  radius = 5,
  branches = 4,
  spin = 1.1,
  randomness = 0.35,
  randomnessPower = 3.2,
  insideColor = '#ffd6ff',
  outsideColor = '#3a6dff',
}: Props) {
  const materialRef = useRef<THREE.ShaderMaterial>(null!)

  const { positions, colors, scales, randomnessAttr } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const randomnessAttr = new Float32Array(count * 3)

    const colorInside = new THREE.Color(insideColor)
    const colorOutside = new THREE.Color(outsideColor)

    for (let i = 0; i < count; i++) {
      const i3 = i * 3

      // Bias particles toward the center for a bright luminous core
      const r = Math.pow(Math.random(), 1.7) * radius
      const spinAngle = r * spin
      const branchAngle = ((i % branches) / branches) * Math.PI * 2

      const rx = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r
      const ry = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.35
      const rz = Math.pow(Math.random(), randomnessPower) * (Math.random() < 0.5 ? 1 : -1) * randomness * r

      positions[i3] = Math.cos(branchAngle + spinAngle) * r
      positions[i3 + 1] = 0
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r

      randomnessAttr[i3] = rx
      randomnessAttr[i3 + 1] = ry
      randomnessAttr[i3 + 2] = rz

      const mixed = colorInside.clone().lerp(colorOutside, r / radius)
      colors[i3] = mixed.r
      colors[i3 + 1] = mixed.g
      colors[i3 + 2] = mixed.b

      scales[i] = Math.random() * 1.3 + 0.2
    }

    return { positions, colors, scales, randomnessAttr }
  }, [count, radius, branches, spin, randomness, randomnessPower, insideColor, outsideColor])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} count={count} />
        <bufferAttribute attach="attributes-aRandomness" args={[randomnessAttr, 3]} count={count} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        transparent
        vertexShader={galaxyVertex}
        fragmentShader={galaxyFragment}
        uniforms={{
          uTime: { value: 0 },
          uSize: { value: 28 * (typeof window !== 'undefined' ? window.devicePixelRatio : 1) },
        }}
      />
    </points>
  )
}
