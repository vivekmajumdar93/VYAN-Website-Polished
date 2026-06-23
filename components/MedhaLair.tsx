'use client'

// medha-lair.mp4 (gazebo) is retained in /public/assets but not rendered.
// medha-entity.mp4 is the sole video — RAF reverse-looped for seamless slow motion.

import { useEffect, useRef } from 'react'

const SPEED             = 0.35   // video-seconds advanced per real-second (< 1 = slow-mo)
const TRANSITION_BUFFER = 0.10   // flip direction this many video-seconds before end/start

// ─── Gateway lightning ────────────────────────────────────────────────────────
// One lightning event at a time — traces the ENTIRE visible gateway perimeter
// in a single gold→violet (or violet→gold) arc, then waits before the next.
function GatewayLightning() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    type Pt = { x: number; y: number }

    // Perpendicular-jittered lightning path
    function makePath(x1: number, y1: number, x2: number, y2: number, jag: number, steps = 10): Pt[] {
      const dx = (x2 - x1) / steps
      const dy = (y2 - y1) / steps
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = -dy / len; const ny = dx / len
      const pts: Pt[] = [{ x: x1, y: y1 }]
      for (let i = 1; i < steps; i++) {
        const j = (Math.random() - 0.5) * jag
        pts.push({ x: x1 + dx * i + nx * j, y: y1 + dy * i + ny * j })
      }
      pts.push({ x: x2, y: y2 })
      return pts
    }

    // One gateway lightning event — all visible edges, one pass
    interface Strike {
      // Each entry = one edge's jagged path
      paths: Pt[][]
      life: number; maxLife: number
      width: number; fromGold: boolean
    }

    let strike: Strike | null = null
    let cooldown = 0   // frames until next strike is allowed

    let frame = 0
    const draw = () => {
      frame++
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      const portrait = h > w * 0.75

      // Arch coordinates (screen %)
      const L  = w * 0.17; const R  = w * 0.83
      const IL = w * 0.31; const IR = w * 0.69
      const T  = portrait ? h * 0.10 : h * 0.20
      const B  = h * 0.86
      const IT = portrait ? h * 0.30 : h * 0.38

      // ── Persistent dim aura ─────────────────────────────────────────────────
      const aura = 0.022 + 0.012 * Math.sin(frame * 0.022)
      ctx.save()
      ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.shadowBlur = 10
      ctx.globalAlpha = aura
      const auraPaths: [number, number, number, number, string][] = [
        [L,  T,  L,  B,  '#d4a017'],
        [R,  T,  R,  B,  '#6b21a8'],
        [IL, IT, IL, B,  '#b45309'],
        [IR, IT, IR, B,  '#7c3aed'],
        ...(portrait ? [[L, T, R, T, '#c084fc'] as [number, number, number, number, string]] : []),
      ]
      for (const [ax1, ay1, ax2, ay2, ac] of auraPaths) {
        ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2)
        ctx.strokeStyle = ac; ctx.shadowColor = ac; ctx.stroke()
      }
      ctx.restore()

      // ── Spawn next strike after cooldown ────────────────────────────────────
      if (!strike && cooldown <= 0) {
        const jag = 7 + Math.random() * 10
        // Build all visible gateway edges as one compound strike
        const paths: Pt[][] = [
          makePath(L,  T,  L,  B,  jag),   // outer left pillar
          makePath(R,  T,  R,  B,  jag),   // outer right pillar
          makePath(IL, IT, IL, B,  jag),   // inner left
          makePath(IR, IT, IR, B,  jag),   // inner right
        ]
        if (portrait) paths.push(makePath(L, T, R, T, jag, 14))  // top lintel
        strike = {
          paths,
          life: 0,
          maxLife: 10 + Math.floor(Math.random() * 10),
          width: 0.8 + Math.random() * 1.6,
          fromGold: Math.random() < 0.5,
        }
      }
      if (cooldown > 0) cooldown--

      // ── Draw the active strike ───────────────────────────────────────────────
      if (strike) {
        strike.life++
        const alpha = Math.sin((strike.life / strike.maxLife) * Math.PI)
        const fromGold = strike.fromGold
        const glowColor = fromGold ? '#ffd700' : '#7c3aed'

        ctx.save()
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'

        for (const path of strike.paths) {
          const p0 = path[0]; const pN = path[path.length - 1]
          const grad = ctx.createLinearGradient(p0.x, p0.y, pN.x, pN.y)
          if (fromGold) {
            grad.addColorStop(0, '#ffd700'); grad.addColorStop(0.45, '#c084fc'); grad.addColorStop(1, '#3b0070')
          } else {
            grad.addColorStop(0, '#3b0070'); grad.addColorStop(0.55, '#c084fc'); grad.addColorStop(1, '#ffd700')
          }

          // Glow halo
          ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y)
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
          ctx.strokeStyle = glowColor; ctx.lineWidth = strike.width * 6
          ctx.globalAlpha = alpha * 0.20; ctx.shadowColor = glowColor; ctx.shadowBlur = 18
          ctx.stroke()

          // Core bolt
          ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y)
          for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y)
          ctx.strokeStyle = grad; ctx.lineWidth = strike.width
          ctx.globalAlpha = alpha * 0.95; ctx.shadowBlur = 5
          ctx.stroke()
        }
        ctx.restore()

        if (strike.life >= strike.maxLife) {
          strike = null
          cooldown = 30 + Math.floor(Math.random() * 60)  // 0.5–1.5s gap
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: 4, pointerEvents: 'none',
      }}
    />
  )
}

// ─── MedhaLair ────────────────────────────────────────────────────────────────
export function MedhaLair() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const dirRef   = useRef<1 | -1>(1)
  const rafRef   = useRef<number>(0)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted       = true
    v.playsInline  = true
    v.preload     = 'auto'

    const startScrub = () => {
      // Prime the decoder — required before manual currentTime scrubbing works
      v.play().catch(() => {}).finally(() => { v.pause(); v.currentTime = 0 })
      dirRef.current = 1

      const scrub = () => {
        if (!v.duration || isNaN(v.duration)) {
          rafRef.current = requestAnimationFrame(scrub)
          return
        }
        const dir  = dirRef.current
        const next = v.currentTime + dir * SPEED * (1 / 60)

        if (dir === 1 && next >= v.duration - TRANSITION_BUFFER) {
          dirRef.current = -1
          v.currentTime  = v.duration - TRANSITION_BUFFER
        } else if (dir === -1 && next <= TRANSITION_BUFFER) {
          dirRef.current = 1
          v.currentTime  = TRANSITION_BUFFER
        } else {
          v.currentTime = Math.max(0, Math.min(next, v.duration))
        }
        rafRef.current = requestAnimationFrame(scrub)
      }
      rafRef.current = requestAnimationFrame(scrub)
    }

    v.addEventListener('loadedmetadata', startScrub)
    if (v.readyState >= 1) startScrub()

    return () => {
      v.removeEventListener('loadedmetadata', startScrub)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <>
      <video
        ref={videoRef}
        src="/assets/medha-entity.mp4"
        muted
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />
      <GatewayLightning />
    </>
  )
}
