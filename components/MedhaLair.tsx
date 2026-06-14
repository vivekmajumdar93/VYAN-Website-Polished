'use client'

import { useEffect, useRef, useCallback } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Pixie {
  x: number; y: number
  vx: number; vy: number
  phase: number; phaseSpeed: number
  orbitR: number; orbitAngle: number; orbitSpeed: number
  depth: number       // 0–1, higher = closer
  size: number
  opacity: number
  wingPhase: number
  reacting: boolean
  reactTimer: number
}

interface ArchFragment {
  x: number; y: number
  w: number; h: number
  type: 'arch' | 'spire' | 'column' | 'shard'
  rotation: number
  rotSpeed: number
  depth: number
  opacity: number
  driftX: number; driftY: number
}

interface CastlePlacement {
  cx: number      // center x, px
  baseY: number   // ground line, px
  scale: number   // depth/size multiplier
}

interface LightningState {
  nextFlash: number
  flashStart: number
  flashDuration: number
  bolt: { x: number; y: number }[]
  near: CastlePlacement
  far: CastlePlacement
}

// ─── Draw helpers ──────────────────────────────────────────────────────────────

function drawSpire(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, w: number, opacity: number) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x - w / 2, y + h)
  ctx.lineTo(x + w / 2, y + h)
  ctx.closePath()
  const g = ctx.createLinearGradient(x, y, x, y + h)
  g.addColorStop(0, 'rgba(160,140,255,0.9)')
  g.addColorStop(0.4, 'rgba(80,60,180,0.5)')
  g.addColorStop(1, 'rgba(20,10,60,0.0)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()
}

function drawArch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opacity: number) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.strokeStyle = 'rgba(140,120,255,0.8)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.moveTo(x - w / 2, y + h)
  ctx.lineTo(x - w / 2, y + h * 0.3)
  ctx.quadraticCurveTo(x, y, x + w / 2, y + h * 0.3)
  ctx.lineTo(x + w / 2, y + h)
  ctx.stroke()
  ctx.restore()
}

