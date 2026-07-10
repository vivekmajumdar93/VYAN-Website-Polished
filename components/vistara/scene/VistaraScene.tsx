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
const STEP = 0.0006

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
    video.addEventListener('loadedmetadata', () => { fit(); video.currentTime = 0 })

    // Resize canvas pixel buffer to match the true viewport.
    // Uses visualViewport when available (accounts for mobile browser chrome),
    // falls back to documentElement client dimensions, then window.innerWidth/Height.
    // Redraws immediately so there's no flash of wrong aspect ratio.
    function fit() {
      if (!canvas) return
      const vv = window.visualViewport
      canvas.width  = vv ? Math.round(vv.width)  : (document.documentElement.clientWidth  || window.innerWidth)
      canvas.height = vv ? Math.round(vv.height) : (document.documentElement.clientHeight || window.innerHeight)
      drawCover()
    }

    // Both resize and orientationchange fire on rotation.
    // iOS updates dimensions asynchronously after orientationchange,
    // so re-fit after a short delay as well.
    const onResize = () => fit()
    const onOrient = () => { fit(); setTimeout(fit, 150); setTimeout(fit, 400) }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrient)
    window.visualViewport?.addEventListener('resize', onResize)
    screen.orientation?.addEventListener?.('change', onOrient)

    return () => {
      destroyed = true
      video.removeEventListener('seeked', step)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrient)
      window.visualViewport?.removeEventListener('resize', onResize)
      screen.orientation?.removeEventListener?.('change', onOrient)
      video.src = ''
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    // 100dvh uses the dynamic viewport height on mobile (shrinks when browser UI shows)
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000', width: '100dvw', height: '100dvh' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }}
      />
    </div>,
    document.body,
  )
}
