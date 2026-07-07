'use client'

import { useCallback } from 'react'
import { Vector3 } from 'three'
import { useNeuralBloomStore } from '@/stores/neuralBloomStore'
import type { QualityTier, NeuralBloomPhase } from '@/types/neuralBloom'

/** Primary hook for controlling and reading Neural Bloom state */
export function useNeuralBloom() {
  const store = useNeuralBloomStore()

  const trigger = useCallback((orbWorldPosition: Vector3) => {
    store.start(orbWorldPosition)
  }, [store])

  const cancel = useCallback(() => {
    store.cancel()
  }, [store])

  return {
    // State
    phase:                    store.phase          as NeuralBloomPhase,
    elapsed:                  store.elapsed,
    progress:                 store.progress,
    active:                   store.active,
    paused:                   store.paused,
    cancelled:                store.cancelled,
    orbPosition:              store.orbPosition,
    particleAttractorStrength: store.particleAttractorStrength,
    bloomIntensity:           store.bloomIntensity,
    chromaticAberration:      store.chromaticAberration,
    neuralLinkCount:          store.neuralLinkCount,
    fractureProgress:         store.fractureProgress,
    reconstructionProgress:   store.reconstructionProgress,
    audioEnabled:             store.audioEnabled,
    reducedMotion:            store.reducedMotion,
    quality:                  store.quality         as QualityTier,
    // Actions
    trigger,
    cancel,
    pause:        store.pause,
    resume:       store.resume,
    setQuality:   store.setQuality,
    reset:        store.reset,
  }
}