function drawThrone(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number, opacity: number, t: number) {
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(cx, cy)

  const pulse = 1 + Math.sin(t * 0.0008) * 0.015
  ctx.scale(scale * pulse, scale * pulse)

  // ── Throne base ──────────────────────────────────────────────────────────
  const baseW = 120, baseH = 18
  const g0 = ctx.createLinearGradient(-baseW / 2, 0, baseW / 2, 0)
  g0.addColorStop(0, 'rgba(60,40,160,0.0)')
  g0.addColorStop(0.3, 'rgba(120,80,255,0.6)')
  g0.addColorStop(0.7, 'rgba(120,80,255,0.6)')
  g0.addColorStop(1, 'rgba(60,40,160,0.0)')
  ctx.fillStyle = g0
  ctx.fillRect(-baseW / 2, 20, baseW, baseH)

  // ── Seat ─────────────────────────────────────────────────────────────────
  const seatW = 80, seatH = 12
  const g1 = ctx.createLinearGradient(-seatW / 2, 0, seatW / 2, 0)
  g1.addColorStop(0, 'rgba(80,50,200,0.0)')
  g1.addColorStop(0.3, 'rgba(160,100,255,0.7)')
  g1.addColorStop(0.7, 'rgba(160,100,255,0.7)')
  g1.addColorStop(1, 'rgba(80,50,200,0.0)')
  ctx.fillStyle = g1
  ctx.fillRect(-seatW / 2, 8, seatW, seatH)

  // ── Back rest — tall central panel ───────────────────────────────────────
  const backW = 55, backH = 110
  const g2 = ctx.createLinearGradient(0, -backH, 0, 8)
  g2.addColorStop(0, 'rgba(200,160,255,0.0)')
  g2.addColorStop(0.15, 'rgba(180,120,255,0.5)')
  g2.addColorStop(0.7, 'rgba(100,60,220,0.4)')
  g2.addColorStop(1, 'rgba(80,40,180,0.0)')
  ctx.fillStyle = g2
  ctx.beginPath()
  ctx.moveTo(-backW / 2, 8)
  ctx.lineTo(-backW / 2 + 6, -backH * 0.6)
  ctx.lineTo(-backW / 2 + 2, -backH)
  ctx.lineTo(backW / 2 - 2, -backH)
  ctx.lineTo(backW / 2 - 6, -backH * 0.6)
  ctx.lineTo(backW / 2, 8)
  ctx.closePath()
  ctx.fill()

  // ── Finial — top ornament ─────────────────────────────────────────────────
  const finialGlow = ctx.createRadialGradient(0, -backH, 0, 0, -backH, 28)
  finialGlow.addColorStop(0, `rgba(220,200,255,${0.7 + 0.3 * Math.sin(t * 0.002)})`)
  finialGlow.addColorStop(0.4, 'rgba(140,80,255,0.3)')
  finialGlow.addColorStop(1, 'rgba(80,40,200,0.0)')
  ctx.beginPath()
  ctx.arc(0, -backH, 28, 0, Math.PI * 2)
  ctx.fillStyle = finialGlow
  ctx.fill()

  // Finial gem
  ctx.beginPath()
  ctx.arc(0, -backH, 5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,240,255,${0.8 + 0.2 * Math.sin(t * 0.003)})`
  ctx.fill()

  // ── Side pillars ──────────────────────────────────────────────────────────
  ;[-44, 44].forEach(px => {
    const pg = ctx.createLinearGradient(px, -80, px, 20)
    pg.addColorStop(0, 'rgba(160,100,255,0.0)')
    pg.addColorStop(0.2, 'rgba(120,80,220,0.5)')
    pg.addColorStop(0.8, 'rgba(80,50,180,0.4)')
    pg.addColorStop(1, 'rgba(60,30,140,0.0)')
    ctx.fillStyle = pg
    ctx.fillRect(px - 4, -80, 8, 100)

    // Pillar top gem
    const gemGlow = ctx.createRadialGradient(px, -80, 0, px, -80, 14)
    gemGlow.addColorStop(0, `rgba(200,170,255,${0.5 + 0.3 * Math.sin(t * 0.0025 + px)})`)
    gemGlow.addColorStop(1, 'rgba(100,60,200,0.0)')
    ctx.beginPath()
    ctx.arc(px, -80, 14, 0, Math.PI * 2)
    ctx.fillStyle = gemGlow
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px, -80, 3, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(240,220,255,0.9)`
    ctx.fill()
  })

  // ── Energy filaments radiating from throne ─────────────────────────────────
  const filCount = 8
  for (let i = 0; i < filCount; i++) {
    const angle = (i / filCount) * Math.PI * 2 + t * 0.0003
    const len = 60 + Math.sin(t * 0.001 + i) * 15
    const fx = Math.cos(angle) * len
    const fy = Math.sin(angle) * len - backH * 0.3
    const filOpacity = (0.15 + 0.1 * Math.sin(t * 0.002 + i)) * opacity
    ctx.beginPath()
    ctx.moveTo(0, -backH * 0.3)
    ctx.lineTo(fx, fy)
    ctx.strokeStyle = `rgba(180,140,255,${filOpacity / opacity})`
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  ctx.restore()
}

