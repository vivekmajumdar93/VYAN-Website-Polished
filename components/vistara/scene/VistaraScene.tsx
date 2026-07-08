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
import { GodRays, ProceduralEvents } from './VoidAtmosphere'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

function Scene({ onOrbHover, onOrbClick, hoveredId, activeId }: VistaraSceneProps) {
  return (
    <>
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
      {/* Base cosmic void image — HTML layer so it's immune to fog/opacity/texture-load timing */}
      <img
        src={typeof window !== 'undefined' && window.innerWidth <= 768
          ? '/02594BF3-E885-4D46-92BF-0187367C0AC6.png'
          : '/D0070A92-4437-4E55-9AC1-08A7AD47EA1A.png'}
        alt=""
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
      <Canvas
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        camera={{ fov: 55, near: 0.1, far: 200, position: [0, 0, 8] }}
        gl={{
          antialias: true,
          alpha: true,
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
