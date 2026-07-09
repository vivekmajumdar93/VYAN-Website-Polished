'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
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
        <Vignette darkness={0.55} offset={0.4} />
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000' }}>
      <video
        src="/vistara-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        ref={el => { if (el) el.playbackRate = 0.18 }}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />
    </div>,
    document.body,
  )
}
