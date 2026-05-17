'use client'
import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { nebulaVertex, nebulaFragment } from './shaders'
import { useGalaxyStore } from '@/lib/store'

export default function Nebula() {
  const matRef = useRef<THREE.ShaderMaterial>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)
  const nebulaStrength = useGalaxyStore((s) => s.settings.nebulaStrength)

  useFrame(({ camera }, deltaRaw) => {
    const delta = Math.min(deltaRaw, 1 / 30)
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
      matRef.current.uniforms.uStrength.value = nebulaStrength
    }
    // Billboard the nebula toward the camera so it always reads as volumetric haze
    if (meshRef.current) meshRef.current.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh ref={meshRef} renderOrder={-1} position={[0, 0, -0.2]}>
      <planeGeometry args={[14, 14, 1, 1]} />
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
          uStrength: { value: nebulaStrength },
          uColorCore:  { value: new THREE.Color('#ff1a2e') },
          uColorMid:   { value: new THREE.Color('#3a0d52') },
          uColorOuter: { value: new THREE.Color('#0a1a55') },
        }}
      />
    </mesh>
  )
}
