'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { Suspense } from 'react'
import Galaxy from './Galaxy'
import Core from './Core'
import LensFlare from './LensFlare'
import OrbitTrails from './OrbitTrails'
import Nodes from './Nodes'
import Starfield from './Starfield'

export default function GalaxyScene() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      style={{ background: '#000' }}
    >
      <color attach="background" args={[0x000000]} />
      <PerspectiveCamera makeDefault position={[0, 3.2, 8.5]} fov={55} />
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2.1}
      />

      <Suspense fallback={null}>
        {/* Distant starfield */}
        <Starfield count={4500} />

        {/* Tilt the whole galaxy disc for cinematic look */}
        <group rotation={[Math.PI * 0.22, 0, Math.PI * 0.08]}>
          <Galaxy />
          <OrbitTrails />
          <Nodes />
          <LensFlare />
          <Core />
        </group>
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.4}
          luminanceThreshold={0.05}
          luminanceSmoothing={0.85}
          mipmapBlur
          kernelSize={KernelSize.LARGE}
          blendFunction={BlendFunction.ADD}
        />
        <Vignette eskil={false} offset={0.15} darkness={0.85} />
      </EffectComposer>
    </Canvas>
  )
}
