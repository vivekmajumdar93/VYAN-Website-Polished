'use client'

import { useEffect, useRef } from 'react'

interface StardustRainProps {
  active: boolean
  color: string   // faculty hex color e.g. '#2d9e7f'
  onComplete: () => void
}

export function StardustRain({ active, color, onComplete }: StardustRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const hex = (v: number): string =>
      Math.floor(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, '0')

    interface Sparkle {
      x: number
      y: number
      vx: number
      vy: number
      rays: number
      size: number
      rayLen: number
      rotation: number
      rotSpeed: number
      twinkleSpeed: number
      twinklePhase: number
      opacity: number
      dissolveY: number
    }

    const count = 180
    const h = canvas.height
    const w = canvas.width

    const sparkles: Sparkle[] = Array.from({ length: count }, () => {
      const size = 0.6 + Math.random() * 2.8
      return {
        x: Math.random() * w,
        y: -(10 + Math.random() * 180),
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.35 + Math.random() * 1.1,
        rays: Math.random() < 0.8 ? 4 : 6,
        size,
        rayLen: size * (6 + Math.random() * 8),
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
        twinkleSpeed: 0.08 + Math.random() * 0.18,
        twinklePhase: Math.random() * Math.PI * 2,
        opacity: 0.7 + Math.random() * 0.3,
        dissolveY: h * (0.42 + Math.random() * 0.35),
      }
    })

    const start = performance.now()
    const duration = 3000

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const elapsed = now - start

      const gFade =
        elapsed > duration * 0.75
          ? 1 - (elapsed - duration * 0.75) / (duration * 0.25)
          : 1

      let allDone = true

      for (const m of sparkles) {
        // Update position — no gravity acceleration, constant velocity
        m.x += m.vx
        m.y += m.vy
        m.rotation += m.rotSpeed

        // Orbital swirl flutter
        const orbX =
          Math.cos(now * m.twinkleSpeed * 0.3 + m.twinklePhase) * m.size * 2
        const orbY =
          Math.sin(now * m.twinkleSpeed * 0.3 + m.twinklePhase) * m.size * 2
        const px = m.x + orbX
        const py = m.y + orbY

        // Dissolve calculation
        let dissolveAlpha = 1
        if (m.y > m.dissolveY) {
          dissolveAlpha = Math.max(
            0,
            1 - (m.y - m.dissolveY) / (h * 0.18)
          )
        }

        if (dissolveAlpha <= 0) continue
        allDone = false

        const twinkle =
          0.4 + 0.6 * Math.abs(Math.sin(now * m.twinkleSpeed + m.twinklePhase))
        const op = m.opacity * gFade * dissolveAlpha * twinkle

        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(m.rotation)

        // Draw each ray as a linear gradient line
        for (let r = 0; r < m.rays; r++) {
          const ang = (r / m.rays) * Math.PI * 2
          const rl = m.rayLen
          const grd = ctx.createLinearGradient(
            0,
            0,
            Math.cos(ang) * rl,
            Math.sin(ang) * rl
          )
          grd.addColorStop(0, `rgba(255,255,255,${op})`)
          grd.addColorStop(0.35, `${color}${hex(op * 0.7)}`)
          grd.addColorStop(1, `${color}00`)
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(Math.cos(ang) * rl, Math.sin(ang) * rl)
          ctx.strokeStyle = grd
          ctx.lineWidth = m.size * 0.35
          ctx.lineCap = 'round'
          ctx.stroke()
        }

        // Bright white core radial gradient
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, m.size * 1.8)
        cg.addColorStop(0, `rgba(255,255,255,${op})`)
        cg.addColorStop(0.45, `${color}${hex(op * 0.8)}`)
        cg.addColorStop(1, `${color}00`)
        ctx.beginPath()
        ctx.arc(0, 0, m.size * 1.8, 0, Math.PI * 2)
        ctx.fillStyle = cg
        ctx.fill()

        ctx.restore()
      }

      if (allDone || elapsed > duration) {
        cancelAnimationFrame(animRef.current)
        onComplete()
        return
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [active, color])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 55,
        pointerEvents: 'none',
      }}
    />
  )
}
