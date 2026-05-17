'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

function Ring({ radius, segments = 256, color, opacity = 0.18, speed = 0.05 }: { radius: number; segments?: number; color: string; opacity?: number; speed?: number }) {
  const ref = useRef<THREE.Line>(null!)
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius))
    }
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [radius, segments])

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed
  })

  return (
    // @ts-ignore - three line element
    <line ref={ref} geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} />
    </line>
  )
}

export default function OrbitTrails() {
  return (
    <group>
      <Ring radius={2.2} color="#9b7bff" opacity={0.22} speed={0.08} />
      <Ring radius={3.4} color="#6aa8ff" opacity={0.18} speed={-0.05} />
      <Ring radius={4.6} color="#b58bff" opacity={0.14} speed={0.03} />
      <Ring radius={5.6} color="#7ec8ff" opacity={0.10} speed={-0.02} />
    </group>
  )
}
