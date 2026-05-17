'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { nebulaVertex, nebulaFragment } from './shaders'
import { useGalaxyStore } from '@/lib/store'

export default function Nebula() {
  const matRef = useRef<THREE.ShaderMaterial>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)
  const strength = useGalaxyStore((s) => s.settings.nebulaStrength)

  useFrame(({ camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
      matRef.current.uniforms.uStrength.value = strength
    }
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh ref={meshRef} renderOrder={-1} position={[0, 0, -0.2]}>
      <planeGeometry args={[10, 10, 1, 1]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        vertexShader={nebulaVertex}
        fragmentShader={nebulaFragment}
        uniforms={{
          uTime: { value: 0 },
          uStrength: { value: strength },
          uColorInner: { value: new THREE.Color('#2a1eff') },
          uColorOuter: { value: new THREE.Color('#020a3a') },
        }}
      />
    </mesh>
  )
}
