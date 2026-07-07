'use client'

import { useEffect, useRef } from 'react'
import {
  playPhase1Hum,
  playPhase2Whispers,
  playPhase3Resonance,
  playPhase4Crack,
  playPhase5Bloom,
  playPhase6Arrival,
  disposeAudio,
} from '@/lib/audioContext'
import type { NeuralBloomPhase } from '@/types/neuralBloom'

const phaseSounds: Partial<Record<NeuralBloomPhase, () => void>> = {
  1: playPhase1Hum,
  2: playPhase2Whispers,
  3: playPhase3Resonance,
  4: playPhase4Crack,
  5: playPhase5Bloom,
  6: playPhase6Arrival,
}

export function useAudioEngine(
  phase: NeuralBloomPhase,
  audioEnabled: boolean,
  active: boolean,
): void {
  const firedRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!active) {
      firedRef.current.clear()
      return
    }
    if (!audioEnabled) return
    if (phase === 0) return
    if (firedRef.current.has(phase)) return

    firedRef.current.add(phase)
    const fn = phaseSounds[phase]
    if (fn) fn()
  }, [phase, audioEnabled, active])

  useEffect(() => {
    if (!active) {
      firedRef.current.clear()
    }
  }, [active])

  useEffect(() => {
    return () => { disposeAudio() }
  }, [])
}
