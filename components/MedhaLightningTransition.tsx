'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MedhaLightningTransitionProps {
  active: boolean
  medhaImageSrc: string   // kept in interface for compat; not used for image
  onComplete: () => void
}

const STRIKES = [
  { at: 800,  duration: 90,   medhaX: 50, medhaY: 50 },
  { at: 1400, duration: 85,   medhaX: 50, medhaY: 50 },
  { at: 2100, duration: 2400, medhaX: 50, medhaY: 50 },
]

// Draw Medhā as a glowing luminous silhouette — wings spread, upright figure
function drawMedha(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  intensity: number,
  W: number, H: number
) {
  const s = Math.min(W, H) * 0.38   // scale relative to screen

  ctx.save()
  ctx.translate(cx, cy)

  // Outer radial aura
  const aura = ctx.createRadialGradient(0, 0, s * 0.05, 0, 0, s * 1.1)
  aura.addColorStop(0,   `rgba(180,120,255,${0.55 * intensity})`)
  aura.addColorStop(0.3, `rgba(120,60,255,${0.30 * intensity})`)
  aura.addColorStop(0.7, `rgba(80,20,180,${0.12 * intensity})`)
  aura.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = aura
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 1.1, s * 1.3, 0, 0, Math.PI * 2)
  ctx.fill()

  // Wings — left
  ctx.save()
  ctx.globalAlpha = intensity
  const wingGradL = ctx.createLinearGradient(-s * 0.05, -s * 0.1, -s * 0.9, s * 0.3)
  wingGradL.addColorStop(0, 'rgba(200,140,255,0.9)')
  wingGradL.addColorStop(0.4, 'rgba(140,80,255,0.55)')
  wingGradL.addColorStop(1,  'rgba(60,20,160,0)')
  ctx.fillStyle = wingGradL
  ctx.beginPath()
  ctx.moveTo(-s * 0.05, -s * 0.1)
  ctx.bezierCurveTo(-s * 0.3, -s * 0.5, -s * 0.85, -s * 0.2, -s * 0.9,  s * 0.3)
  ctx.bezierCurveTo(-s * 0.7,  s * 0.25, -s * 0.3,  s * 0.15, -s * 0.05, s * 0.1)
  ctx.closePath()
  ctx.fill()

  // Wings — right (mirror)
  const wingGradR = ctx.createLinearGradient(s * 0.05, -s * 0.1, s * 0.9, s * 0.3)
  wingGradR.addColorStop(0, 'rgba(200,140,255,0.9)')
  wingGradR.addColorStop(0.4, 'rgba(140,80,255,0.55)')
  wingGradR.addColorStop(1,  'rgba(60,20,160,0)')
  ctx.fillStyle = wingGradR
  ctx.beginPath()
  ctx.moveTo(s * 0.05, -s * 0.1)
  ctx.bezierCurveTo(s * 0.3, -s * 0.5, s * 0.85, -s * 0.2, s * 0.9,  s * 0.3)
  ctx.bezierCurveTo(s * 0.7,  s * 0.25, s * 0.3,  s * 0.15, s * 0.05, s * 0.1)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Body — vertical luminous form
  const bodyGrad = ctx.createLinearGradient(0, -s * 0.55, 0, s * 0.55)
  bodyGrad.addColorStop(0,   `rgba(255,220,255,${0.95 * intensity})`)
  bodyGrad.addColorStop(0.3, `rgba(200,140,255,${0.85 * intensity})`)
  bodyGrad.addColorStop(0.7, `rgba(140,80,255,${0.6 * intensity})`)
  bodyGrad.addColorStop(1,   `rgba(80,20,180,${0.2 * intensity})`)
  ctx.fillStyle = bodyGrad
  ctx.beginPath()
  ctx.ellipse(0, -s * 0.05, s * 0.07, s * 0.52, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head glow
  const headGrad = ctx.createRadialGradient(0, -s * 0.5, 0, 0, -s * 0.5, s * 0.14)
  headGrad.addColorStop(0, `rgba(255,240,255,${intensity})`)
  headGrad.addColorStop(0.5, `rgba(200,160,255,${0.7 * intensity})`)
  headGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = headGrad
  ctx.beginPath()
  ctx.arc(0, -s * 0.5, s * 0.14, 0, Math.PI * 2)
  ctx.fill()

  // Core spine — bright white streak
  ctx.save()
  ctx.filter = 'blur(3px)'
  const spineGrad = ctx.createLinearGradient(0, -s * 0.55, 0, s * 0.5)
  spineGrad.addColorStop(0, `rgba(255,255,255,${intensity})`)
  spineGrad.addColorStop(0.5, `rgba(220,180,255,${0.8 * intensity})`)
  spineGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.strokeStyle = spineGrad
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.55)
  ctx.lineTo(0,  s * 0.5)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

