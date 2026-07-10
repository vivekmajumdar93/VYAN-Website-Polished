'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

// How many seconds of video time to advance per seeked callback.
// All-keyframe encoding means each seek resolves immediately.
// At ~30 callbacks/sec: 0.0015 × 30 = 0.045 s of video per real second → ~112× slower.
// The 5-second clip becomes a ~9-minute ping-pong cycle — reads as a living still.
const STEP = 0.0015

export function VistaraScene(_props: VistaraSceneProps) {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const video = document.createElement('video')
    video.src = '/vistara-bg.mp4'
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true

    let t = 0
    let dir = 1        // +1 = forward, -1 = reverse
    let destroyed = false

    function drawCover() {
      if (!canvas || !ctx) return
      const { videoWidth: vw, videoHeight: vh } = video
      const { width: cw, height: ch } = canvas
      const scale = Math.max(cw / vw, ch / vh)
      const dw = vw * scale, dh = vh * scale
      ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }

    function step() {
      if (destroyed) return
      drawCover()
      t += dir * STEP
      // Flip direction instantly at each end — no pause, seamless ping-pong
      if (t >= video.duration) { t = video.duration; dir = -1 }
      if (t <= 0)              { t = 0;               dir =  1 }
      video.currentTime = t
    }

    video.addEventListener('seeked', step)

    video.addEventListener('loadedmetadata', () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      t = 0
      video.currentTime = 0
    })

    video.load()

    const onResize = () => {
      if (!canvas) return
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    return () => {
      destroyed = true
      video.removeEventListener('seeked', step)
      window.removeEventListener('resize', onResize)
      video.src = ''
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
    </div>,
    document.body,
  )
}
