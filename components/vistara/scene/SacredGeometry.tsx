'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface GeoItem {
  geo: THREE.BufferGeometry
  pos: [number, number, number]
  rot: [number, number, number]
  scale: number
  speed: [number, number, number]
  color: string
  opacity: number
}

export function SacredGeometry() {
  const groupRef = useRef<THREE.Group>(null)

  const items: GeoItem[] = useMemo(() => [
    // Large icosahedron — upper right, behind streams
    {
      geo: new THREE.IcosahedronGeometry(1.8, 1),
      pos: [3.5, 2.5, -6], rot: [0.3, 0.5, 0.1], scale: 1,
      speed: [0.00025, 0.00015, 0.0001],
      color: '#7090ff', opacity: 0.10,
    },
    // Octahedron — left side
    {
      geo: new THREE.OctahedronGeometry(1.2, 0),
      pos: [-5, 0.5, -3], rot: [0.8, 0.2, 0.4], scale: 1,
      speed: [0.0002, 0.0003, 0.00012],
      color: '#90c0ff', opacity: 0.12,
    },
    // Dodecahedron — deep background center
    {
      geo: new THREE.DodecahedronGeometry(2.2, 0),
      pos: [0, -1, -9], rot: [0, 0.3, 0], scale: 1,
      speed: [0.00008, 0.00012, 0.00005],
      color: '#6070dd', opacity: 0.08,
    },
    // Tetrahedron — small, near-left
    {
      geo: new THREE.TetrahedronGeometry(0.7, 0),
      pos: [-2.5, 2, -1.5], rot: [0.5, 0.8, 0.2], scale: 1,
      speed: [0.0004, 0.0005, 0.0002],
      color: '#a0d0ff', opacity: 0.14,
    },
    // Large torus ring — tilted, upper area
    {
      geo: new THREE.TorusGeometry(2.5, 0.025, 6, 96),
      pos: [1, 2, -5], rot: [1.1, 0.3, 0.5], scale: 1,
      speed: [0.00015, 0.0001, 0.00008],
      color: '#8090ee', opacity: 0.16,
    },
    // Small torus — orbital ring, left cluster
    {
      geo: new THREE.TorusGeometry(1.2, 0.018, 4, 72),
      pos: [-4, 0.5, -2], rot: [0.4, 1.2, 0.6], scale: 1,
      speed: [0.0003, 0.00025, 0.0002],
      color: '#70a0ff', opacity: 0.18,
    },
    // Flat ring — large, almost horizontal
    {
      geo: new THREE.TorusGeometry(3.8, 0.015, 4, 128),
      pos: [0, -2, -4], rot: [0.15, 0.2, 0], scale: 1,
      speed: [0.00006, 0.00004, 0.00002],
      color: '#5060cc', opacity: 0.07,
    },
    // Second ring at right cluster
    {
      geo: new THREE.TorusGeometry(0.9, 0.02, 4, 64),
      pos: [4, -1, -2], rot: [1.5, 0.3, 0.4], scale: 1,
      speed: [0.00035, 0.0004, 0.0003],
      color: '#90b0ff', opacity: 0.15,
    },
  ], [])

  const meshRefs = useRef<(THREE.Mesh | null)[]>(items.map(() => null))

  useFrame((_, delta) => {
    items.forEach((item, i) => {
      const m = meshRefs.current[i]
      if (!m) return
      m.rotation.x += item.speed[0]
      m.rotation.y += item.speed[1]
      m.rotation.z += item.speed[2]
    })
  })

  return (
    <group ref={groupRef}>
      {items.map((item, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el }}
          geometry={item.geo}
          position={item.pos}
          rotation={item.rot}
          scale={item.scale}
        >
          <meshBasicMaterial
            color={item.color}
            wireframe
            transparent
            opacity={item.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}
