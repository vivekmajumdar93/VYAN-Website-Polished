'use client'
import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import { Vector2 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Suspense } from 'react'
import Galaxy from './Galaxy'
import Core from './Core'
import LensFlare from './LensFlare'
import OrbitTrails from './OrbitTrails'
import Nodes from './Nodes'
import Starfield from './Starfield'
import Nebula from './Nebula'
import CameraRig from './CameraRig'
import { useGalaxyStore } from '@/lib/store'

function Effects() {
  const bloom = useGalaxyStore((s) => s.settings.bloom)
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.04}
        luminanceSmoothing={0.85}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
        blendFunction={BlendFunction.ADD}
      />
      <ChromaticAberration
        offset={new Vector2(0.0009, 0.0012)}
        radialModulation={true}
        modulationOffset={0.4}
        blendFunction={BlendFunction.NORMAL}
      />
      <Vignette eskil={false} offset={0.18} darkness={0.92} />
    </EffectComposer>
  )
}

export default function GalaxyScene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      style={{ background: '#000' }}
    >
      <color attach="background" args={[0x000000]} />
      <PerspectiveCamera makeDefault position={[0, 3.4, 9]} fov={52} />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraRig controls={controlsRef} />

      <Suspense fallback={null}>
        <Starfield count={5000} />

        {/* Tilt the galactic plane for cinematic look */}
        <group rotation={[Math.PI * 0.22, 0, Math.PI * 0.07]}>
          <Nebula />
          <Galaxy />
          <OrbitTrails />
          <Nodes />
          <LensFlare />
          <Core />
        </group>
      </Suspense>

      <Effects />
    </Canvas>
  )
}
