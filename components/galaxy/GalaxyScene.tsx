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
import HyperWarpEffect from './HyperWarpEffect'
import { useGalaxyStore, PRIMARY_GALAXY, VOID_GALAXY } from '@/lib/store'

function Effects() {
  const bloom = useGalaxyStore((s) => s.settings.bloom)
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloom}
        luminanceThreshold={0.16}
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
      camera={{ far: 800 }}
      style={{ background: '#000' }}
    >
      <color attach="background" args={[0x000000]} />
      <PerspectiveCamera makeDefault position={[0, 3.4, 9]} fov={52} near={0.1} far={800} />
      <OrbitControls
        ref={controlsRef as any}
        enablePan={false}
        enableZoom={false}     /* scroll is reserved for the tour */
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={0.75}
      />
      <CameraRig controls={controlsRef} />

      <Suspense fallback={null}>
        <Starfield count={11000} />

        <group position={PRIMARY_GALAXY.position} rotation={PRIMARY_GALAXY.rotation}>
          <Nebula />
          <Galaxy />
          <LensFlare />
          <Nodes filterGalaxy="primary" />
        </group>

        <group position={VOID_GALAXY.position} rotation={VOID_GALAXY.rotation}>
          <Nebula />
          <Galaxy />
          <LensFlare />
          <Nodes filterGalaxy="void" />
        </group>

        <HyperWarpEffect />
      </Suspense>

      <Effects />
    </Canvas>
  )
}
