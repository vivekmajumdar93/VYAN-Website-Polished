// ─── Vortex renderer — pure canvas, no static images ─────────────────────────
// Procedurally generates the cosmic vortex matching the reference images:
// - White-silver energy filaments spiraling inward
// - Gold-amber particle scatter
// - Deep black void with luminous core
// - Purple-violet accent hints in deep layers
// - Stars scattered throughout

export interface VortexConfig {
  cx: number          // center X
  cy: number          // center Y
  rotation: number    // current rotation angle (radians)
  breathe: number     // 0–1 breathing pulse
  mouseX: number      // -1 to 1 normalized mouse X
  mouseY: number      // -1 to 1 normalized mouse Y
}

// ─── Draw star ────────────────────────────────────────────────────────────────

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  opacity: number, points = 4
) {
  if (opacity < 0.01) return
  const rot = Math.random() * Math.PI
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2
    const len = r * (3 + Math.random() * 2)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len)
    ctx.strokeStyle = `rgba(255,255,255,${opacity * 0.7})`
    ctx.lineWidth = 0.4
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,255,255,${opacity})`
  ctx.fill()
  ctx.restore()
}

// ─── Draw single vortex arm ───────────────────────────────────────────────────

function drawVortexArm(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  armAngle: number,        // base angle of this arm
  rotation: number,        // global rotation
  maxR: number,            // max radius
  color: string,
  opacity: number,
  strokeWidth: number,
  turns: number,           // how many spiral turns
  t: number                // time for shimmer
) {
  const segments = 120
  ctx.beginPath()

  for (let i = 0; i <= segments; i++) {
    const progress = i / segments
    // Spiral: starts at outer edge, coils inward
    const r = maxR * (1 - progress * 0.85)
    const angle = armAngle + rotation + progress * Math.PI * 2 * turns
    // Slight wave — creates the silk filament look
    const wave = Math.sin(progress * Math.PI * 8 + t * 0.02) * maxR * 0.015
    const waveR = r + wave

    const x = cx + Math.cos(angle) * waveR
    const y = cy + Math.sin(angle) * waveR * 0.65 // slightly elliptical

    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }

  // Fade from transparent at outer edge to bright at inner
  const grad = ctx.createLinearGradient(
    cx + Math.cos(armAngle) * maxR,
    cy + Math.sin(armAngle) * maxR * 0.65,
    cx, cy
  )
  grad.addColorStop(0, `${color}00`)
  grad.addColorStop(0.3, `${color}${Math.floor(opacity * 0.4 * 255).toString(16).padStart(2,'0')}`)
  grad.addColorStop(0.7, `${color}${Math.floor(opacity * 0.8 * 255).toString(16).padStart(2,'0')}`)
  grad.addColorStop(1, `${color}${Math.floor(opacity * 255).toString(16).padStart(2,'0')}`)

  ctx.strokeStyle = grad
  ctx.lineWidth = strokeWidth
  ctx.lineCap = 'round'
  ctx.stroke()
}

// ─── Main vortex draw ─────────────────────────────────────────────────────────

export function drawVortex(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  cfg: VortexConfig,
  t: number
) {
  const { cx, cy, rotation, breathe, mouseX, mouseY } = cfg

  // Parallax offset from mouse
  const offsetX = mouseX * w * 0.02
  const offsetY = mouseY * h * 0.015
  const vcx = cx + offsetX
  const vcy = cy + offsetY

  const maxR = Math.min(w, h) * 0.52

  // ── Layer 1: Deep background — faint purple-violet nebula ─────────────────
  const nebula = ctx.createRadialGradient(vcx, vcy, 0, vcx, vcy, maxR * 1.1)
  nebula.addColorStop(0, `rgba(255,255,255,${0.03 + breathe * 0.01})`)
  nebula.addColorStop(0.15, `rgba(200,190,255,0.04)`)
  nebula.addColorStop(0.40, `rgba(120,80,200,0.06)`)
  nebula.addColorStop(0.65, `rgba(60,40,120,0.04)`)
  nebula.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.beginPath()
  ctx.arc(vcx, vcy, maxR * 1.1, 0, Math.PI * 2)
  ctx.fillStyle = nebula
  ctx.fill()

  // ── Layer 2: Star field ────────────────────────────────────────────────────
  // Pre-seeded stars — deterministic positions
  for (let i = 0; i < 280; i++) {
    const sx = w * ((Math.sin(i * 2.39 + 0.1) + 1) / 2)
    const sy = h * ((Math.cos(i * 1.61 + 0.3) + 1) / 2)
    const sr = 0.3 + (i % 5) * 0.2
    const twinkle = 0.3 + 0.5 * Math.sin(t * 0.008 + i * 0.7)
    // Gold-amber stars scattered at edges
    const isGold = i % 7 === 0
    const starColor = isGold
      ? `rgba(255,200,80,${twinkle * 0.7})`
      : `rgba(255,255,255,${twinkle * 0.5})`
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fillStyle = starColor
    ctx.fill()
    // Occasional bright star with cross rays
    if (i % 22 === 0) {
      drawStar(ctx, sx, sy, sr * 1.5, twinkle * 0.6, 4)
    }
  }

  // ── Layer 3: Main vortex filaments ─────────────────────────────────────────
  // Multiple spiral arms at different phases — creates the dense silk look
  const armConfigs = [
    // Primary white-silver arms — thick, bright
    { angle: 0,              color: '#e8e8f8', opacity: 0.55, width: 1.4, turns: 2.8 },
    { angle: Math.PI * 0.4,  color: '#d8d8f0', opacity: 0.45, width: 1.1, turns: 2.5 },
    { angle: Math.PI * 0.8,  color: '#f0f0ff', opacity: 0.50, width: 1.3, turns: 3.0 },
    { angle: Math.PI * 1.2,  color: '#e0e0f8', opacity: 0.40, width: 0.9, turns: 2.6 },
    { angle: Math.PI * 1.6,  color: '#d0d0e8', opacity: 0.45, width: 1.2, turns: 2.8 },
    // Secondary finer filaments
    { angle: Math.PI * 0.2,  color: '#c8c8e8', opacity: 0.30, width: 0.6, turns: 3.2 },
    { angle: Math.PI * 0.6,  color: '#e8e8ff', opacity: 0.25, width: 0.5, turns: 3.5 },
    { angle: Math.PI * 1.0,  color: '#d8d8f8', opacity: 0.28, width: 0.7, turns: 2.9 },
    { angle: Math.PI * 1.4,  color: '#c0c0e0', opacity: 0.22, width: 0.5, turns: 3.1 },
    { angle: Math.PI * 1.8,  color: '#e0e0ff', opacity: 0.25, width: 0.6, turns: 3.3 },
    // Purple-violet accent arms — deep in the spiral
    { angle: Math.PI * 0.35, color: '#9080d0', opacity: 0.20, width: 0.8, turns: 3.8 },
    { angle: Math.PI * 1.35, color: '#8070c0', opacity: 0.18, width: 0.7, turns: 4.0 },
    // Gold-amber energy rivers
    { angle: Math.PI * 0.9,  color: '#d4a030', opacity: 0.25, width: 1.0, turns: 2.4 },
    { angle: Math.PI * 1.7,  color: '#c89020', opacity: 0.20, width: 0.8, turns: 2.6 },
  ]

  armConfigs.forEach(arm => {
    drawVortexArm(
      ctx, vcx, vcy,
      arm.angle, rotation, maxR,
      arm.color, arm.opacity, arm.width,
      arm.turns, t
    )
  })

  // ── Layer 4: Dense inner spiral ────────────────────────────────────────────
  // Tighter, brighter filaments near the core
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2
    drawVortexArm(
      ctx, vcx, vcy,
      angle, rotation * 1.4, maxR * 0.55,
      '#ffffff', 0.18, 0.5,
      4.5, t
    )
  }

  // ── Layer 5: Gold-amber particle scatter ──────────────────────────────────
  // Particles distributed along the spiral arms
  for (let i = 0; i < 180; i++) {
    const progress = (i / 180)
    const armAngle = (i * 2.39) % (Math.PI * 2)
    const r = maxR * (0.15 + progress * 0.82)
    const spiralAngle = armAngle + rotation + progress * Math.PI * 5
    const px = vcx + Math.cos(spiralAngle) * r
    const py = vcy + Math.sin(spiralAngle) * r * 0.65
    const twinkle = 0.4 + 0.5 * Math.sin(t * 0.01 + i * 0.9)
    const isGold = i % 3 === 0
    const isBright = i % 11 === 0

    if (isGold) {
      ctx.beginPath()
      ctx.arc(px, py, 0.8 + (i % 4) * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,185,60,${twinkle * 0.65})`
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(px, py, 0.4 + (i % 3) * 0.3, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.45})`
      ctx.fill()
    }

    if (isBright) {
      drawStar(ctx, px, py, 1.2, twinkle * 0.7, 4)
    }
  }

  // ── Layer 6: Luminous core ─────────────────────────────────────────────────
  const coreSize = maxR * (0.08 + breathe * 0.015)
  const core = ctx.createRadialGradient(vcx, vcy, 0, vcx, vcy, coreSize)
  core.addColorStop(0, `rgba(255,255,255,${0.95 + breathe * 0.05})`)
  core.addColorStop(0.15, `rgba(240,240,255,0.80)`)
  core.addColorStop(0.35, `rgba(200,200,240,0.50)`)
  core.addColorStop(0.60, `rgba(160,140,220,0.25)`)
  core.addColorStop(0.80, `rgba(100,80,180,0.10)`)
  core.addColorStop(1, 'rgba(60,40,140,0)')
  ctx.beginPath()
  ctx.arc(vcx, vcy, coreSize, 0, Math.PI * 2)
  ctx.fillStyle = core
  ctx.fill()

  // Core bright center
  ctx.beginPath()
  ctx.arc(vcx, vcy, coreSize * 0.12, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(255,255,255,1)`
  ctx.fill()

  // ── Layer 7: Edge vignette ─────────────────────────────────────────────────
  const vignette = ctx.createRadialGradient(vcx, vcy, maxR * 0.5, vcx, vcy, maxR * 1.2)
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(0.6, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.beginPath()
  ctx.rect(0, 0, w, h)
  ctx.fillStyle = vignette
  ctx.fill()
}
