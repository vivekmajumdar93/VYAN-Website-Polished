'use client'

import { useEffect, useRef, useCallback } from 'react'

// ─── Bezier path ───────────────────────────────────────────────────────────────

function bez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const m = 1 - t
  return m ** 3 * p0 + 3 * m ** 2 * t * p1 + 3 * m * t ** 2 * p2 + t ** 3 * p3
}

function buildPath(w: number, h: number, ex: number, ey: number): { x: number; y: number }[] {
  const cx = ex * w
  const cy = ey * h

  const edge = Math.floor(Math.random() * 4)
  let sx: number, sy: number
  if (edge === 0) { sx = w * (0.2 + Math.random() * 0.6); sy = -80 }
  else if (edge === 1) { sx = w + 80; sy = h * (0.2 + Math.random() * 0.6) }
  else if (edge === 2) { sx = w * (0.2 + Math.random() * 0.6); sy = h + 80 }
  else { sx = -80; sy = h * (0.2 + Math.random() * 0.6) }

  const exitEdge = (edge + 2) % 4
  let ex2: number, ey2: number
  if (exitEdge === 0) { ex2 = w * (0.2 + Math.random() * 0.6); ey2 = -80 }
  else if (exitEdge === 1) { ex2 = w + 80; ey2 = h * (0.2 + Math.random() * 0.6) }
  else if (exitEdge === 2) { ex2 = w * (0.2 + Math.random() * 0.6); ey2 = h + 80 }
  else { ex2 = -80; ey2 = h * (0.2 + Math.random() * 0.6) }

  const r = Math.min(w, h) * 0.18
  const angle = Math.atan2(cy - sy, cx - sx)
  const cp1x = sx + (cx - sx) * 0.45 + Math.cos(angle + 1.2) * r * 1.5
  const cp1y = sy + (cy - sy) * 0.45 + Math.sin(angle + 1.2) * r * 1.5
  const cp2x = cx + Math.cos(angle + Math.PI * 0.7) * r
  const cp2y = cy + Math.sin(angle + Math.PI * 0.7) * r

  const pts: { x: number; y: number }[] = []
  const N = 200
  for (let i = 0; i <= N; i++) {
    const t = i / N
    if (t < 0.55) {
      const u = t / 0.55
      pts.push({
        x: bez(u, sx, cp1x, cp2x, cx + Math.cos(angle + Math.PI) * r * 0.6),
        y: bez(u, sy, cp1y, cp2y, cy + Math.sin(angle + Math.PI) * r * 0.6),
      })
    } else {
      const u = (t - 0.55) / 0.45
      const nearX = cx + Math.cos(angle + Math.PI) * r * 0.6
      const nearY = cy + Math.sin(angle + Math.PI) * r * 0.6
      const midX = cx + Math.cos(angle + Math.PI * 1.5) * r * 0.8
      const midY = cy + Math.sin(angle + Math.PI * 1.5) * r * 0.8
      pts.push({
        x: bez(u, nearX, midX, ex2 + (cx - ex2) * 0.3, ex2),
        y: bez(u, nearY, midY, ey2 + (cy - ey2) * 0.3, ey2),
      })
    }
  }
  return pts
}

// ─── Particle tiers ───────────────────────────────────────────────────────────
// 0 = background dust, 1 = mid-ground spark, 2 = foreground pixie, 3 = queen pixie

