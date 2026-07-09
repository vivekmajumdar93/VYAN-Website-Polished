'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

// Seconds of video time to step backward per seeked callback.
// All-keyframe video means each seek resolves instantly.
// At ~30 seeks/sec this gives ≈0.09s of video per real second → ~55× slower than realtime.
const STEP = 0.003

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
      t -= STEP
      if (t <= 0) t = video.duration
      video.currentTime = t
    }

    video.addEventListener('seeked', step)

    video.addEventListener('loadedmetadata', () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      t = video.duration
      video.currentTime = t
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
