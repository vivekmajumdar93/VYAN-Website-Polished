import type { QualityTier, ParticleQualityConfig, PhaseTimings } from '@/types/neuralBloom'

export const PHASE_TIMINGS: Record<NeuralBloomPhaseKey, PhaseTimings> = {
  1: { start: 0.000, end: 0.180 },
  2: { start: 0.180, end: 0.600 },
  3: { start: 0.600, end: 1.000 },
  4: { start: 1.000, end: 1.400 },
  5: { start: 1.400, end: 1.800 },
  6: { start: 1.800, end: 2.100 },
  7: { start: 2.100, end: 2.200 },
}

type NeuralBloomPhaseKey = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const TOTAL_DURATION = 2.2

export const COLORS = {
  primaryViolet:  [0.482, 0.184, 1.000] as [number, number, number],
  electricBlue:   [0.176, 0.435, 1.000] as [number, number, number],
  crimson:        [1.000, 0.176, 0.435] as [number, number, number],
  deepIndigo:     [0.102, 0.039, 0.239] as [number, number, number],
  goldAccent:     [0.831, 0.659, 0.325] as [number, number, number],
  innerPlasma:    [0.545, 0.000, 0.200] as [number, number, number],
  fractureEdge:   [0.863, 0.784, 1.000] as [number, number, number],
  white:          [1.000, 1.000, 1.000] as [number, number, number],
} as const

export const PARTICLE_QUALITY: Record<QualityTier, ParticleQualityConfig> = {
  ultra:  { count: 120000, gpuSize: 512, motionBlurSamples: 8,  usePostprocessing: true,  useMotionBlur: true  },
  high:   { count: 80000,  gpuSize: 384, motionBlurSamples: 4,  usePostprocessing: true,  useMotionBlur: true  },
  medium: { count: 40000,  gpuSize: 256, motionBlurSamples: 0,  usePostprocessing: true,  useMotionBlur: false },
  low:    { count: 10000,  gpuSize: 128, motionBlurSamples: 0,  usePostprocessing: false, useMotionBlur: false },
}

export const NEURAL_LINKS = {
  maxConcurrent: 8000,
  minLifetime:   0.12,
  maxLifetime:   0.38,
  minThickness:  0.4,
  maxThickness:  2.8,
  fadeInTime:    0.04,
  fadeOutTime:   0.06,
} as const

export const BLOOM_INTENSITY: Record<number, number> = {
  0: 0.0,
  1: 1.8,
  2: 1.8,
  3: 2.9,
  4: 2.9,
  5: 2.9,
  6: 3.5,
  7: 4.1,
}

export const SWARM = {
  alignment:  0.3,
  cohesion:   0.2,
  separation: 0.4,
  attractorMax: 1.8,
  curl:       0.6,
} as const

export const CAMERA_CONFIG = {
  breathingAmplitude:  0.008,
  breathingFrequency:  0.8,
  microDriftAmplitude: 0.003,
  microDriftSpeed:     0.4,
  parallaxMax:         0.015,
  smoothingFactor:     0.92,
  fovNormal:           50,
  fovPassage:          28,
  nearClip:            0.1,
  farClip:             1000,
  initialZ:            6,
} as const

export const ORB_CONFIG = {
  breathingRate:      0.8,
  brightnessPhase2:   4.4,
  radius:             1.0,
  segments:           64,
} as const

export const VORONOI_PETALS = 7
export const PETAL_MIN_ANGULAR_VEL = 0.3
export const PETAL_MAX_ANGULAR_VEL = 1.2
