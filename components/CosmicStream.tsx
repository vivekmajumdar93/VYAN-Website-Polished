'use client'

import { useEffect, useRef, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StreamParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  isStar: boolean
  starPoints: number
  starSize: number
  twinkleSpeed: number
  twinklePhase: number
  orbitR: number
  orbitSpeed: number
  orbitPhase: number
}

interface StreamThread {
  points: { x: number; y: number }[]
  color: string
  width: number
  opacity: number
}

interface CosmicStreamConfig {
  // Entry edge: 0=top, 1=right, 2=bottom, 3=left, 4=top-right, 5=bottom-right, 6=bottom-left, 7=top-left
  entryEdge: number
  exitEdge: number
  color: string          // primary color hex
  colorSecondary: string // secondary color hex
  entityX: number        // entity center X (0-1 of canvas width)
  entityY: number        // entity center Y (0-1 of canvas height)
  orbitRadius: number    // how close stream orbits the entity
  duration: number       // total ms
}

// ─── Cubic bezier helpers ──────────────────────────────────────────────────────

function bezier(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): { x: number; y: number } {
  const mt = 1 - t
  return {
    x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
    y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
  }
}

function buildStreamPath(
  cfg: CosmicStreamConfig,
  w: number,
  h: number
): { x: number; y: number }[] {
  const ex = cfg.entityX * w
  const ey = cfg.entityY * h
  const r = cfg.orbitRadius

  // Entry point from edge
  const edgePoints: Record<number, { x: number; y: number }> = {
    0: { x: w * (0.3 + Math.random() * 0.4), y: -60 },
    1: { x: w + 60, y: h * (0.2 + Math.random() * 0.6) },
    2: { x: w * (0.2 + Math.random() * 0.6), y: h + 60 },
    3: { x: -60, y: h * (0.2 + Math.random() * 0.6) },
    4: { x: w + 60, y: -60 },
    5: { x: w + 60, y: h + 60 },
    6: { x: -60, y: h + 60 },
    7: { x: -60, y: -60 },
  }

  const entry = edgePoints[cfg.entryEdge]
  const exit = edgePoints[cfg.exitEdge]

  // Orbit tangent points — stream curves around entity
  // Pick orbit approach angle based on entry direction
  const entryAngle = Math.atan2(ey - entry.y, ex - entry.x)
  const orbitStart = {
    x: ex + Math.cos(entryAngle + Math.PI * 0.6) * r,
    y: ey + Math.sin(entryAngle + Math.PI * 0.6) * r,
  }
  const orbitPeak = {
    x: ex + Math.cos(entryAngle + Math.PI) * r * 1.1,
    y: ey + Math.sin(entryAngle + Math.PI) * r * 1.1,
  }
  const orbitEnd = {
    x: ex + Math.cos(entryAngle + Math.PI * 1.4) * r,
    y: ey + Math.sin(entryAngle + Math.PI * 1.4) * r,
  }

  // Build full path: entry → approach → orbit → exit
  const pts: { x: number; y: number }[] = []
  const segs = 120

  // Phase 1: entry → orbitStart (40% of path)
  const cp1a = {
    x: entry.x + (orbitStart.x - entry.x) * 0.4 + (Math.random() - 0.5) * w * 0.2,
    y: entry.y + (orbitStart.y - entry.y) * 0.4 + (Math.random() - 0.5) * h * 0.2,
  }
  const cp1b = {
    x: orbitStart.x - (ex - orbitStart.x) * 0.3,
    y: orbitStart.y - (ey - orbitStart.y) * 0.3,
  }
  for (let i = 0; i <= Math.floor(segs * 0.35); i++) {
    const t = i / Math.floor(segs * 0.35)
    pts.push(bezier(t, entry, cp1a, cp1b, orbitStart))
  }

  // Phase 2: orbit around entity (40% of path)
  const cp2a = {
    x: orbitStart.x + (orbitPeak.x - orbitStart.x) * 0.5 + (Math.random() - 0.5) * r * 0.3,
    y: orbitStart.y + (orbitPeak.y - orbitStart.y) * 0.5 + (Math.random() - 0.5) * r * 0.3,
  }
  const cp2b = {
    x: orbitPeak.x + (orbitEnd.x - orbitPeak.x) * 0.5 + (Math.random() - 0.5) * r * 0.3,
    y: orbitPeak.y + (orbitEnd.y - orbitPeak.y) * 0.5 + (Math.random() - 0.5) * r * 0.3,
  }
  for (let i = 1; i <= Math.floor(segs * 0.40); i++) {
    const t = i / Math.floor(segs * 0.40)
    pts.push(bezier(t, orbitStart, cp2a, cp2b, orbitEnd))
  }

  // Phase 3: orbitEnd → exit (remaining)
  const cp3a = {
    x: orbitEnd.x + (exit.x - orbitEnd.x) * 0.3 + (Math.random() - 0.5) * w * 0.15,
    y: orbitEnd.y + (exit.y - orbitEnd.y) * 0.3 + (Math.random() - 0.5) * h * 0.15,
  }
  const cp3b = {
    x: exit.x - (exit.x - orbitEnd.x) * 0.2,
    y: exit.y - (exit.y - orbitEnd.y) * 0.2,
  }
  for (let i = 1; i <= Math.floor(segs * 0.25); i++) {
    const t = i / Math.floor(segs * 0.25)
    pts.push(bezier(t, orbitEnd, cp3a, cp3b, exit))
  }

  return applyWobble(pts, w, h)
}

