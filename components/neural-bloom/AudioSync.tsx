'use client'

/**
 * AudioSync — bridges Zustand phase state to Web Audio API synthesis.
 * Renders nothing; fires audio cues on phase transitions.
 */

import { useEffect } from 'react'
import { useAudioEngine } from '@/hooks/useAudioEngine'
import type { NeuralBloomPhase } from '@/types/neuralBloom'

interface AudioSyncProps {
  phase: NeuralBloomPhase
  audioEnabled: boolean
  active: boolean
}

export function AudioSync({ phase, audioEnabled, active }: AudioSyncProps) {
  useAudioEngine(phase, audioEnabled, active)
  return null
}
