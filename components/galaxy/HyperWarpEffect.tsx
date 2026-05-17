'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useGalaxyStore } from '@/lib/store'

// Star Wars / Star Trek style radial streaks during portal warp.
// Particles sit on a sphere around the camera and stretch outward via velocity.
export default function HyperWarpEffect() {
  const ref = useRef<THREE.Points>(null!)
  const matRef = useRef<THREE.PointsMaterial>(null!)
  const isWarping = useGalaxyStore((s) => s.isWarping)
  const opacityRef = useRef(0)

  const COUNT = 600
  const { positions } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3
      // distribute on a wide cylinder oriented along Z (camera-forward)
      const theta = Math.random() * Math.PI * 2
      const r = 1.5 + Math.random() * 6
      const z = (Math.random() - 0.5) * 50
      positions[i3]     = Math.cos(theta) * r
      positions[i3 + 1] = Math.sin(theta) * r
      positions[i3 + 2] = z
    }
    return { positions }
  }, [])

  useFrame(({ camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    // Fade in/out based on warp state
    const targetOpacity = isWarping ? 1.0 : 0.0
    opacityRef.current += (targetOpacity - opacityRef.current) * Math.min(delta * 6, 0.3)

    if (!ref.current || !matRef.current) return
    matRef.current.opacity = opacityRef.current

    // Place around camera, oriented toward look direction
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    ref.current.position.copy(camera.position).add(forward.clone().multiplyScalar(8))
    ref.current.lookAt(camera.position)

    // Streak animation: cycle z
    const positions = ref.current.geometry.attributes.position as THREE.BufferAttribute
    const arr = positions.array as Float32Array
    const advance = (isWarping ? 60 : 0) * delta
    for (let i = 2; i < arr.length; i += 3) {
      arr[i] += advance
      if (arr[i] > 25) arr[i] -= 50
    }
    positions.needsUpdate = true
  })

  return (
    <points ref={ref} frustumCulled={false} renderOrder={20}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={positions.length / 3} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        size={0.15}
        color={'#cfdaff'}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
