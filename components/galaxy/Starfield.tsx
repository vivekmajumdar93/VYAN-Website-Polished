'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export default function Starfield({ count = 9000 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!)
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // Bias radius toward the center -> denser starfield near the galactic core,
      // sparser at the outer edges of the visible field.
      const r = 18 + Math.pow(Math.random(), 2.6) * 130
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = r * Math.cos(phi)
      positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      // Mostly faint white-blue stars, a few warm pinpoints
      const isWarm = Math.random() < 0.06
      const c = isWarm
        ? new THREE.Color().setHSL(0.04 + Math.random() * 0.05, 0.55, 0.65 + Math.random() * 0.25)
        : new THREE.Color().setHSL(0.58 + Math.random() * 0.10, 0.25, 0.55 + Math.random() * 0.4)
      colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
      // Size: smaller far away to enhance depth
      sizes[i] = (Math.random() * 0.6 + 0.4) * (1 - Math.min(r, 130) / 180)
    }
    return { positions, colors, sizes }
  }, [count])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (ref.current) ref.current.rotation.y += delta * 0.003
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]}    count={count} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
