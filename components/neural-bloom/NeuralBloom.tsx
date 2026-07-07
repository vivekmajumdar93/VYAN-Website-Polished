'use client'

/**
 * NeuralBloom — full 2.2-second Medhā consciousness transition.
 *
 * Renders in a React portal (position:fixed, zIndex:9999) above everything.
 * Phases: Selection → Convergence → Neural Bloom → Reality Fracture
 *          → Dimensional Passage → Reconstruction → Consciousness Lock
 *
 * onComplete fires after Phase 7 → caller navigates to /medha.
 */

import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { Vector3 } from 'three'
import { useNeuralBloomStore } from '@/stores/neuralBloomStore'
import { TOTAL_DURATION, PARTICLE_QUALITY } from '@/constants/neuralBloom'
import { useTimelineSync } from '@/hooks/useTimelineSync'
import { OrbMesh } from './OrbMesh'
import { ParticleEngine } from './ParticleEngine'
import { NeuralLinks } from './NeuralLinks'
import { FractureMask } from './FractureMask'
import { ReconstructionLayer } from './ReconstructionLayer'
import { CameraRig } from './CameraRig'
import { AudioSync } from './AudioSync'
import { MedhaEffects } from '@/postprocessing/MedhaEffects'
import type { NeuralBloomProps } from '@/types/neuralBloom'

const DEFAULT_ORB = new Vector3(0, 0, 0)

/** Inner scene — runs inside the R3F Canvas */
function BloomScene({ onComplete }: { onComplete: () => void }) {
  const phase                  = useNeuralBloomStore(s => s.phase)
  const elapsed                = useNeuralBloomStore(s => s.elapsed)
  const active                 = useNeuralBloomStore(s => s.active)
  const paused                 = useNeuralBloomStore(s => s.paused)
  const cancelled              = useNeuralBloomStore(s => s.cancelled)
  const orbPosition            = useNeuralBloomStore(s => s.orbPosition)
  const attractorStrength      = useNeuralBloomStore(s => s.particleAttractorStrength)
  const bloomIntensity         = useNeuralBloomStore(s => s.bloomIntensity)
  const chromaticAberration    = useNeuralBloomStore(s => s.chromaticAberration)
  const neuralLinkCount        = useNeuralBloomStore(s => s.neuralLinkCount)
  const fractureProgress       = useNeuralBloomStore(s => s.fractureProgress)
  const reconstructionProgress = useNeuralBloomStore(s => s.reconstructionProgress)
  const audioEnabled           = useNeuralBloomStore(s => s.audioEnabled)
  const reducedMotion          = useNeuralBloomStore(s => s.reducedMotion)
  const quality                = useNeuralBloomStore(s => s.quality)
  const reset                  = useNeuralBloomStore(s => s.reset)

  const completedRef = useRef(false)

  // Drive the timeline tick via rAF
  useTimelineSync()

  // Completion: fire when phase 7 ends
  useEffect(() => {
    if (!completedRef.current && elapsed >= TOTAL_DURATION && active) {
      completedRef.current = true
      reset()
      onComplete()
    }
  }, [elapsed, active, onComplete, reset])

  // Reset completion flag when new transition starts
  useEffect(() => {
    if (active) completedRef.current = false
  }, [active])

  // Keyboard: Escape = cancel, Space = pause/resume (dev)
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useNeuralBloomStore.getState().cancel()
        setTimeout(() => onComplete(), 450)
      }
      if (e.key === ' ' && process.env.NODE_ENV === 'development') {
        const s = useNeuralBloomStore.getState()
        s.paused ? s.resume() : s.pause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onComplete])

  // Reduced motion: skip to phase 6 immediately
  useEffect(() => {
    if (reducedMotion && active && phase < 6) {
      // Jump timeline forward — set elapsed directly
      useNeuralBloomStore.setState({ elapsed: 1.8, phase: 6 })
    }
  }, [reducedMotion, active, phase])

  // Background color transitions with phase
  const bgColor = phase <= 1
    ? '#000000'
    : phase >= 4
      ? '#1a0a3d'
      : '#000000'

  const config = PARTICLE_QUALITY[quality]

  return (
    <>
      {/* Aria live region for accessibility */}
      <axesHelper args={[0]} />

      {/* Camera */}
      <CameraRig phase={phase} elapsed={elapsed} orbPosition={orbPosition} />

      {/* Audio */}
      <AudioSync phase={phase} audioEnabled={audioEnabled} active={active} />

      {/* Environment */}
      <color attach="background" args={[bgColor]} />
      <ambientLight intensity={0.1} />

      {/* The orb — visible phases 1-5 */}
      {phase >= 1 && phase <= 5 && (
        <OrbMesh phase={phase} elapsed={elapsed} position={orbPosition} />
      )}

      {/* 120k-particle GPU swarm — phases 1-6 */}
      {phase >= 1 && phase <= 6 && (
        <ParticleEngine
          phase={phase}
          elapsed={elapsed}
          attractorStrength={attractorStrength}
          orbPosition={orbPosition}
          quality={quality}
          cancelled={cancelled}
        />
      )}

      {/* Neural links — phase 3 */}
      {phase >= 3 && phase <= 4 && (
        <NeuralLinks
          phase={phase}
          elapsed={elapsed}
          linkCount={neuralLinkCount}
          orbPosition={orbPosition}
        />
      )}

      {/* Voronoi fracture — phase 4-5 */}
      {phase >= 4 && phase <= 5 && (
        <FractureMask
          phase={phase}
          elapsed={elapsed}
          fractureProgress={fractureProgress}
          orbPosition={orbPosition}
        />
      )}

      {/* Reconstruction assembly — phase 6-7 */}
      {phase >= 6 && (
        <ReconstructionLayer
          phase={phase}
          reconstructionProgress={reconstructionProgress}
        />
      )}

      {/* Postprocessing */}
      <MedhaEffects
        phase={phase}
        bloomIntensity={bloomIntensity}
        chromaticAberration={chromaticAberration}
        fractureProgress={fractureProgress}
        usePostprocessing={config.usePostprocessing}
      />
    </>
  )
}

/** Root component — mounts a full-screen R3F Canvas in a portal */
export function NeuralBloom({ active, orbPosition = DEFAULT_ORB, onComplete }: NeuralBloomProps) {
  const start  = useNeuralBloomStore(s => s.start)
  const reset  = useNeuralBloomStore(s => s.reset)
  const storeActive = useNeuralBloomStore(s => s.active)

  // Trigger the store when the parent sets active=true
  useEffect(() => {
    if (active && !storeActive) {
      start(orbPosition)
    }
    if (!active && storeActive) {
      reset()
    }
  }, [active, storeActive, start, reset, orbPosition])

  const handleComplete = useCallback(() => {
    onComplete()
  }, [onComplete])

  // Don't render if not active
  if (!active && !storeActive) return null

  // Must be in browser for createPortal
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Medhā consciousness transition"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'all',
        background: '#000',
      }}
    >
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{
          fov: 50,
          near: 0.1,
          far: 1000,
          position: [0, 0, 6],
        }}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        dpr={[1, Math.min(window.devicePixelRatio, 2)]}
        frameloop="always"
      >
        <BloomScene onComplete={handleComplete} />
      </Canvas>
    </div>,
    document.body,
  )
}
