'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

function Ring({ radius, color, opacity = 0.18, speed = 0.05, segments = 256 }: { radius: number; color: string; opacity?: number; speed?: number; segments?: number }) {
  const ref = useRef<THREE.Line>(null!)
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius, segments])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (ref.current) ref.current.rotation.y += delta * speed
  })

  return (
    // @ts-ignore - three line
    <line ref={ref} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </line>
  )
}

export default function OrbitTrails() {
  return (
    <group>
      <Ring radius={2.2} color="#ff5a6a" opacity={0.22} speed={0.10} />
      <Ring radius={3.4} color="#7a3eff" opacity={0.18} speed={-0.06} />
      <Ring radius={4.6} color="#5b6dff" opacity={0.14} speed={0.04} />
      <Ring radius={5.6} color="#3a7dff" opacity={0.10} speed={-0.02} />
    </group>
  )
}