function drawPixie(ctx: CanvasRenderingContext2D, p: Pixie, t: number) {
  const wingSpan = p.size * (1 + 0.4 * Math.sin(t * 0.012 + p.wingPhase))
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3)
  const baseOpacity = p.depth * p.opacity
  glow.addColorStop(0, `rgba(200,180,255,${baseOpacity * 0.9})`)
  glow.addColorStop(0.4, `rgba(120,80,255,${baseOpacity * 0.4})`)
  glow.addColorStop(1, 'rgba(80,40,200,0.0)')
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()

  // Core body
  ctx.beginPath()
  ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(240,230,255,${baseOpacity})`
  ctx.fill()

  // Wings — tiny ellipses
  ctx.save()
  ctx.translate(p.x, p.y)
  ;[[-1, -0.4], [1, -0.4], [-0.8, 0.3], [0.8, 0.3]].forEach(([wx, wy]) => {
    ctx.beginPath()
    ctx.ellipse(
      wx * wingSpan, wy * wingSpan * 0.8,
      wingSpan * 0.9, wingSpan * 0.4,
      wx < 0 ? -0.4 : 0.4,
      0, Math.PI * 2
    )
    ctx.strokeStyle = `rgba(200,180,255,${baseOpacity * 0.6})`
    ctx.lineWidth = 0.5
    ctx.stroke()
  })
  ctx.restore()

  // Trail particles
  if (p.reacting) {
    for (let i = 0; i < 3; i++) {
      const tx = p.x + (Math.random() - 0.5) * 20
      const ty = p.y + (Math.random() - 0.5) * 20
      ctx.beginPath()
      ctx.arc(tx, ty, Math.random() * 1.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(200,170,255,${baseOpacity * 0.5})`
      ctx.fill()
    }
  }
}

