import type { Vector3 } from 'three'

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra'

export type NeuralBloomPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface PhaseTimings {
  start: number
  end: number
}

export interface ParticleQualityConfig {
  count: number
  gpuSize: number
  motionBlurSamples: number
  usePostprocessing: boolean
  useMotionBlur: boolean
}

export interface NeuralBloomState {
  phase: NeuralBloomPhase
  elapsed: number
  progress: number
  active: boolean
  paused: boolean
  cancelled: boolean
  orbPosition: Vector3
  cameraTarget: Vector3
  particleAttractorStrength: number
  bloomIntensity: number
  chromaticAberration: number
  neuralLinkCount: number
  fractureProgress: number
  reconstructionProgress: number
  audioEnabled: boolean
  reducedMotion: boolean
  quality: QualityTier
}

export interface NeuralBloomActions {
  start: (orbPosition: Vector3) => void
  pause: () => void
  resume: () => void
  cancel: () => void
  retrigger: (orbPosition: Vector3) => void
  setQuality: (quality: QualityTier) => void
  tick: (delta: number) => void
  reset: () => void
}

export interface NeuralBloomStore extends NeuralBloomState, NeuralBloomActions {}

export interface NeuralLinkInstance {
  startIdx: number
  endIdx: number
  age: number
  lifetime: number
  phase: number
}

export interface NeuralBloomProps {
  active: boolean
  orbPosition?: Vector3
  onComplete: () => void
}
