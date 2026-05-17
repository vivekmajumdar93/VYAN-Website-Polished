'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

export default function Starfield({ count = 11000 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null!)
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const r = 18 + Math.pow(Math.random(), 2.4) * 200
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = r * Math.cos(phi)
      positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta)

      // Mix of cool blue, warm pink, teal, white. Spread the colourful starfield outward.
      const palette = Math.random()
      let h: number, s: number, l: number
      if (palette < 0.42)      { h = 0.60 + Math.random() * 0.08; s = 0.25; l = 0.6 + Math.random() * 0.35 } // blue/white
      else if (palette < 0.65) { h = 0.92 + Math.random() * 0.06; s = 0.55; l = 0.6 + Math.random() * 0.3 }  // pink/magenta
      else if (palette < 0.82) { h = 0.50 + Math.random() * 0.05; s = 0.7;  l = 0.55 + Math.random() * 0.3 }  // teal
      else                     { h = 0.04 + Math.random() * 0.06; s = 0.5;  l = 0.55 + Math.random() * 0.3 }  // warm amber
      const c = new THREE.Color().setHSL(h, s, l)
      colors[i3] = c.r; colors[i3 + 1] = c.g; colors[i3 + 2] = c.b
    }
    return { positions, colors }
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
        size={0.07}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.95}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
