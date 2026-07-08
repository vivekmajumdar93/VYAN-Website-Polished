'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Geometry lives DEEP in the void — z: -14 to -28.
// Opacity 0.025–0.06: barely perceived, felt not seen.
// Sizes are large but distance makes them appear subtle.

interface GeoItem {
  geo: THREE.BufferGeometry
  pos: [number, number, number]
  rot: [number, number, number]
  speed: [number, number, number]
  color: string
  opacity: number
}

export function SacredGeometry() {
  const items: GeoItem[] = useMemo(() => [
    {
      geo: new THREE.IcosahedronGeometry(3.5, 1),
      pos: [6, 4, -22], rot: [0.3, 0.5, 0.1],
      speed: [0.00018, 0.00010, 0.00007],
      color: '#6080ee', opacity: 0.035,
    },
    {
      geo: new THREE.OctahedronGeometry(2.8, 0),
      pos: [-7, 2, -18], rot: [0.8, 0.2, 0.4],
      speed: [0.00015, 0.00020, 0.00009],
      color: '#7090dd', opacity: 0.04,
    },
    {
      geo: new THREE.DodecahedronGeometry(4.5, 0),
      pos: [1, -3, -28], rot: [0, 0.3, 0],
      speed: [0.00006, 0.00009, 0.00004],
      color: '#5065cc', opacity: 0.025,
    },
    {
      geo: new THREE.TetrahedronGeometry(2.0, 0),
      pos: [-9, 5, -20], rot: [0.5, 0.8, 0.2],
      speed: [0.00030, 0.00035, 0.00015],
      color: '#8090cc', opacity: 0.03,
    },
    // Torus rings — huge, deep, barely lit
    {
      geo: new THREE.TorusGeometry(5, 0.04, 4, 128),
      pos: [2, 3, -20], rot: [1.1, 0.3, 0.5],
      speed: [0.00010, 0.00007, 0.00005],
      color: '#7080cc', opacity: 0.04,
    },
    {
      geo: new THREE.TorusGeometry(3, 0.03, 4, 96),
      pos: [-5, 1, -16], rot: [0.4, 1.2, 0.6],
      speed: [0.00022, 0.00018, 0.00015],
      color: '#6070bb', opacity: 0.045,
    },
    {
      geo: new THREE.TorusGeometry(7, 0.025, 4, 160),
      pos: [0, -4, -26], rot: [0.12, 0.2, 0],
      speed: [0.00004, 0.00003, 0.00002],
      color: '#4858aa', opacity: 0.025,
    },
    {
      geo: new THREE.TorusGeometry(2.2, 0.03, 4, 80),
      pos: [7, -2, -14], rot: [1.5, 0.3, 0.4],
      speed: [0.00025, 0.00028, 0.00022],
      color: '#7888cc', opacity: 0.05,
    },
  ], [])

  const meshRefs = useRef<(THREE.Mesh | null)[]>(items.map(() => null))

  useFrame(() => {
    items.forEach((item, i) => {
      const m = meshRefs.current[i]
      if (!m) return
      m.rotation.x += item.speed[0]
      m.rotation.y += item.speed[1]
      m.rotation.z += item.speed[2]
    })
  })

  return (
    <group>
      {items.map((item, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el }}
          geometry={item.geo}
          position={item.pos}
          rotation={item.rot}
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
