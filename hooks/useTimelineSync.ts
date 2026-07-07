'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useNeuralBloomStore } from '@/stores/neuralBloomStore'

/** Drives the Zustand store tick on each rAF frame while transition is active */
export function useTimelineSync(onPhaseChange?: (phase: number) => void): void {
  const tick      = useNeuralBloomStore(s => s.tick)
  const active    = useNeuralBloomStore(s => s.active)
  const paused    = useNeuralBloomStore(s => s.paused)
  const phase     = useNeuralBloomStore(s => s.phase)
  const rafRef    = useRef<number>(0)
  const prevPhase = useRef<number>(0)
  const lastTs    = useRef<number | null>(null)

  const loop = useCallback((ts: number) => {
    if (!lastTs.current) lastTs.current = ts
    const delta = Math.min((ts - lastTs.current) / 1000, 0.05) // cap at 50ms
    lastTs.current = ts
    tick(delta)
    rafRef.current = requestAnimationFrame(loop)
  }, [tick])

  useEffect(() => {
    if (active && !paused) {
      lastTs.current = null
      rafRef.current = requestAnimationFrame(loop)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => { cancelAnimationFrame(rafRef.current) }
  }, [active, paused, loop])

  useEffect(() => {
    if (phase !== prevPhase.current) {
      prevPhase.current = phase
      onPhaseChange?.(phase)
    }
  }, [phase, onPhaseChange])
}
