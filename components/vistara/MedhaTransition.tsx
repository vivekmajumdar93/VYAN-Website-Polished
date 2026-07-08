'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Filament particle ─────────────────────────────────────────────────────────
interface Filament {
  angle: number
  segments: { x: number; y: number }[]
  color: string
  width: number
  opacity: number
  speed: number
  length: number
}

const WING_COLORS = ['#1a1aff', '#7b2fff', '#c026d3', '#dc2626', '#00c4cc', '#a855f7']

function buildFilament(cx: number, cy: number, angle: number): Filament {
  const length = 90 + Math.random() * 200
  const segs = 28
  const segments: { x: number; y: number }[] = []
  let x = cx, y = cy

  for (let i = 0; i < segs; i++) {
    const drift = (Math.random() - 0.5) * 18
    const a = angle + drift * 0.08
    x += Math.cos(a) * (length / segs)
    y += Math.sin(a) * (length / segs)
    segments.push({ x, y })
  }

  return {
    angle,
    segments,
    color: WING_COLORS[Math.floor(Math.random() * WING_COLORS.length)],
    width: 0.4 + Math.random() * 1.2,
    opacity: 0,
    speed: 0.3 + Math.random() * 0.5,
    length,
  }
}

// ─── Transition canvas ─────────────────────────────────────────────────────────
function TransitionCanvas({ direction, onComplete }: {
  direction: 'enter' | 'exit'
  onComplete: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    // 72 filaments radiating outward from center
    const filaments: Filament[] = Array.from({ length: 72 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 72 + (Math.random() - 0.5) * 0.15
      return buildFilament(cx, cy, angle)
    })

    // Particle nodes on filaments
    interface Node { x: number; y: number; r: number; color: string; opacity: number }
    const particleNodes: Node[] = []
    filaments.forEach(fil => {
      const count = 2 + Math.floor(Math.random() * 4)
      for (let i = 0; i < count; i++) {
        const idx = Math.floor((i + 1) / (count + 1) * fil.segments.length)
        const seg = fil.segments[Math.min(idx, fil.segments.length - 1)]
        particleNodes.push({
          x: seg.x, y: seg.y,
          r: 0.8 + Math.random() * 2,
          color: fil.color,
          opacity: 0,
        })
      }
    })

    let progress = 0
    let animId: number
    const totalDuration = direction === 'enter' ? 1.8 : 1.2

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      progress += direction === 'enter' ? 0.006 : 0.010

      // Overall envelope — bell curve
      const envelope = Math.sin(Math.min(progress / totalDuration, 1) * Math.PI)

      filaments.forEach(fil => {
        const localProgress = Math.min(progress * fil.speed * 1.4, 1)
        fil.opacity = envelope * 0.85

        if (fil.opacity < 0.01) return

        const drawCount = Math.max(2, Math.floor(fil.segments.length * localProgress))

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        for (let i = 0; i < drawCount; i++) {
          ctx.lineTo(fil.segments[i].x, fil.segments[i].y)
        }

        const alpha = Math.floor(fil.opacity * 180).toString(16).padStart(2, '0')
        ctx.strokeStyle = `${fil.color}${alpha}`
        ctx.lineWidth = fil.width
        ctx.stroke()

        // Tip glow
        if (drawCount > 2) {
          const tip = fil.segments[drawCount - 1]
          ctx.beginPath()
          ctx.arc(tip.x, tip.y, fil.width * 2, 0, Math.PI * 2)
          ctx.fillStyle = `${fil.color}${Math.floor(fil.opacity * 200).toString(16).padStart(2, '0')}`
          ctx.fill()
        }
      })

      // Particle nodes glow
      particleNodes.forEach(node => {
        node.opacity = envelope * (0.5 + Math.random() * 0.3)
        if (node.opacity < 0.02) return
        const alpha = Math.floor(node.opacity * 180).toString(16).padStart(2, '0')
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fillStyle = `${node.color}${alpha}`
        ctx.fill()
      })

      // Central void orb — grows then shrinks
      const orbR = Math.min(progress * 80, 40) * envelope
      if (orbR > 0.5) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR)
        grad.addColorStop(0, `rgba(26,26,255,${0.3 * envelope})`)
        grad.addColorStop(0.4, `rgba(123,47,255,${0.15 * envelope})`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.beginPath()
        ctx.arc(cx, cy, orbR, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      if (progress < totalDuration + 0.3) {
        animId = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        cancelAnimationFrame(animId)
        onComplete()
      }
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [direction, onComplete])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}

// ─── MedhaTransition page ──────────────────────────────────────────────────────

type Phase = 'filaments' | 'blackout' | 'done'

function MedhaTransitionInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [phase, setPhase] = useState<Phase>('filaments')

  const handleFilamentsDone = useCallback(() => {
    setPhase('blackout')
  }, [])

  useEffect(() => {
    if (phase === 'blackout') {
      const t = setTimeout(() => {
        const query = searchParams?.toString()
        router.replace(query ? `/medha?${query}` : '/medha')
      }, 700)
      return () => clearTimeout(t)
    }
  }, [phase, router, searchParams])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000 }}>
      <AnimatePresence>
        {phase === 'filaments' && (
          <motion.div
            key="filaments"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <TransitionCanvas direction="enter" onComplete={handleFilamentsDone} />
          </motion.div>
        )}

        {phase === 'blackout' && (
          <motion.div
            key="blackout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'fixed', inset: 0, background: '#000' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function MedhaTransitionPage() {
  return (
    <Suspense>
      <MedhaTransitionInner />
    </Suspense>
  )
}

// ─── MedhaExitTransition — used inside /medha to return to Śūnya ───────────────

export function MedhaExitTransition({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000 }}
    >
      <TransitionCanvas direction="exit" onComplete={onComplete} />
    </motion.div>
  )
}
