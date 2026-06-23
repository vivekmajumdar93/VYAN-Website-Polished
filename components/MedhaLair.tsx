'use client'

import { useEffect, useRef } from 'react'

const LAIR_SPEED         = 0.12   // % of duration advanced per frame at 60fps
const TRANSITION_BUFFER  = 0.08   // seconds before end/start to flip direction

export function MedhaLair({ lairVideoSrc = '/assets/medha-lair.mp4' }: { lairVideoSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const dirRef   = useRef<1 | -1>(1)
  const rafRef   = useRef<number>(0)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted      = true
    v.playsInline = true
    v.preload    = 'auto'

    const startScrub = () => {
      // Prime the decoder — browsers won't render frames without an initial play() call
      v.play().catch(() => {}).finally(() => {
        v.pause()
        v.currentTime = 0
      })
      dirRef.current = 1

      const scrub = () => {
        if (!v.duration || isNaN(v.duration)) {
          rafRef.current = requestAnimationFrame(scrub)
          return
        }

        const dir  = dirRef.current
        const next = v.currentTime + dir * LAIR_SPEED * (1 / 60)

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
      v.removeEventListener('loadedmetadata', startScrub)
      cancelAnimationFrame(rafRef.current)
    }
  }, [lairVideoSrc])

  return (
    <video
      ref={videoRef}
      src={lairVideoSrc}
      muted
      playsInline
      preload="auto"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        zIndex: 3,
        pointerEvents: 'none',
      }}
    />
  )
}