function drawCastleSilhouette(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  cx: number, baseY: number, scale: number,
  opacity: number, t: number
) {
  const castleW = w * 0.55 * scale
  const castleH = h * 0.35 * scale

  if (opacity < 0.005) return
  ctx.save()
  ctx.globalAlpha = opacity

  // Atmospheric haze behind castle
  const haze = ctx.createRadialGradient(cx, baseY - castleH * 0.3, 0, cx, baseY - castleH * 0.3, castleW * 0.7)
  haze.addColorStop(0, 'rgba(60,30,120,0.08)')
  haze.addColorStop(0.5, 'rgba(40,20,90,0.04)')
  haze.addColorStop(1, 'rgba(20,10,50,0.0)')
  ctx.beginPath()
  ctx.arc(cx, baseY - castleH * 0.3, castleW * 0.7, 0, Math.PI * 2)
  ctx.fillStyle = haze
  ctx.fill()

  // Castle body — barely visible silhouette
  const bodyGrad = ctx.createLinearGradient(cx, baseY - castleH, cx, baseY)
  bodyGrad.addColorStop(0, 'rgba(30,15,80,0.0)')
  bodyGrad.addColorStop(0.3, 'rgba(25,12,70,0.12)')
  bodyGrad.addColorStop(0.7, 'rgba(20,10,60,0.18)')
  bodyGrad.addColorStop(1, 'rgba(15,8,50,0.0)')
  ctx.fillStyle = bodyGrad
  ctx.fillRect(cx - castleW * 0.38, baseY - castleH * 0.7, castleW * 0.76, castleH * 0.7)

  // Main spires — varying heights
  const spireData = [
    { ox: 0, h: 1.0, w: 0.7 },
    { ox: -0.15, h: 0.75, w: 0.5 },
    { ox: 0.15, h: 0.70, w: 0.5 },
    { ox: -0.28, h: 0.55, w: 0.4 },
    { ox: 0.28, h: 0.50, w: 0.4 },
    { ox: -0.38, h: 0.40, w: 0.3 },
    { ox: 0.38, h: 0.38, w: 0.3 },
    { ox: -0.20, h: 0.30, w: 0.25 },
    { ox: 0.20, h: 0.28, w: 0.25 },
  ]

  spireData.forEach(sp => {
    const sx = cx + sp.ox * castleW
    const sh = castleH * sp.h
    const sw = castleW * sp.w * 0.08
    drawSpire(ctx, sx, baseY - castleH * 0.68, sh * 0.9, sw, 0.7)
  })

  // Battlements along top of main wall
  for (let i = -8; i <= 8; i++) {
    const bx = cx + i * castleW * 0.048
    const by = baseY - castleH * 0.68
    ctx.fillStyle = 'rgba(30,15,80,0.15)'
    ctx.fillRect(bx - 3, by - 10, 6, 10)
  }

  // Windows — tiny glowing points
  const windowData = [
    { ox: -0.08, oy: 0.45 }, { ox: 0.08, oy: 0.45 },
    { ox: -0.16, oy: 0.52 }, { ox: 0, oy: 0.52 }, { ox: 0.16, oy: 0.52 },
    { ox: -0.24, oy: 0.58 }, { ox: 0.24, oy: 0.58 },
  ]
  windowData.forEach(wd => {
    const wx = cx + wd.ox * castleW
    const wy = baseY - castleH * (1 - wd.oy)
    const wGlow = ctx.createRadialGradient(wx, wy, 0, wx, wy, 6)
    const wFlicker = 0.5 + 0.5 * Math.sin(t * 0.002 + wx * 0.1 + wy * 0.05)
    wGlow.addColorStop(0, `rgba(200,180,255,${0.3 * wFlicker})`)
    wGlow.addColorStop(1, 'rgba(100,80,200,0.0)')
    ctx.beginPath()
    ctx.arc(wx, wy, 6, 0, Math.PI * 2)
    ctx.fillStyle = wGlow
    ctx.fill()
    ctx.beginPath()
    ctx.arc(wx, wy, 1, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(230,220,255,${0.5 * wFlicker})`
    ctx.fill()
  })

  // Ground mist
  const mist = ctx.createLinearGradient(cx - castleW, baseY - 20, cx + castleW, baseY + 40)
  mist.addColorStop(0, 'rgba(60,30,120,0.0)')
  mist.addColorStop(0.3, 'rgba(40,20,90,0.06)')
  mist.addColorStop(0.7, 'rgba(40,20,90,0.06)')
  mist.addColorStop(1, 'rgba(60,30,120,0.0)')
  ctx.fillStyle = mist
  ctx.fillRect(cx - castleW, baseY - 20, castleW * 2, 60)

  ctx.restore()
}

// ─── Lightning ───────────────────────────────────────────────────────────────
// A violet flash sweeps the void at irregular intervals — the castle (and the
// path leading to it) is only ever glimpsed in the light it throws.

/** Double-flicker falloff curve: a sharp burst, a dip, a softer second burst. */
function flashIntensity(elapsed: number, duration: number): number {
  if (elapsed < 0 || elapsed > duration) return 0
  const a = Math.exp(-elapsed / 55)
  const b = 0.55 * Math.exp(-Math.abs(elapsed - duration * 0.45) / 45)
  return Math.min(Math.max(a, b), 1)
}

/** A jagged bolt falling from the top of the screen toward a target point. */
function generateBolt(w: number, targetX: number, targetY: number): { x: number; y: number }[] {
  const startX = targetX + (Math.random() - 0.5) * w * 0.3
  const pts: { x: number; y: number }[] = [{ x: startX, y: 0 }]
  const segs = 7
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    pts.push({
      x: startX + (targetX - startX) * t + (Math.random() - 0.5) * w * 0.05,
      y: targetY * t,
    })
  }
  return pts
}

function drawBolt(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], intensity: number) {
  if (intensity < 0.02) return
  ctx.save()
  ctx.strokeStyle = `rgba(210,190,255,${intensity * 0.85})`
  ctx.lineWidth = 1.5
  ctx.shadowColor = 'rgba(180,140,255,0.9)'
  ctx.shadowBlur = 24
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
  ctx.restore()
}

/** Full-screen violet wash that brightens with the flash. */
function drawFlashWash(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  if (intensity < 0.01) return
  ctx.save()
  ctx.fillStyle = `rgba(150,120,255,${intensity * 0.16})`
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

// ─── Path to the castle ─────────────────────────────────────────────────────────
// A road of light receding in perspective — wide near Medhā, narrowing into the
// distance toward the castle gate. Only catches the eye when lightning lifts it
// out of the dark.
function drawPathToCastle(
  ctx: CanvasRenderingContext2D,
  fromX: number, fromY: number,
  toX: number, toY: number,
  nearWidth: number, farWidth: number,
  opacity: number
) {
  if (opacity < 0.005) return
  const dx = toX - fromX
  const dy = toY - fromY
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(fromX + nx * nearWidth, fromY + ny * nearWidth)
  ctx.lineTo(toX + nx * farWidth, toY + ny * farWidth)
  ctx.lineTo(toX - nx * farWidth, toY - ny * farWidth)
  ctx.lineTo(fromX - nx * nearWidth, fromY - ny * nearWidth)
  ctx.closePath()
  const g = ctx.createLinearGradient(fromX, fromY, toX, toY)
  g.addColorStop(0, `rgba(190,160,255,${opacity})`)
  g.addColorStop(1, 'rgba(120,90,220,0)')
  ctx.fillStyle = g
  ctx.fill()

  // Faint guiding lights along the path's edges
  for (let i = 1; i < 6; i++) {
    const t = i / 6
    const px = fromX + dx * t
    const py = fromY + dy * t
    const width = nearWidth + (farWidth - nearWidth) * t
    ;[-1, 1].forEach(side => {
      const lx = px + nx * width * side
      const ly = py + ny * width * side
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 5)
      glow.addColorStop(0, `rgba(220,200,255,${opacity * 0.9})`)
      glow.addColorStop(1, 'rgba(160,120,255,0)')
      ctx.beginPath()
      ctx.arc(lx, ly, 5, 0, Math.PI * 2)
      ctx.fillStyle = glow
      ctx.fill()
    })
  }
  ctx.restore()
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MedhaLairProps {
  entityX?: number    // 0–1
  entityY?: number    // 0–1
  facultyColor?: string
  onReact?: boolean   // trigger pixie reaction
}

export function MedhaLair({
  entityX = 0.5,
  entityY = 0.44,
  facultyColor = '#7b2fff',
  onReact = false,
}: MedhaLairProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pixiesRef = useRef<Pixie[]>([])
  const fragmentsRef = useRef<ArchFragment[]>([])
  const lightningRef = useRef<LightningState | null>(null)
  const tRef = useRef(0)
  const reactRef = useRef(false)

  // Pick a new resting place for the castle — different distance, depth and
  // position each time the lightning rolls through.
  const rollCastlePlacement = useCallback((w: number, h: number): { near: CastlePlacement; far: CastlePlacement } => {
    return {
      near: {
        cx: w * (0.25 + Math.random() * 0.5),
        baseY: h * (0.78 + Math.random() * 0.08),
        scale: 0.75 + Math.random() * 0.55,
      },
      far: {
        cx: w * (0.15 + Math.random() * 0.7),
        baseY: h * (0.62 + Math.random() * 0.08),
        scale: 0.35 + Math.random() * 0.3,
      },
    }
  }, [])

  const buildLightning = useCallback((w: number, h: number): LightningState => {
    const { near, far } = rollCastlePlacement(w, h)
    return {
      nextFlash: performance.now() + 2500 + Math.random() * 4000,
      flashStart: -Infinity,
      flashDuration: 260 + Math.random() * 220,
      bolt: [],
      near,
      far,
    }
  }, [rollCastlePlacement])

  // Build pixies
  const buildPixies = useCallback((w: number, h: number): Pixie[] => {
    const count = 10
    return Array.from({ length: count }, (_, i) => {
      const depth = 0.2 + Math.random() * 0.7
      const angle = (i / count) * Math.PI * 2
      const orbitR = 80 + Math.random() * 180
      return {
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.15 + Math.random() * 0.65),
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.003 + Math.random() * 0.004,
        orbitR,
        orbitAngle: angle,
        orbitSpeed: (0.0003 + Math.random() * 0.0004) * (Math.random() < 0.5 ? 1 : -1),
        depth,
        size: 1.5 + depth * 2.5,
        opacity: 0.3 + depth * 0.5,
        wingPhase: Math.random() * Math.PI * 2,
        reacting: false,
        reactTimer: 0,
      }
    })
  }, [])

  // Build arch fragments
  const buildFragments = useCallback((w: number, h: number): ArchFragment[] => {
    const types: ArchFragment['type'][] = ['arch', 'spire', 'column', 'shard']
    return Array.from({ length: 14 }, (_, i) => ({
      x: w * (0.05 + Math.random() * 0.9),
      y: h * (0.1 + Math.random() * 0.75),
      w: 20 + Math.random() * 60,
      h: 30 + Math.random() * 80,
      type: types[Math.floor(Math.random() * types.length)],
      rotation: (Math.random() - 0.5) * 0.3,
      rotSpeed: (Math.random() - 0.5) * 0.0001,
      depth: 0.05 + Math.random() * 0.35,
      opacity: 0.03 + Math.random() * 0.08,
      driftX: (Math.random() - 0.5) * 0.02,
      driftY: (Math.random() - 0.5) * 0.01,
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      pixiesRef.current = buildPixies(canvas.width, canvas.height)
      fragmentsRef.current = buildFragments(canvas.width, canvas.height)
      lightningRef.current = buildLightning(canvas.width, canvas.height)
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const t = tRef.current++

      ctx.clearRect(0, 0, w, h)

      // ── Layer 1: Lightning-lit castle, glimpsed at varying depths ──────────
      const now = performance.now()
      const lit = lightningRef.current
      let flash = 0
      if (lit) {
        if (now >= lit.nextFlash) {
          lit.flashStart = now
          lit.flashDuration = 260 + Math.random() * 220
          const placement = rollCastlePlacement(w, h)
          lit.near = placement.near
          lit.far = placement.far
          lit.bolt = generateBolt(w, lit.near.cx, lit.near.baseY * 0.3)
          lit.nextFlash = now + 5000 + Math.random() * 9000
        }
        flash = flashIntensity(now - lit.flashStart, lit.flashDuration)

        // Far castle — distant, hazy, only a ghost of itself even at peak flash
        drawCastleSilhouette(ctx, w, h, lit.far.cx, lit.far.baseY, lit.far.scale, 0.02 + flash * 0.5, t)

        // The path winding from behind Medhā toward the castle gate
        const ex = w * entityX
        const ey = h * entityY
        drawPathToCastle(ctx, ex, ey + h * 0.05, lit.near.cx, lit.near.baseY, w * 0.05, w * 0.004, 0.02 + flash * 0.4)

        // Near castle — the one Medhā calls home, fully revealed when lit
        drawCastleSilhouette(ctx, w, h, lit.near.cx, lit.near.baseY, lit.near.scale, 0.03 + flash * 0.85, t)

        // The flash itself — violet wash and bolt
        drawFlashWash(ctx, w, h, flash)
        drawBolt(ctx, lit.bolt, flash)
      }

      // ── Layer 2: Arch fragments (mid-deep) ────────────────────────────────
      fragmentsRef.current.forEach(frag => {
        frag.x += frag.driftX
        frag.y += frag.driftY
        frag.rotation += frag.rotSpeed
        // Wrap
        if (frag.x < -80) frag.x = w + 80
        if (frag.x > w + 80) frag.x = -80
        if (frag.y < -80) frag.y = h + 80
        if (frag.y > h + 80) frag.y = -80

        ctx.save()
        ctx.translate(frag.x, frag.y)
        ctx.rotate(frag.rotation)
        const depthScale = 0.3 + frag.depth * 0.7
        ctx.scale(depthScale, depthScale)

        if (frag.type === 'arch') {
          drawArch(ctx, 0, 0, frag.w, frag.h, frag.opacity)
        } else if (frag.type === 'spire') {
          drawSpire(ctx, 0, 0, frag.h, frag.w * 0.25, frag.opacity)
        } else if (frag.type === 'column') {
          const cg = ctx.createLinearGradient(0, -frag.h / 2, 0, frag.h / 2)
          cg.addColorStop(0, `rgba(120,90,220,0)`)
          cg.addColorStop(0.3, `rgba(100,70,200,${frag.opacity * 3})`)
          cg.addColorStop(0.7, `rgba(80,50,180,${frag.opacity * 3})`)
          cg.addColorStop(1, `rgba(60,40,160,0)`)
          ctx.fillStyle = cg
          ctx.fillRect(-frag.w * 0.08, -frag.h / 2, frag.w * 0.16, frag.h)
        } else {
          // Shard
          ctx.beginPath()
          ctx.moveTo(0, -frag.h / 2)
          ctx.lineTo(frag.w * 0.15, frag.h * 0.2)
          ctx.lineTo(-frag.w * 0.1, frag.h / 2)
          ctx.lineTo(-frag.w * 0.2, frag.h * 0.1)
          ctx.closePath()
          ctx.fillStyle = `rgba(100,70,200,${frag.opacity * 2})`
          ctx.fill()
          ctx.strokeStyle = `rgba(160,130,255,${frag.opacity * 3})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
        ctx.restore()
      })

      // ── Layer 3: Throne (mid distance, behind entity) ─────────────────────
      const throneX = w * entityX
      const throneY = h * entityY + h * 0.08  // slightly below and behind entity
      const throneScale = 0.28
      const throneOpacity = 0.18 + 0.04 * Math.sin(t * 0.008)
      drawThrone(ctx, throneX, throneY, throneScale, throneOpacity, t)

      // ── Layer 4: Pixies ───────────────────────────────────────────────────
      const ex = w * entityX
      const ey = h * entityY

      pixiesRef.current.forEach((p, i) => {
        // Orbit motion — each pixie has its own orbit center offset from entity
        p.orbitAngle += p.orbitSpeed
        const orbitCenterX = ex + Math.cos(i * 1.3) * 60
        const orbitCenterY = ey + Math.sin(i * 1.1) * 40

        const targetX = orbitCenterX + Math.cos(p.orbitAngle) * p.orbitR
        const targetY = orbitCenterY + Math.sin(p.orbitAngle) * p.orbitR * 0.5

        // React — flutter toward entity
        if (p.reacting) {
          p.reactTimer--
          const toEx = ex - p.x
          const toEy = ey - p.y
          const dist = Math.sqrt(toEx ** 2 + toEy ** 2)
          if (dist > 40) {
            p.x += (toEx / dist) * 2.5
            p.y += (toEy / dist) * 2.5
          }
          if (p.reactTimer <= 0) p.reacting = false
        } else {
          // Drift toward orbit position
          p.x += (targetX - p.x) * 0.008
          p.y += (targetY - p.y) * 0.008
          // Small organic drift
          p.x += Math.sin(t * p.phaseSpeed + p.phase) * 0.3
          p.y += Math.cos(t * p.phaseSpeed * 0.7 + p.phase) * 0.2
        }

        drawPixie(ctx, p, t)
      })

      // ── Layer 5: Aurora atmosphere behind throne ──────────────────────────
      const auroraOpacity = 0.025 + 0.01 * Math.sin(t * 0.004)
      const aurora = ctx.createRadialGradient(throneX, throneY - 40, 0, throneX, throneY - 40, w * 0.22)
      aurora.addColorStop(0, `rgba(80,40,180,${auroraOpacity * 2})`)
      aurora.addColorStop(0.3, `rgba(60,30,150,${auroraOpacity})`)
      aurora.addColorStop(0.7, `rgba(40,20,120,${auroraOpacity * 0.4})`)
      aurora.addColorStop(1, 'rgba(20,10,80,0.0)')
      ctx.beginPath()
      ctx.arc(throneX, throneY - 40, w * 0.22, 0, Math.PI * 2)
      ctx.fillStyle = aurora
      ctx.fill()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [entityX, entityY, buildPixies, buildFragments, buildLightning, rollCastlePlacement])

  // Pixie reaction trigger
  useEffect(() => {
    if (!onReact) return
    const pixies = pixiesRef.current
    // 3–4 random pixies react
    const count = 3 + Math.floor(Math.random() * 2)
    const shuffled = [...pixies].sort(() => Math.random() - 0.5).slice(0, count)
    shuffled.forEach(p => {
      p.reacting = true
      p.reactTimer = 80 + Math.floor(Math.random() * 40)
    })
  }, [onReact])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,           // behind entity (z:10), above void canvas (z:0)
        pointerEvents: 'none',
      }}
    />
  )
}
