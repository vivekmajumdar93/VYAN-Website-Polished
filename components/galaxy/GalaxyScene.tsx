'use client'
import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Suspense } from 'react'
import Galaxy from './Galaxy'
import LensFlare from './LensFlare'
import Nodes from './Nodes'
import Starfield from './Starfield'
import Nebula from './Nebula'
import CameraRig from './CameraRig'
import { useGalaxyStore, PRIMARY_GALAXY, VOID_GALAXY } from '@/lib/store'

function Effects() {
  const bloom = useGalaxyStore((s) => s.settings.bloom)
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.9}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
        blendFunction={BlendFunction.ADD}
      />
      <Vignette eskil={false} offset={0.22} darkness={0.96} />
    </EffectComposer>
  )
}

export default function GalaxyScene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      dpr={[1, 2]}
      camera={{ far: 600 }}
      style={{ background: '#000' }}
    >
      <color attach="background" args={[0x000000]} />
      <PerspectiveCamera makeDefault position={[0, 3.4, 9]} fov={52} near={0.1} far={600} />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={40}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraRig controls={controlsRef} />

      <Suspense fallback={null}>
        {/* Distant starfield enveloping everything */}
        <Starfield count={9000} />

        {/* Primary galaxy at origin */}
        <group position={PRIMARY_GALAXY.position} rotation={PRIMARY_GALAXY.rotation}>
          <Nebula />
          <Galaxy />
          <LensFlare />
          <Nodes filterGalaxy="primary" />
        </group>

        {/* Void galaxy far away */}
        <group position={VOID_GALAXY.position} rotation={VOID_GALAXY.rotation}>
          <Nebula />
          <Galaxy />
          <LensFlare />
          <Nodes filterGalaxy="void" />
        </group>
      </Suspense>

      <Effects />
    </Canvas>
  )
}
