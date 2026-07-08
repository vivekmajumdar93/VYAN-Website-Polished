'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, DepthOfField } from '@react-three/postprocessing'
import { GATEWAYS } from '@/lib/vistara/gateways'
import { KnowledgeStreams } from './KnowledgeStreams'
import { SacredGeometry }  from './SacredGeometry'
import { GatewayOrbs }     from './GatewayOrbs'
import { CameraRig }       from './CameraRig'
import { VoidBackground, GodRays, ProceduralEvents } from './VoidAtmosphere'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

function Scene({ onOrbHover, onOrbClick, hoveredId, activeId }: VistaraSceneProps) {
  return (
    <>
      {/* L1 — Void background image */}
      <VoidBackground />

      {/* L2 — Knowledge streams + crimson veins */}
      <KnowledgeStreams />

      {/* L3 — Floating sacred geometry */}
      <SacredGeometry />

      {/* L5 — God rays */}
      <GodRays />

      {/* L6 — Product orbs */}
      <GatewayOrbs
        gateways={GATEWAYS}
        onHover={onOrbHover}
        onClick={onOrbClick}
        hoveredId={hoveredId}
        activeId={activeId}
      />

      {/* L7 — Camera motion */}
      <CameraRig />

      {/* L8 — Procedural events (ripple waves) */}
      <ProceduralEvents />

      {/* Post FX */}
      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.04}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
        <DepthOfField
          focusDistance={0.0}
          focalLength={0.04}
          bokehScale={2.5}
        />
        <Vignette darkness={0.65} offset={0.3} />
      </EffectComposer>
    </>
  )
}

export function VistaraScene(props: VistaraSceneProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const dpr: [number, number] = [1, Math.min(window.devicePixelRatio, 2)]

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        zIndex: 1,
        background: '#01020e',
      }}
    >
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ fov: 55, near: 0.1, far: 200, position: [0, 0, 8] }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        dpr={dpr}
        frameloop="always"
      >
        <fog attach="fog" args={['#010510', 18, 90]} />
        <Scene {...props} />
      </Canvas>
    </div>,
    document.body,
  )
}
