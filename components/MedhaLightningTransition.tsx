'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MedhaLightningTransitionProps {
  active: boolean
  medhaImageSrc: string
  onComplete: () => void
}

const STRIKES = [
  { at: 800,  duration: 90,   medhaX: 38, medhaY: 42, medhaScale: 0.72 },
  { at: 1400, duration: 85,   medhaX: 44, medhaY: 38, medhaScale: 0.76 },
  { at: 2100, duration: 2400, medhaX: 50, medhaY: 40, medhaScale: 0.82 },
]

export function MedhaLightningTransition({
  active, medhaImageSrc, onComplete
}: MedhaLightningTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number | null>(null)
  const [medhaStrike, setMedhaStrike] = useState<{
    visible: boolean
    x: number; y: number; scale: number
    opacity: number; strikeIdx: number
  } | null>(null)
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

      // Violet-purple glow — Medhā's palette
      ctx.save()
      ctx.filter = 'blur(8px)'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.quadraticCurveTo(mx, my, ex, ey)
      ctx.strokeStyle = `rgba(140,80,255,${opacity * intensity * 0.35})`
      ctx.lineWidth = 7
      ctx.stroke()
      ctx.filter = 'none'

      // Luminous violet-white core
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
          setMedhaStrike({
            visible: true,
            x: strike.medhaX, y: strike.medhaY,
            scale: strike.medhaScale,
            opacity: 1, strikeIdx: i,
          })
          if (!isSustained) {
            setTimeout(() => {
              setMedhaStrike(prev => prev?.strikeIdx === i ? null : prev)
            }, strike.duration)
          }
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

          // Deep violet flash — NOT white
          const flashOp2 = isSustained ? flashOp * 0.18 : flashOp * 0.55
          ctx.fillStyle = `rgba(80,40,160,${flashOp2})`
          ctx.fillRect(0, 0, W, H)

          // Crimson edge vignette on flash
          if (flashOp > 0.3) {
            const vign = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.75)
            vign.addColorStop(0, 'rgba(0,0,0,0)')
            vign.addColorStop(1, `rgba(120,20,60,${flashOp * 0.25})`)
            ctx.fillStyle = vign
            ctx.fillRect(0, 0, W, H)
          }

          if (flashOp > 0.1) {
            const strikeX = W * strike.medhaX / 100
            // Main bolt — violet
            drawLightning(ctx, W, H,
              strikeX + (Math.random()-0.5)*W*0.2, 0,
              strikeX + (Math.random()-0.5)*W*0.05, H*0.35,
              flashOp, true
            )
            // Secondary bolt — electric blue
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

          if (isSustained && flashProgress > 0.3 && !realmVisible) {
            setRealmVisible(true)
          }
        }
      })

      const totalDuration = STRIKES[2].at + STRIKES[2].duration + 600
      if (elapsed >= totalDuration) {
        cancelAnimationFrame(rafRef.current)
        setMedhaStrike(null)
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
        {medhaStrike?.visible && (
          <motion.div
            key={`strike-${medhaStrike.strikeIdx}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: medhaStrike.strikeIdx === 2 ? [1, 1, 0] : 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: medhaStrike.strikeIdx === 2 ? 2.4 : 0.05,
              times: medhaStrike.strikeIdx === 2 ? [0, 0.3, 1] : undefined,
              ease: 'easeOut',
            }}
            style={{
              position: 'fixed',
              left: `${medhaStrike.x}%`,
              top: `${medhaStrike.y}%`,
              transform: 'translate(-50%, -50%)',
              width: `${medhaStrike.scale * 100}vmin`,
              height: `${medhaStrike.scale * 100}vmin`,
              zIndex: 101, pointerEvents: 'none',
              mixBlendMode: 'screen',
              filter: medhaStrike.strikeIdx === 2
                ? 'brightness(1.6) saturate(2.0)'
                : 'brightness(2.2) saturate(1.8)',
            }}
          >
            <img
              src={medhaImageSrc}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
