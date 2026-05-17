'use client'
import { useMemo } from 'react'
import * as THREE from 'three'

export default function Starfield({ count = 4000 }: { count?: number }) {
  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      // distribute in a large sphere
      const r = 40 + Math.random() * 40
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = r * Math.cos(phi)
      positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      const c = new THREE.Color().setHSL(0.6 + Math.random() * 0.15, 0.4, 0.7 + Math.random() * 0.3)
      colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
      sizes[i] = Math.random() * 1.5 + 0.4
    }
    return { positions, colors, sizes }
  }, [count])

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial size={0.06} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  )
}
