'use client'

import { useEffect, useRef } from 'react'

interface StardustRainProps {
  active: boolean
  color: string
  onComplete: () => void
}

export function StardustRain({ active, color, onComplete }: StardustRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const w = canvas.width
    const h = canvas.height

    interface Particle {
      x: number; y: number
      vx: number; vy: number
      size: number; opacity: number
      decay: number; drift: number
      phase: number
    }

    const count = 280
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h * 0.3,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.8 + Math.random() * 1.4,
      size: 0.4 + Math.random() * 1.6,
      opacity: 0.6 + Math.random() * 0.4,
      decay: 0.004 + Math.random() * 0.006,
      drift: (Math.random() - 0.5) * 0.008,
      phase: Math.random() * Math.PI * 2,
    }))

    const start = performance.now()
    const duration = 2800

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const elapsed = now - start
      const globalFade = elapsed > duration * 0.6
        ? 1 - (elapsed - duration * 0.6) / (duration * 0.4)
        : 1

      if (globalFade <= 0) {
        ctx.clearRect(0, 0, w, h)
        cancelAnimationFrame(animRef.current)
        onComplete()
        return
      }

      for (const p of particles) {
        p.y += p.vy
        p.x += p.vx + Math.sin(p.phase + elapsed * 0.002) * 0.3
        p.vx += p.drift
        p.opacity -= p.decay

        if (p.opacity <= 0 || p.y > h) continue

        const finalOp = p.opacity * globalFade

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `${color}${Math.floor(finalOp * 220).toString(16).padStart(2, '0')}`
        ctx.fill()

        if (p.size > 1.2) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
          g.addColorStop(0, `${color}${Math.floor(finalOp * 120).toString(16).padStart(2, '0')}`)
          g.addColorStop(1, `${color}00`)
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fillStyle = g
          ctx.fill()
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [active, color, onComplete])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 50, pointerEvents: 'none',
      }}
    />
  )
}