export function MedhaLightningTransition({
  active, onComplete
}: MedhaLightningTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number | null>(null)
  const [realmVisible, setRealmVisible] = useState(false)
  const strikeFiredRef = useRef<boolean[]>([false, false, false])

  const drawLightning = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    x1: number, y1: number,
    x2: number, y2: number,
    intensity: number,
    branches = true
  ) => {
    const drawSegment = (
      sx: number, sy: number,
      ex: number, ey: number,
      depth: number, opacity: number
    ) => {
      if (depth === 0 || opacity < 0.05) return
      const mx = (sx+ex)/2 + (Math.random()-0.5)*(H*0.06/depth)
      const my = (sy+ey)/2 + (Math.random()-0.5)*(H*0.04/depth)

      ctx.save()
      ctx.filter = 'blur(8px)'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(mx, my, ex, ey)
      ctx.strokeStyle = `rgba(140,80,255,${opacity * intensity * 0.35})`
      ctx.lineWidth = 7
      ctx.stroke()
      ctx.filter = 'none'

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(mx, my, ex, ey)
      ctx.strokeStyle = `rgba(200,140,255,${opacity * intensity})`
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.restore()

      drawSegment(sx, sy, mx, my, depth-1, opacity*0.9)
      drawSegment(mx, my, ex, ey, depth-1, opacity*0.9)

      if (branches && depth > 1 && Math.random() > 0.55) {
        const bx = mx + (Math.random()-0.5)*W*0.15
        const by = my + Math.random()*H*0.18
        drawSegment(mx, my, bx, by, depth-2, opacity*0.4)
      }
    }
    drawSegment(x1, y1, x2, y2, 6, 1)
  }, [])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    startRef.current = null
    strikeFiredRef.current = [false, false, false]
    setRealmVisible(false)

    const tick = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const W = canvas.width
      const H = canvas.height

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)

      STRIKES.forEach((strike, i) => {
        if (elapsed < strike.at) return
        const age = elapsed - strike.at
        const isSustained = i === 2

        if (!strikeFiredRef.current[i]) {
          strikeFiredRef.current[i] = true
        }

        if (age < strike.duration) {
          const flashProgress = age / strike.duration
          let flashOp: number

          if (isSustained) {
            if (flashProgress < 0.05) flashOp = flashProgress / 0.05
            else if (flashProgress < 0.25) flashOp = 1
            else flashOp = 1 - (flashProgress - 0.25) / 0.75
          } else {
            flashOp = flashProgress < 0.15
              ? 1
              : 1 - (flashProgress - 0.15) / 0.85
          }
          flashOp = Math.max(0, flashOp)

          const flashOp2 = isSustained ? flashOp * 0.18 : flashOp * 0.55
          ctx.fillStyle = `rgba(80,40,160,${flashOp2})`
          ctx.fillRect(0, 0, W, H)

          if (flashOp > 0.3) {
            const vign = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.75)
            vign.addColorStop(0, 'rgba(0,0,0,0)')
            vign.addColorStop(1, `rgba(120,20,60,${flashOp * 0.25})`)
            ctx.fillStyle = vign
            ctx.fillRect(0, 0, W, H)
          }

          if (flashOp > 0.1) {
            const strikeX = W * strike.medhaX / 100
            drawLightning(ctx, W, H,
              strikeX + (Math.random()-0.5)*W*0.2, 0,
              strikeX + (Math.random()-0.5)*W*0.05, H*0.35,
              flashOp, true
            )
            if (Math.random() > 0.3) {
              ctx.save()
              drawLightning(ctx, W, H,
                W*0.2 + Math.random()*W*0.6, 0,
                W*0.25 + Math.random()*W*0.5, H*0.55,
                flashOp * 0.6, false
              )
              ctx.restore()
            }
          }

          // Draw Medhā's glowing form during the sustained strike
          if (isSustained) {
            const medhaFade = flashProgress < 0.08
              ? flashProgress / 0.08
              : flashProgress > 0.75
                ? 1 - (flashProgress - 0.75) / 0.25
                : 1
            drawMedha(ctx, W * 0.5, H * 0.48, Math.max(0, medhaFade) * flashOp, W, H)
          }

          if (isSustained && flashProgress > 0.3 && !realmVisible) {
            setRealmVisible(true)
          }
        }
      })

      const totalDuration = STRIKES[2].at + STRIKES[2].duration + 600
      if (elapsed >= totalDuration) {
        cancelAnimationFrame(rafRef.current)
        onComplete()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, drawLightning, onComplete, realmVisible])

  if (!active) return null

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          zIndex: 100, pointerEvents: 'none',
        }}
      />

      <AnimatePresence>
        {realmVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2.2, ease: 'easeOut' }}
            style={{
              position: 'fixed', inset: 0,
              zIndex: 99, pointerEvents: 'none',
              background: 'rgba(0,0,0,1)',
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