// ─── Stardust wobble ────────────────────────────────────────────────────────────
// Bends the bezier path with layered sine drift, perpendicular to its direction
// of travel — turns the smooth curve into a meandering, swirling trail like a
// fairy's dust settling through the air, rather than a clean geometric arc.
function applyWobble(
  pts: { x: number; y: number }[],
  w: number,
  h: number
): { x: number; y: number }[] {
  const scale = Math.min(w, h)
  const amp1 = scale * 0.020
  const amp2 = scale * 0.010
  const amp3 = scale * 0.005
  const freq1 = 2.5 + Math.random() * 2
  const freq2 = 6 + Math.random() * 3
  const freq3 = 14 + Math.random() * 6
  const phase1 = Math.random() * Math.PI * 2
  const phase2 = Math.random() * Math.PI * 2
  const phase3 = Math.random() * Math.PI * 2

  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p
    const prev = pts[i - 1]
    const next = pts[Math.min(i + 1, pts.length - 1)]
    const tangent = Math.atan2(next.y - prev.y, next.x - prev.x)
    const perp = tangent + Math.PI / 2
    const t = i / (pts.length - 1)
    const taper = Math.sin(t * Math.PI) // fades to 0 at both ends
    const wob =
      (Math.sin(t * Math.PI * 2 * freq1 + phase1) * amp1 +
        Math.sin(t * Math.PI * 2 * freq2 + phase2) * amp2 +
        Math.sin(t * Math.PI * 2 * freq3 + phase3) * amp3) *
      taper
    return { x: p.x + Math.cos(perp) * wob, y: p.y + Math.sin(perp) * wob }
  })
}

