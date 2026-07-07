import { create } from 'zustand'
import { Vector3 } from 'three'
import type { NeuralBloomStore, NeuralBloomPhase, QualityTier } from '@/types/neuralBloom'
import {
  PHASE_TIMINGS,
  TOTAL_DURATION,
  BLOOM_INTENSITY,
  PARTICLE_QUALITY,
} from '@/constants/neuralBloom'

function detectQuality(): QualityTier {
  if (typeof navigator === 'undefined') return 'medium'
  const cores = navigator.hardwareConcurrency ?? 4
  if (typeof document === 'undefined') return 'medium'
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  if (!gl) return 'low'
  const maxTex = (gl as WebGLRenderingContext).getParameter(
    (gl as WebGLRenderingContext).MAX_TEXTURE_SIZE
  )
  const dpr = window.devicePixelRatio ?? 1
  if (cores >= 8 && maxTex >= 8192 && dpr <= 2) return 'ultra'
  if (cores >= 4 && maxTex >= 4096) return 'high'
  if (cores >= 2) return 'medium'
  return 'low'
}

function phaseFromElapsed(elapsed: number): NeuralBloomPhase {
  if (elapsed < 0) return 0
  if (elapsed < PHASE_TIMINGS[1].end) return 1
  if (elapsed < PHASE_TIMINGS[2].end) return 2
  if (elapsed < PHASE_TIMINGS[3].end) return 3
  if (elapsed < PHASE_TIMINGS[4].end) return 4
  if (elapsed < PHASE_TIMINGS[5].end) return 5
  if (elapsed < PHASE_TIMINGS[6].end) return 6
  if (elapsed < TOTAL_DURATION) return 7
  return 7
}

function attractorFromPhase(phase: NeuralBloomPhase, elapsed: number): number {
  if (phase < 2) return 0
  if (phase === 2) {
    const t = (elapsed - PHASE_TIMINGS[2].start) / (PHASE_TIMINGS[2].end - PHASE_TIMINGS[2].start)
    return t * 1.8
  }
  if (phase >= 3 && phase <= 5) return 1.8
  return 0.3 // phases 6-7: particles settling
}

function chromaticFromPhase(phase: NeuralBloomPhase, progress: number): number {
  if (phase === 4) return 0.0005 + progress * 0.0035
  if (phase === 5) return 0.002
  if (phase >= 6) return 0.0005
  return 0.0005
}

const defaultOrbPos = new Vector3(0, 0, 0)
const defaultCamTarget = new Vector3(0, 0, 0)

export const useNeuralBloomStore = create<NeuralBloomStore>((set, get) => ({
  phase:                    0 as NeuralBloomPhase,
  elapsed:                  0,
  progress:                 0,
  active:                   false,
  paused:                   false,
  cancelled:                false,
  orbPosition:              defaultOrbPos.clone(),
  cameraTarget:             defaultCamTarget.clone(),
  particleAttractorStrength: 0,
  bloomIntensity:           0,
  chromaticAberration:      0.0005,
  neuralLinkCount:          0,
  fractureProgress:         0,
  reconstructionProgress:   0,
  audioEnabled:             true,
  reducedMotion:            typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false,
  quality: 'medium',

  start(orbPosition: Vector3) {
    const quality = detectQuality()
    set({
      active:    true,
      paused:    false,
      cancelled: false,
      elapsed:   0,
      progress:  0,
      phase:     1,
      orbPosition: orbPosition.clone(),
      cameraTarget: orbPosition.clone(),
      quality,
      bloomIntensity: BLOOM_INTENSITY[1],
      particleAttractorStrength: 0,
      fractureProgress: 0,
      reconstructionProgress: 0,
      neuralLinkCount: 0,
    })
  },

  pause() { set({ paused: true }) },
  resume() { set({ paused: false }) },

  cancel() {
    set({ cancelled: true })
    setTimeout(() => {
      set({
        active: false,
        cancelled: false,
        phase: 0 as NeuralBloomPhase,
        elapsed: 0,
        progress: 0,
      })
    }, 450)
  },

  retrigger(orbPosition: Vector3) {
    const { active } = get()
    if (!active) get().start(orbPosition)
    // If active, queue — handled by onComplete chain externally
  },

  setQuality(quality: QualityTier) {
    set({ quality })
  },

  tick(delta: number) {
    const state = get()
    if (!state.active || state.paused || state.cancelled) return

    const elapsed = state.elapsed + delta
    const phase = phaseFromElapsed(elapsed)
    const progress = Math.min(elapsed / TOTAL_DURATION, 1)

    // Phase-local progress (0-1 within current phase)
    const pt = PHASE_TIMINGS[phase as keyof typeof PHASE_TIMINGS]
    const phaseProgress = pt
      ? (elapsed - pt.start) / (pt.end - pt.start)
      : 1

    // Derived uniforms
    const attractor = attractorFromPhase(phase, elapsed)
    const bloom     = BLOOM_INTENSITY[phase] ?? 1.8
    const chromatic = chromaticFromPhase(phase, phaseProgress)

    // Fracture: phase 4
    const fractureProgress = phase === 4
      ? clamp(phaseProgress, 0, 1)
      : phase > 4 ? 1 : 0

    // Reconstruction: phase 6
    const reconstructionProgress = phase === 6
      ? clamp(phaseProgress, 0, 1)
      : phase === 7 ? 1 : 0

    // Neural links: max in phase 3
    const linkCount = phase === 3
      ? Math.floor(phaseProgress * PARTICLE_QUALITY[state.quality].count * 0.07)
      : phase === 4
        ? Math.floor((1 - phaseProgress) * PARTICLE_QUALITY[state.quality].count * 0.07)
        : 0

    set({
      elapsed,
      progress,
      phase,
      particleAttractorStrength: attractor,
      bloomIntensity: bloom,
      chromaticAberration: chromatic,
      fractureProgress,
      reconstructionProgress,
      neuralLinkCount: clamp(linkCount, 0, 8000),
    })
  },

  reset() {
    set({
      active: false,
      paused: false,
      cancelled: false,
      elapsed: 0,
      progress: 0,
      phase: 0 as NeuralBloomPhase,
      particleAttractorStrength: 0,
      bloomIntensity: 0,
      chromaticAberration: 0.0005,
      neuralLinkCount: 0,
      fractureProgress: 0,
      reconstructionProgress: 0,
    })
  },
}))

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}
