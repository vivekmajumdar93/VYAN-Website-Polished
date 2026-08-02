'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Center, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

type ES = 'dormant'|'listening'|'thinking'|'responding'|'voice-listening'|'voice-active'|'switching'

// Per-state emissive brightness and rotation speed
const BRIGHTNESS: Record<ES, number> = {
  dormant:          0.10,
  listening:        0.28,
  thinking:         0.20,
  responding:       0.36,
  'voice-listening': 0.18,
  'voice-active':   0.44,
  switching:        0.70,
}

const ROT_SPEED: Record<ES, number> = {
  dormant:          0.10,
  listening:        0.18,
  thinking:         0.36,
  responding:       0.14,
  'voice-listening': 0.14,
  'voice-active':   0.24,
  switching:        0.07,
}

function MedhaGLB({ entityState, facultyColor }: { entityState: ES; facultyColor: string }) {
  const { scene: raw } = useGLTF('/models/medha.glb')
  // Clone so material mutations don't affect the cache
  const scene = useMemo(() => raw.clone(true), [raw])
  const groupRef = useRef<THREE.Group>(null)
  const clock = useRef(0)

  // Auto-scale to ~2.2 world units tall so it fills the frame nicely
  const autoScale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    return maxDim > 0.001 ? 2.2 / maxDim : 1.0
  }, [scene])

  const emissive = useMemo(() => new THREE.Color(facultyColor), [facultyColor])
  const brightness = BRIGHTNESS[entityState]

  // Push faculty color into every mesh's emissive channel
  useEffect(() => {
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      mats.forEach(m => {
        const mat = m as THREE.MeshStandardMaterial
        if (mat.isMeshStandardMaterial) {
          mat.emissive.copy(emissive)
          mat.emissiveIntensity = brightness
          mat.needsUpdate = true
        }
      })
    })
  }, [scene, emissive, brightness])

  useFrame((_, delta) => {
    clock.current += delta
    const g = groupRef.current
    if (!g) return

    // Slow continuous Y rotation
    g.rotation.y += ROT_SPEED[entityState] * delta

    // Gentle hover float
    g.position.y = Math.sin(clock.current * 0.38) * 0.05

    // Thinking: subtle Z sway
    if (entityState === 'thinking') {
      g.rotation.z = Math.sin(clock.current * 1.7) * 0.028
    } else {
      g.rotation.z += (0 - g.rotation.z) * delta * 2.5
    }

    // Scale pulse during mode-switch bloom
    const tgt = entityState === 'switching' ? 1.07 : 1.0
    const cs = g.scale.x
    g.scale.setScalar(cs + (tgt - cs) * Math.min(delta * 3.5, 1))
  })

  return (
    <group ref={groupRef}>
      <Center>
        <primitive object={scene} scale={autoScale} />
      </Center>
    </group>
  )
}

interface Props {
  entityState: ES
  facultyColor: string
}

// Preload so the model is ready when the page mounts
useGLTF.preload('/models/medha.glb')

export function MedhaModel3D({ entityState, facultyColor }: Props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0.25, 3.4], fov: 44, near: 0.1, far: 100 }}
        style={{ background: 'transparent' }}
      >
        {/* Ambient fill */}
        <ambientLight intensity={0.55} />
        {/* Key light — warm front-top */}
        <directionalLight position={[1.2, 3, 2.5]} intensity={1.4} color="#ffe8d0" />
        {/* Rim light — cool back */}
        <directionalLight position={[-2, 1, -2]} intensity={0.5} color="#8090ff" />
        {/* Faculty accent point light */}
        <pointLight position={[0, 1.2, 2]} intensity={1.0} color={facultyColor} distance={8} />

        <Suspense fallback={null}>
          <MedhaGLB entityState={entityState} facultyColor={facultyColor} />
        </Suspense>
      </Canvas>
    </div>
  )
}