// ─── Draw twinkling sparkle ─────────────────────────────────────────────────────
// A soft mote of stardust — a glowing core with short, feathered rays that
// fade to nothing. No hard geometric cross-spikes; reads as a twinkle, not a star.
function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  r: number, points: number,
  color: string, opacity: number,
  rotation = 0
) {
  if (opacity < 0.01) return
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  // Short feathered rays — gentle glints, not spikes
  const rayLen = r * 1.6
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2
    const tipX = Math.cos(angle) * rayLen
    const tipY = Math.sin(angle) * rayLen
    const grd = ctx.createLinearGradient(0, 0, tipX, tipY)
    grd.addColorStop(0, `rgba(255,255,255,${opacity * 0.6})`)
    grd.addColorStop(1, `${color}00`)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(tipX, tipY)
    ctx.strokeStyle = grd
    ctx.lineWidth = r * 0.4
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  // Soft glow core
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2)
  glow.addColorStop(0, `rgba(255,255,255,${opacity})`)
  glow.addColorStop(0.4, `${color}${Math.floor(opacity * 160).toString(16).padStart(2, '0')}`)
  glow.addColorStop(1, `${color}00`)
  ctx.beginPath()
  ctx.arc(0, 0, r * 2, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()

  // Bright center dot
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,255,255,${opacity})`
  ctx.fill()

  ctx.restore()
}

// ─── Main component ────────────────────────────────────────────────────────────

interface CosmicStreamProps {
  active: boolean
  color: string          // primary
  colorSecondary?: string
  entityX?: number       // 0–1, default 0.5
  entityY?: number       // 0–1, default 0.44
  onComplete?: () => void
  duration?: number      // ms, default 3200
}

export function CosmicStream({
  active,
  color,
  colorSecondary,
  entityX = 0.5,
  entityY = 0.44,
  onComplete,
  duration = 3200,
}: CosmicStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const startRef = useRef<number>(0)

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

    // Pick random entry/exit edges (opposite-ish)
    const entryEdge = Math.floor(Math.random() * 8)
    const exitEdge = (entryEdge + 3 + Math.floor(Math.random() * 3)) % 8

    const orbitRadius = Math.min(w, h) * 0.22

    const cfg: CosmicStreamConfig = {
      entryEdge, exitEdge, color, colorSecondary: secondary,
      entityX, entityY, orbitRadius, duration,
    }

    // Build 3 parallel stream threads (like the images show multiple nested curves)
    const basePath = buildStreamPath(cfg, w, h)

    // Create offset threads — slight lateral offsets for the nested curve look
    const threads: StreamThread[] = [
      {
        points: basePath.map((p, i) => {
          const angle = i < basePath.length - 1
            ? Math.atan2(basePath[i + 1].y - p.y, basePath[i + 1].x - p.x)
            : 0
          const perp = angle + Math.PI / 2
          return { x: p.x + Math.cos(perp) * 8, y: p.y + Math.sin(perp) * 8 }
        }),
        color,
        width: 1.2,
        opacity: 0.6,
      },
      {
        points: basePath,
        color: '#ffffff',
        width: 0.8,
        opacity: 0.75,
      },
      {
        points: basePath.map((p, i) => {
          const angle = i < basePath.length - 1
            ? Math.atan2(basePath[i + 1].y - p.y, basePath[i + 1].x - p.x)
            : 0
          const perp = angle + Math.PI / 2
          return { x: p.x - Math.cos(perp) * 12, y: p.y - Math.sin(perp) * 12 }
        }),
        color: secondary,
        width: 1.5,
        opacity: 0.45,
      },
    ]

    // Build particles along path — denser, smaller, swirling: a stardust trail
    const particles: StreamParticle[] = []
    const particleCount = 140

    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount
      const ptIdx = Math.floor(t * (basePath.length - 1))
      const pt = basePath[ptIdx]
      const isStar = Math.random() < 0.14
      const starSize = 1.5 + Math.random() * 3

      particles.push({
        x: pt.x + (Math.random() - 0.5) * 24,
        y: pt.y + (Math.random() - 0.5) * 24,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: isStar ? starSize : 0.6 + Math.random() * 1.8,
        opacity: 0,
        isStar,
        starPoints: Math.random() < 0.5 ? 4 : 6,
        starSize,
        twinkleSpeed: 0.05 + Math.random() * 0.08,
        twinklePhase: Math.random() * Math.PI * 2,
        orbitR: 2 + Math.random() * 9,
        orbitSpeed: 0.0015 + Math.random() * 0.003,
        orbitPhase: Math.random() * Math.PI * 2,
      })
    }

    // Bright star nodes at key points along path (like the images)
    const starNodes: { ptIdx: number; size: number; points: number; rotation: number }[] = []
    const nodePositions = [0.12, 0.28, 0.5, 0.68, 0.85]
    nodePositions.forEach(t => {
      const ptIdx = Math.floor(t * (basePath.length - 1))
      starNodes.push({
        ptIdx,
        size: 4 + Math.random() * 6,
        points: Math.random() < 0.6 ? 4 : 6,
        rotation: Math.random() * Math.PI,
      })
    })

    // Tiny scatter dots along path
    const scatterDots: { x: number; y: number; r: number; t: number }[] = []
    for (let i = 0; i < 120; i++) {
      const t = Math.random()
      const ptIdx = Math.floor(t * (basePath.length - 1))
      const pt = basePath[ptIdx]
      scatterDots.push({
        x: pt.x + (Math.random() - 0.5) * 60,
        y: pt.y + (Math.random() - 0.5) * 60,
        r: 0.5 + Math.random() * 1.5,
        t,
      })
    }

    startRef.current = performance.now()

    const draw = (now: number) => {
      const elapsed = Math.max(now - startRef.current, 0)
      const globalT = Math.min(elapsed / duration, 1)

      ctx.clearRect(0, 0, w, h)

      // Global envelope — bell curve with longer tail
      const envelope = globalT < 0.15
        ? globalT / 0.15
        : globalT > 0.75
        ? 1 - (globalT - 0.75) / 0.25
        : 1

      // How far along the stream has traveled (leading edge)
      const leadT = Math.min(globalT * 1.6, 1)
      const trailT = Math.max(globalT * 1.6 - 0.4, 0)

      // ── Draw stream threads ─────────────────────────────────────────────────
      threads.forEach(thread => {
        const pts = thread.points
        const startIdx = Math.floor(trailT * (pts.length - 1))
        const endIdx = Math.floor(leadT * (pts.length - 1))
        if (endIdx - startIdx < 2) return

        ctx.beginPath()
        ctx.moveTo(pts[startIdx].x, pts[startIdx].y)
        for (let i = startIdx + 1; i <= endIdx; i++) {
          ctx.lineTo(pts[i].x, pts[i].y)
        }
        ctx.strokeStyle = `${thread.color}${Math.floor(thread.opacity * envelope * 200).toString(16).padStart(2, '0')}`
        ctx.lineWidth = thread.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()

        // Glow pass — wider, more transparent
        ctx.beginPath()
        ctx.moveTo(pts[startIdx].x, pts[startIdx].y)
        for (let i = startIdx + 1; i <= endIdx; i++) {
          ctx.lineTo(pts[i].x, pts[i].y)
        }
        ctx.strokeStyle = `${thread.color}${Math.floor(thread.opacity * envelope * 60).toString(16).padStart(2, '0')}`
        ctx.lineWidth = thread.width * 5
        ctx.stroke()
      })

      // ── Leading edge glow ───────────────────────────────────────────────────
      if (leadT < 1) {
        const leadIdx = Math.floor(leadT * (basePath.length - 1))
        const lp = basePath[leadIdx]
        const leadGlow = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 40)
        leadGlow.addColorStop(0, `rgba(255,255,255,${0.9 * envelope})`)
        leadGlow.addColorStop(0.2, `${color}${Math.floor(0.7 * envelope * 255).toString(16).padStart(2, '0')}`)
        leadGlow.addColorStop(1, `${color}00`)
        ctx.beginPath()
        ctx.arc(lp.x, lp.y, 40, 0, Math.PI * 2)
        ctx.fillStyle = leadGlow
        ctx.fill()
      }

      // ── Scatter dots ────────────────────────────────────────────────────────
      scatterDots.forEach(dot => {
        if (dot.t > leadT || dot.t < trailT - 0.1) return
        const dotOpacity = envelope * 0.5 * (0.5 + 0.5 * Math.sin(now * 0.003 + dot.t * 10))
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${dotOpacity})`
        ctx.fill()
      })

      // ── Particles ───────────────────────────────────────────────────────────
      particles.forEach((p, i) => {
        const pT = i / particles.length
        if (pT > leadT || pT < trailT - 0.05) return

        p.x += p.vx
        p.y += p.vy
        // Small circular drift around the particle's anchor — the swirl that
        // turns a straight trail of dots into settling, swirling stardust.
        const orbX = Math.cos(now * p.orbitSpeed + p.orbitPhase) * p.orbitR
        const orbY = Math.sin(now * p.orbitSpeed * 1.3 + p.orbitPhase) * p.orbitR
        const twinkle = 0.5 + 0.5 * Math.sin(now * p.twinkleSpeed + p.twinklePhase)
        const pOpacity = envelope * twinkle * 0.7

        if (p.isStar) {
          drawStar(ctx, p.x + orbX, p.y + orbY, p.size * 0.6, p.starPoints, color, pOpacity * 0.8, now * 0.001)
        } else {
          ctx.beginPath()
          ctx.arc(p.x + orbX, p.y + orbY, p.size * 0.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${pOpacity})`
          ctx.fill()
        }
      })

      // ── Star nodes ──────────────────────────────────────────────────────────
      starNodes.forEach(sn => {
        const snT = sn.ptIdx / (basePath.length - 1)
        if (snT > leadT || snT < trailT) return
        const pt = basePath[sn.ptIdx]
        const pulse = 0.7 + 0.3 * Math.sin(now * 0.004 + sn.ptIdx)
        const snOpacity = envelope * pulse

        // Alternate between 4-point cross stars and 6-point stars — like images
        drawStar(ctx, pt.x, pt.y, sn.size, sn.points, color, snOpacity, sn.rotation + now * 0.0005)
      })

      // ── Entity encounter glow — brightest when stream is at orbit ───────────
      const orbitT = 0.35 + 0.40 / 2  // midpoint of orbit phase
      const orbitProximity = 1 - Math.min(Math.abs(globalT - orbitT) / 0.3, 1)
      if (orbitProximity > 0.01) {
        const ex = entityX * w
        const ey = entityY * h
        const encounterR = 120 * orbitProximity
        const encounterGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, encounterR)
        encounterGlow.addColorStop(0, `${color}${Math.floor(0.12 * orbitProximity * 255).toString(16).padStart(2, '0')}`)
        encounterGlow.addColorStop(0.5, `${color}${Math.floor(0.06 * orbitProximity * 255).toString(16).padStart(2, '0')}`)
        encounterGlow.addColorStop(1, `${color}00`)
        ctx.beginPath()
        ctx.arc(ex, ey, encounterR, 0, Math.PI * 2)
        ctx.fillStyle = encounterGlow
        ctx.fill()
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
      const canvas = canvasRef.current
      if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    run()
    return () => cancelAnimationFrame(animRef.current)
  }, [active, run])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    />
  )
}
