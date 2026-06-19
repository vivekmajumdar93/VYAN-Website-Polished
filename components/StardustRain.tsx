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

    // Burst origin: center-left where Medhā lives
    const originX = w * 0.25
    const originY = h * 0.42

    interface Mote {
      x: number; y: number
      vx: number; vy: number
      gravity: number
      orbitR: number; orbitSpeed: number; orbitPhase: number; orbitTilt: number
      size: number
      isSpark: boolean
      opacity: number
      decay: number
      twinkleSpeed: number; twinklePhase: number
    }

    const count = 360
    const motes: Mote[] = Array.from({ length: count }, (_, i) => {
      // Radial burst — spread in all directions
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.8
      const speed = 1.2 + Math.random() * 4.5
      const isSpark = Math.random() < 0.09
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // slight upward bias
        gravity: 0.022 + Math.random() * 0.018,
        orbitR: 2 + Math.random() * 8,
        orbitSpeed: 0.06 + Math.random() * 0.09,
        orbitPhase: Math.random() * Math.PI * 2,
        orbitTilt: Math.random() * Math.PI,
        size: isSpark ? 1.6 + Math.random() * 2.0 : 0.5 + Math.random() * 1.8,
        isSpark,
        opacity: 0.7 + Math.random() * 0.3,
        decay: 0.008 + Math.random() * 0.012,
        twinkleSpeed: 0.05 + Math.random() * 0.1,
        twinklePhase: Math.random() * Math.PI * 2,
      }
    })

    const start = performance.now()
    const duration = 2600

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h)
      const elapsed = now - start
      if (elapsed > duration) {
        cancelAnimationFrame(animRef.current)
        onComplete()
        return
      }

      // Global fade out in last 30%
      const gFade = elapsed > duration * 0.7
        ? 1 - (elapsed - duration * 0.7) / (duration * 0.3)
        : 1

      let anyAlive = false
      for (const m of motes) {
        // Gravity
        m.vy += m.gravity
        // Orbital swirl around the moving particle
        const oa = now * m.orbitSpeed + m.orbitPhase
        const orbX = Math.cos(oa) * m.orbitR * Math.cos(m.orbitTilt) - Math.sin(oa) * m.orbitR * 0.5 * Math.sin(m.orbitTilt)
        const orbY = Math.cos(oa) * m.orbitR * Math.sin(m.orbitTilt) + Math.sin(oa) * m.orbitR * 0.5 * Math.cos(m.orbitTilt)

        m.x += m.vx
        m.y += m.vy
        m.vx *= 0.985  // air resistance
        m.opacity -= m.decay

        if (m.opacity <= 0 || m.y > h + 20) continue
        anyAlive = true

        const twinkle = 0.5 + 0.5 * Math.abs(Math.sin(now * m.twinkleSpeed + m.twinklePhase))
        const op = m.opacity * gFade * twinkle

        const px = m.x + orbX
        const py = m.y + orbY

        if (m.isSpark) {
          // Soft 4-ray sparkle
          ctx.save()
          ctx.translate(px, py)
          ctx.rotate(now * 0.003 + m.orbitPhase)
          for (let r = 0; r < 4; r++) {
            const ang = (r / 4) * Math.PI * 2
            const rl = m.size * 5
            const grd = ctx.createLinearGradient(0, 0, Math.cos(ang) * rl, Math.sin(ang) * rl)
            grd.addColorStop(0, `rgba(255,255,255,${op})`)
            grd.addColorStop(0.5, `${color}${Math.floor(op * 0.4 * 255).toString(16).padStart(2, '0')}`)
            grd.addColorStop(1, `${color}00`)
            ctx.beginPath(); ctx.moveTo(0, 0)
            ctx.lineTo(Math.cos(ang) * rl, Math.sin(ang) * rl)
            ctx.strokeStyle = grd; ctx.lineWidth = m.size * 0.5; ctx.lineCap = 'round'; ctx.stroke()
          }
          const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, m.size * 2.5)
          cg.addColorStop(0, `rgba(255,255,255,${op})`)
          cg.addColorStop(0.5, `${color}${Math.floor(op * 0.7 * 255).toString(16).padStart(2, '0')}`)
          cg.addColorStop(1, `${color}00`)
          ctx.beginPath(); ctx.arc(0, 0, m.size * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = cg; ctx.fill()
          ctx.restore()
        } else {
          // Glowing mote
          const gr = ctx.createRadialGradient(px, py, 0, px, py, m.size * 3.5)
          gr.addColorStop(0, `rgba(255,255,255,${op * 0.9})`)
          gr.addColorStop(0.4, `${color}${Math.floor(op * 0.6 * 255).toString(16).padStart(2, '0')}`)
          gr.addColorStop(1, `${color}00`)
          ctx.beginPath(); ctx.arc(px, py, m.size * 3.5, 0, Math.PI * 2)
          ctx.fillStyle = gr; ctx.fill()
          ctx.beginPath(); ctx.arc(px, py, m.size * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${op})`; ctx.fill()
        }
      }

      if (!anyAlive) { cancelAnimationFrame(animRef.current); onComplete(); return }
      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, color])

  if (!active) return null
  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0,
      width: '100%', height: '100%',
      zIndex: 55, pointerEvents: 'none',
    }} />
  )
}