interface Particle {
  anchorX: number; anchorY: number
  driftX: number; driftY: number; dvx: number; dvy: number
  orbitRx: number; orbitRy: number
  orbitSpeed: number; orbitPhase: number; orbitTilt: number
  size: number; tier: number; color: string
  twinkleSpeed: number; twinklePhase: number
  pathT: number
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CosmicStreamProps {
  active: boolean
  color: string
  colorSecondary?: string
  entityX?: number
  entityY?: number
  onComplete?: () => void
  duration?: number
}

export function CosmicStream({
  active, color, colorSecondary,
  entityX = 0.5, entityY = 0.44,
  onComplete, duration = 3600,
}: CosmicStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const secondary = colorSecondary ?? color

  const run = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const w = canvas.width
    const h = canvas.height

    const path = buildPath(w, h, entityX, entityY)
    const N = path.length
    const palette = [color, secondary, '#ffffff', '#ffffff', color, secondary, '#ffe0ff']

    // ── Particle count by tier ──
    // Tier 0: background dust   — 520 particles, tiny, dim
    // Tier 1: mid sparks        — 260 particles, medium, bright
    // Tier 2: foreground pixies —  80 particles, large, vivid
    // Tier 3: queen pixies      —  18 particles, massive, dazzling
    const TIER_COUNT = [520, 260, 80, 18]
    const TOTAL = TIER_COUNT.reduce((a, b) => a + b, 0)

    const particles: Particle[] = []
    let idx = 0
    for (let tier = 0; tier < 4; tier++) {
      for (let j = 0; j < TIER_COUNT[tier]; j++) {
        const pathT = idx / TOTAL
        const ptIdx = Math.min(Math.floor(pathT * N), N - 1)
        const pt = path[ptIdx]

        // Size, orbit radius, speed grow with tier (closer to camera = bigger, faster)
        const sizeBase = tier === 0 ? 0.3 + Math.random() * 1.0
          : tier === 1 ? 1.2 + Math.random() * 1.8
          : tier === 2 ? 2.6 + Math.random() * 2.8
          : 5.0 + Math.random() * 4.0

        const orbitMult = tier === 0 ? 1 : tier === 1 ? 1.6 : tier === 2 ? 2.8 : 4.5

        particles.push({
          anchorX: pt.x, anchorY: pt.y,
          driftX: 0, driftY: 0,
          dvx: (Math.random() - 0.5) * 0.012,
          dvy: (Math.random() - 0.5) * 0.012,
          orbitRx: (3 + Math.random() * 14) * orbitMult,
          orbitRy: (2 + Math.random() * 8) * orbitMult,
          orbitSpeed: (0.0005 + Math.random() * 0.002) * (1 + tier * 0.4),
          orbitPhase: Math.random() * Math.PI * 2,
          orbitTilt: Math.random() * Math.PI,
          size: sizeBase,
          tier,
          color: palette[Math.floor(Math.random() * palette.length)],
          twinkleSpeed: 0.04 + Math.random() * 0.09 * (1 + tier * 0.3),
          twinklePhase: Math.random() * Math.PI * 2,
          pathT,
        })
        idx++
      }
    }

    const startTime = performance.now()

    const draw = (now: number) => {
      const elapsed = now - startTime
      const globalT = Math.min(elapsed / duration, 1)
      ctx.clearRect(0, 0, w, h)

      const envelope = globalT < 0.12
        ? globalT / 0.12
        : globalT > 0.72
        ? 1 - (globalT - 0.72) / 0.28
        : 1

      const lead = Math.min(globalT * 1.7, 1)
      const trail = Math.max(globalT * 1.7 - 0.55, 0)

      // Render back-to-front: tier 0 first, queens last
      for (let tier = 0; tier < 4; tier++) {
        for (const p of particles) {
          if (p.tier !== tier) continue
          if (p.pathT > lead || p.pathT < trail) continue

          p.driftX += p.dvx
          p.driftY += p.dvy

          const oa = now * p.orbitSpeed + p.orbitPhase
          const lx = Math.cos(oa) * p.orbitRx
          const ly = Math.sin(oa) * p.orbitRy
          const ct = Math.cos(p.orbitTilt); const st = Math.sin(p.orbitTilt)
          const px = p.anchorX + lx * ct - ly * st + p.driftX
          const py = p.anchorY + lx * st + ly * ct + p.driftY

          const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(now * p.twinkleSpeed + p.twinklePhase))

          // Opacity scales up with tier for that "close to camera" pop
          const tierOpacity = tier === 0 ? 0.55 : tier === 1 ? 0.80 : tier === 2 ? 0.95 : 1.0
          const op = envelope * twinkle * tierOpacity

          if (tier >= 1) {
            // Sparks, pixies, queens — soft feathered cross-sparkle
            const rayCount = tier === 3 ? 6 : 4  // queens get a 6-ray starburst
            const rayLen = p.size * (tier === 2 ? 6.5 : tier === 3 ? 9.0 : 5.5)

            ctx.save()
            ctx.translate(px, py)
            ctx.rotate(now * (0.0004 + tier * 0.0003) + p.orbitPhase)
            for (let r = 0; r < rayCount; r++) {
              const ang = (r / rayCount) * Math.PI * 2
              const rl = rayLen
              const grd = ctx.createLinearGradient(0, 0, Math.cos(ang) * rl, Math.sin(ang) * rl)
              grd.addColorStop(0, `rgba(255,255,255,${op * (tier >= 2 ? 1.0 : 0.9)})`)
              grd.addColorStop(0.45, `${color}${Math.floor(op * 0.4 * 255).toString(16).padStart(2, '0')}`)
              grd.addColorStop(1, `${color}00`)
              ctx.beginPath()
              ctx.moveTo(0, 0)
              ctx.lineTo(Math.cos(ang) * rl, Math.sin(ang) * rl)
              ctx.strokeStyle = grd
              ctx.lineWidth = p.size * (tier === 3 ? 0.7 : 0.45)
              ctx.lineCap = 'round'
              ctx.stroke()
            }
            // Radiant core glow
            const coreR = p.size * (tier === 3 ? 4.0 : tier === 2 ? 3.2 : 2.8)
            const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR)
            cg.addColorStop(0, `rgba(255,255,255,${op})`)
            cg.addColorStop(0.3, `rgba(255,255,255,${op * 0.7})`)
            cg.addColorStop(0.6, `${color}${Math.floor(op * 0.65 * 255).toString(16).padStart(2, '0')}`)
            cg.addColorStop(1, `${color}00`)
            ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2)
            ctx.fillStyle = cg; ctx.fill()

            // Extra wide soft halo for queens and foreground pixies
            if (tier >= 2) {
              const haloR = p.size * (tier === 3 ? 14 : 9)
              const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR)
              hg.addColorStop(0, `${color}${Math.floor(op * 0.18 * 255).toString(16).padStart(2, '0')}`)
              hg.addColorStop(1, `${color}00`)
              ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2)
              ctx.fillStyle = hg; ctx.fill()
            }
            ctx.restore()
          } else {
            // Tier 0: tiny glowing motes
            const gr = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3.5)
            gr.addColorStop(0, `rgba(255,255,255,${op * 0.95})`)
            gr.addColorStop(0.35, `${color}${Math.floor(op * 0.55 * 255).toString(16).padStart(2, '0')}`)
            gr.addColorStop(1, `${color}00`)
            ctx.beginPath(); ctx.arc(px, py, p.size * 3.5, 0, Math.PI * 2)
            ctx.fillStyle = gr; ctx.fill()
            ctx.beginPath(); ctx.arc(px, py, p.size * 0.45, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(255,255,255,${op})`; ctx.fill()
          }
        }
      }

      // Bright frontrunner at leading edge
      if (lead < 1) {
        const lidx = Math.min(Math.floor(lead * N), N - 1)
        const lp = path[lidx]
        const lr = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 52)
        lr.addColorStop(0, `rgba(255,255,255,${0.95 * envelope})`)
        lr.addColorStop(0.25, `rgba(255,255,255,${0.5 * envelope})`)
        lr.addColorStop(0.5, `${color}${Math.floor(0.55 * envelope * 255).toString(16).padStart(2, '0')}`)
        lr.addColorStop(1, `${color}00`)
        ctx.beginPath(); ctx.arc(lp.x, lp.y, 52, 0, Math.PI * 2)
        ctx.fillStyle = lr; ctx.fill()
      }

      if (globalT < 1) {
        animRef.current = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, w, h)
        onComplete?.()
      }
    }

    animRef.current = requestAnimationFrame(draw)
  }, [color, secondary, entityX, entityY, duration, onComplete])

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animRef.current)
      const c = canvasRef.current
      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
      return
    }
    run()
    return () => cancelAnimationFrame(animRef.current)
  }, [active, run])

  return (
    <canvas ref={canvasRef} style={{
      position: 'fixed', inset: 0, width: '100%', height: '100%',
      zIndex: 45, pointerEvents: 'none',
    }} />
  )
}
