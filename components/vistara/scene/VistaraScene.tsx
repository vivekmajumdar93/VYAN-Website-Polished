'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

// video-seconds advanced per real-second (< 1 = slow-mo). Matches MedhaLair.
const SPEED = 0.35
// flip direction this many video-seconds before reaching either end.
const TRANSITION_BUFFER = 0.10

export function VistaraScene(_props: VistaraSceneProps) {
  const [mounted, setMounted] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const dirRef   = useRef<1 | -1>(1)
  const rafRef   = useRef<number>(0)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const v = videoRef.current
    if (!v) return

    const startScrub = () => {
      // Prime the decoder — required before manual currentTime scrubbing on iOS.
      v.play().catch(() => {}).finally(() => { v.pause(); v.currentTime = 0 })
      dirRef.current = 1

      const scrub = () => {
        if (!v.duration || isNaN(v.duration)) {
          rafRef.current = requestAnimationFrame(scrub)
          return
        }
        const dir  = dirRef.current
        const next = v.currentTime + dir * SPEED * (1 / 60)

        if (dir === 1 && next >= v.duration - TRANSITION_BUFFER) {
          dirRef.current = -1
          v.currentTime  = v.duration - TRANSITION_BUFFER
        } else if (dir === -1 && next <= TRANSITION_BUFFER) {
          dirRef.current = 1
          v.currentTime  = TRANSITION_BUFFER
        } else {
          v.currentTime = Math.max(0, Math.min(next, v.duration))
        }
        rafRef.current = requestAnimationFrame(scrub)
      }
      rafRef.current = requestAnimationFrame(scrub)
    }

    v.addEventListener('loadedmetadata', startScrub)
    if (v.readyState >= 1) startScrub()

    return () => {
      cancelAnimationFrame(rafRef.current)
      v.removeEventListener('loadedmetadata', startScrub)
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000', width: '100dvw', height: '100dvh' }}>
      <video
        ref={videoRef}
        src="/vistara-bg.mp4"
        muted
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          pointerEvents: 'none',
        }}
      />
    </div>,
    document.body,
  )
}
