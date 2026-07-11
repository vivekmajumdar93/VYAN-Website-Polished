'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface VistaraSceneProps {
  onOrbHover: (id: string | null) => void
  onOrbClick: (id: string) => void
  hoveredId:  string | null
  activeId:   string | null
}

// Seconds of video time advanced per decoded frame.
// At ~24 frames/sec: 0.0006 × 24 ≈ 0.014 s of video per real second → ~350× slower.
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

    // ── Video element ─────────────────────────────────────────────────────────
    // iOS Safari will NOT decode a video that isn't in the DOM.
    // opacity:0.001 (not 0, not display:none) keeps it alive for iOS.
    const video = document.createElement('video')
    video.muted       = true
    video.preload     = 'auto'
    video.playsInline = true
    video.setAttribute('webkit-playsinline', '')
    video.style.cssText =
      'position:fixed;width:1px;height:1px;top:-2px;left:-2px;' +
      'opacity:0.001;pointer-events:none;z-index:-1'
    document.body.appendChild(video)
    // Set src AFTER appending — iOS starts buffering immediately on src set.
    video.src = '/vistara-bg.mp4'

    let t        = 0
    let dir      = 1   // +1 forward, -1 reverse
    let destroyed = false

    // requestVideoFrameCallback fires when a decoded frame is actually ready
    // to paint — no stutter, no tick-tick. Supported on Safari 15.4+, all
    // modern Chrome/Firefox. Falls back to the seeked-chain on older browsers.
    const hasRVFC = 'requestVideoFrameCallback' in video

    // ── Draw ─────────────────────────────────────────────────────────────────
    function drawCover() {
      if (!canvas || !ctx || video.readyState < 2) return
      const vw = video.videoWidth, vh = video.videoHeight
      if (!vw || !vh) return
      const { width: cw, height: ch } = canvas
      const scale = Math.max(cw / vw, ch / vh)
      const dw = vw * scale, dh = vh * scale
      ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
    }

    // ── Advance time ─────────────────────────────────────────────────────────
    function advance() {
      t += dir * STEP
      if (t >= video.duration) { t = video.duration; dir = -1 }
      if (t <= 0)              { t = 0;               dir =  1 }
      video.currentTime = t
    }

    // ── Animation loop ───────────────────────────────────────────────────────
    function onFrame() {
      if (destroyed) return
      drawCover()
      advance()
      if (hasRVFC) {
        ;(video as any).requestVideoFrameCallback(onFrame)
      } else {
        // Fallback: chain on seeked (one listener at a time to avoid pile-up)
        video.addEventListener('seeked', onFrame, { once: true })
      }
    }

    // ── Fit canvas to viewport ───────────────────────────────────────────────
    function fit() {
      if (!canvas) return
      const vv = window.visualViewport
      canvas.width  = vv ? Math.round(vv.width)  : (document.documentElement.clientWidth  || window.innerWidth)
      canvas.height = vv ? Math.round(vv.height) : (document.documentElement.clientHeight || window.innerHeight)
      drawCover()
    }

    // ── Start ────────────────────────────────────────────────────────────────
    video.addEventListener('loadedmetadata', () => {
      fit()
      t = 0
      video.currentTime = 0
      if (hasRVFC) {
        ;(video as any).requestVideoFrameCallback(onFrame)
      } else {
        video.addEventListener('seeked', onFrame, { once: true })
      }
    })

    video.load()

    // ── Resize / orientation ─────────────────────────────────────────────────
    const onResize = () => fit()
    // iOS fires orientationchange before dimensions update — re-fit with delay.
    const onOrient = () => { fit(); setTimeout(fit, 150); setTimeout(fit, 400) }

    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrient)
    window.visualViewport?.addEventListener('resize', onResize)
    screen.orientation?.addEventListener?.('change', onOrient)

    return () => {
      destroyed = true
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrient)
      window.visualViewport?.removeEventListener('resize', onResize)
      screen.orientation?.removeEventListener?.('change', onOrient)
      try { video.remove() } catch {}
      video.src = ''
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#000', width: '100dvw', height: '100dvh' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }}
      />
    </div>,
    document.body,
  )
}
