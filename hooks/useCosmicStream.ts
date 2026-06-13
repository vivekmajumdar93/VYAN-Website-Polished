'use client'

import { useState, useCallback, useRef } from 'react'

// Faculty → stream color
export const STREAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  prajna:   { primary: '#2d9e7f', secondary: '#00ffcc' },  // Void Sage
  dhyana:   { primary: '#c4622d', secondary: '#ff8c42' },  // Solar Ember
  akshaya:  { primary: '#00c4cc', secondary: '#7bfcff' },  // Celestial Cyan
  java:     { primary: '#a855f7', secondary: '#d8b4fe' },  // Velocity Violet
  sanchara: { primary: '#e8b94f', secondary: '#fde68a' },  // Transmission Gold
  // Default — used for ambient / random
  ambient:  { primary: '#7b2fff', secondary: '#c026d3' },  // MEDHĀ violet-magenta
}

interface StreamState {
  active: boolean
  color: string
  colorSecondary: string
}

interface UseCosmicStreamReturn {
  stream: StreamState
  triggerStream: (facultyKey?: string) => void
  handleStreamComplete: () => void
}

export function useCosmicStream(): UseCosmicStreamReturn {
  const [stream, setStream] = useState<StreamState>({
    active: false,
    color: '#7b2fff',
    colorSecondary: '#c026d3',
  })

  const cooldownRef = useRef(false)

  const triggerStream = useCallback((facultyKey?: string) => {
    // Prevent overlapping streams
    if (cooldownRef.current) return
    cooldownRef.current = true

    const key = facultyKey ?? 'ambient'
    const colors = STREAM_COLORS[key] ?? STREAM_COLORS.ambient

    setStream({ active: true, color: colors.primary, colorSecondary: colors.secondary })
  }, [])

  const handleStreamComplete = useCallback(() => {
    setStream(prev => ({ ...prev, active: false }))
    // Cooldown before next stream can trigger
    setTimeout(() => { cooldownRef.current = false }, 1200)
  }, [])

  return { stream, triggerStream, handleStreamComplete }
}
