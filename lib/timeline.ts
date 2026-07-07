/** Timeline utilities for Neural Bloom phase management */

import { PHASE_TIMINGS, TOTAL_DURATION } from '@/constants/neuralBloom'
import type { NeuralBloomPhase } from '@/types/neuralBloom'

export function phaseProgress(elapsed: number, phase: NeuralBloomPhase): number {
  if (phase === 0) return 0
  const pt = PHASE_TIMINGS[phase as keyof typeof PHASE_TIMINGS]
  if (!pt) return 1
  return Math.min(Math.max((elapsed - pt.start) / (pt.end - pt.start), 0), 1)
}

export function overallProgress(elapsed: number): number {
  return Math.min(elapsed / TOTAL_DURATION, 1)
}

export function isPhaseActive(elapsed: number, phase: NeuralBloomPhase): boolean {
  if (phase === 0) return elapsed < 0
  const pt = PHASE_TIMINGS[phase as keyof typeof PHASE_TIMINGS]
  if (!pt) return false
  return elapsed >= pt.start && elapsed < pt.end
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function easeIn(t: number): number {
  return t * t * t
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
