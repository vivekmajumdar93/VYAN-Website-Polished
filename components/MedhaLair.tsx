'use client'

// medha-lair.mp4 (gazebo) is retained in /public/assets but not rendered.
// medha-entity.mp4 is the sole video — RAF reverse-looped for seamless slow motion.
// On Android/mobile hardware decoders can't keep up with rapid currentTime seeks,
// so we detect mobile and fall back to autoPlay + loop at native speed instead.

import { useEffect, useRef } from 'react'

const SPEED             = 0.35   // video-seconds advanced per real-second (< 1 = slow-mo)
const TRANSITION_BUFFER = 0.10   // flip direction this many video-seconds before end/start

// Android hardware decoders (MediaCodec) have ~80-200ms seek latency, making
// RAF-driven currentTime scrubbing produce a frozen/static frame on mobile.
function isMobileHardwareDecoder(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod/i.test(ua)
}

// ─── Sky lightning ─────────────────────────────────────────────────────────────
// Realistic sky bolts: recursive midpoint-displacement, random angle/size/intensity,
// branching, burst clusters, atmospheric screen-flash on strong strikes.
// Three gradient families: gold→violet, violet→silver, silver→gold (and reverses).
function SkyLightning() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    // Gradient palettes — [start, mid?, end]
    const PALETTES: string[][] = [
      ['#ffd700', '#9b2fff', '#1a0038'],   // gold → deep violet
      ['#1a0038', '#7b4fff', '#b8ccff'],   // deep violet → cosmic silver
      ['#b8ccff', '#9b7fff', '#ffd700'],   // cosmic silver → gold
      ['#ffd700', '#b8ccff'],              // gold → silver (short)
      ['#1a0038', '#ffd700'],              // violet → gold (short)
      ['#ffd700', '#c084fc', '#0a001a'],   // gold → purple → near-black
      ['#e0e8ff', '#7c3aed', '#ffd700'],   // silver → purple → gold
    ]

    type Pt = [number, number]
    interface Bolt {
      main: Pt[]
      branches: Pt[][]
      life: number
      maxLife: number
      width: number
      intensity: number   // 0–1, affects glow & flash
      palette: string[]
    }

    // Recursive midpoint displacement — creates jagged lightning path
    function subdivide(pts: Pt[], disp: number, depth: number): Pt[] {
      if (depth === 0 || pts.length < 2) return pts
      const out: Pt[] = []
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i]; const [x2, y2] = pts[i + 1]
        const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2
        const dx = x2 - x1; const dy = y2 - y1
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        // Perpendicular offset
        const nx = -dy / len; const ny = dx / len
        const off = (Math.random() - 0.5) * 2 * disp
        out.push(pts[i], [mx + nx * off, my + ny * off] as Pt)
      }
      out.push(pts[pts.length - 1])
      return subdivide(out, disp * 0.55, depth - 1)
    }

    function spawnBolt(): Bolt {
      const w = canvas.width; const h = canvas.height
      let x1: number, y1: number, x2: number, y2: number

      const type = Math.random()
      if (type < 0.52) {
        // Cloud-to-ground: most common, most dramatic
        x1 = w * (0.05 + Math.random() * 0.90)
        y1 = h * (-0.06 + Math.random() * 0.22)
        x2 = x1 + (Math.random() - 0.5) * w * 0.28
        y2 = h * (0.82 + Math.random() * 0.32)
      } else if (type < 0.70) {
        // Angled from sky edge
        const left = Math.random() < 0.5
        x1 = left ? w * Math.random() * 0.25 : w * (0.75 + Math.random() * 0.25)
        y1 = h * Math.random() * 0.20
        x2 = left ? w * (0.25 + Math.random() * 0.75) : w * Math.random() * 0.75
        y2 = h * (0.65 + Math.random() * 0.40)
      } else if (type < 0.85) {
        // Full diagonal — passes across the whole screen
        const fromTop = Math.random() < 0.5
        if (fromTop) {
          x1 = w * Math.random(); y1 = 0
          x2 = w * Math.random(); y2 = h
        } else {
          x1 = Math.random() < 0.5 ? 0 : w; y1 = h * Math.random() * 0.5
          x2 = Math.random() < 0.5 ? 0 : w; y2 = h * (0.4 + Math.random() * 0.6)
        }
      } else {
        // Short mid-sky flash
        const cx = w * (0.15 + Math.random() * 0.70)
        const cy = h * (0.04 + Math.random() * 0.35)
        const angle = Math.random() * Math.PI
        const length = w * (0.08 + Math.random() * 0.22)
        x1 = cx - Math.cos(angle) * length / 2; y1 = cy - Math.sin(angle) * length / 2
        x2 = cx + Math.cos(angle) * length / 2; y2 = cy + Math.sin(angle) * length / 2
      }

      const segLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      const disp = segLen * (0.25 + Math.random() * 0.28)
      const depth = 5 + Math.floor(Math.random() * 2)  // 5–6 subdivisions
      const main = subdivide([[x1, y1], [x2, y2]], disp, depth)

      // 1–5 branches spawning from random intermediate points
      const branches: Pt[][] = []
      const branchCount = 1 + Math.floor(Math.random() * 4)
      const mainAngle = Math.atan2(y2 - y1, x2 - x1)
      for (let b = 0; b < branchCount; b++) {
        const idx = Math.floor(main.length * (0.10 + Math.random() * 0.60))
        const [bx1, by1] = main[idx]
        const spread = 0.7 + Math.random() * 1.6   // deviation from main direction
        const brAngle = mainAngle + (Math.random() - 0.5) * spread * 2
        const brLen = segLen * (0.12 + Math.random() * 0.32)
        const bx2 = bx1 + Math.cos(brAngle) * brLen
        const by2 = by1 + Math.sin(brAngle) * brLen
        if (brLen > 24) {
          branches.push(subdivide([[bx1, by1], [bx2, by2]], disp * 0.22, depth - 2))
        }
      }

      const intensity = 0.3 + Math.random() * 0.7
      return {
        main, branches,
        life: 0,
        maxLife: 5 + Math.floor(Math.random() * 12),
        width: 0.3 + Math.random() * 2.2,
        intensity,
        palette: PALETTES[Math.floor(Math.random() * PALETTES.length)],
      }
    }

    function drawPolyline(pts: Pt[]) {
      if (pts.length < 2) return
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
      ctx.stroke()
    }

    let bolt: Bolt | null = null
    let countdown = 40 + Math.floor(Math.random() * 80)   // initial wait
    let burstRemaining = 0

    const draw = () => {
      const w = canvas.width; const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'

      // Spawn when ready
      if (!bolt && countdown <= 0) {
        bolt = spawnBolt()
        // Timing for next bolt
        if (burstRemaining > 0) {
          burstRemaining--
          countdown = 4 + Math.floor(Math.random() * 18)   // burst: very short gap
        } else {
          const r = Math.random()
          if (r < 0.18) {
            // Start a burst cluster (2–4 bolts in quick succession)
            burstRemaining = 1 + Math.floor(Math.random() * 3)
            countdown = 8 + Math.floor(Math.random() * 22)
          } else if (r < 0.45) {
            countdown = 25 + Math.floor(Math.random() * 55)   // short pause
          } else {
            countdown = 60 + Math.floor(Math.random() * 200)  // long wait
          }
        }
      }
      if (countdown > 0) countdown--

      if (bolt) {
        bolt.life++
        const t = bolt.life / bolt.maxLife
        // Fast flash in (25% of maxLife), slow fade out
        const alpha = t < 0.25
          ? (t / 0.25)
          : 1 - Math.pow((t - 0.25) / 0.75, 1.3)

        const pal = bolt.palette
        const [p0, pN] = [bolt.main[0], bolt.main[bolt.main.length - 1]]

        // Gradient along the bolt axis
        const grad = ctx.createLinearGradient(p0[0], p0[1], pN[0], pN[1])
        if (pal.length >= 3) {
          grad.addColorStop(0,   pal[0])
          grad.addColorStop(0.5, pal[1])
          grad.addColorStop(1,   pal[2])
        } else {
          grad.addColorStop(0, pal[0])
          grad.addColorStop(1, pal[1])
        }
        const glowColor = pal[0]

        // 1. Atmospheric screen flash on spawn (strong bolts only)
        if (bolt.life === 1 && bolt.intensity > 0.55) {
          ctx.save()
          const flashAlpha = bolt.intensity * 0.07
          ctx.fillStyle = `rgba(255, 240, 200, ${flashAlpha})`
          ctx.fillRect(0, 0, w, h)
          ctx.restore()
        }

        // 2. Wide diffuse glow halo
        ctx.save()
        ctx.globalAlpha = alpha * bolt.intensity * 0.09
        ctx.lineWidth = bolt.width * 12
        ctx.strokeStyle = glowColor
        ctx.shadowColor = glowColor; ctx.shadowBlur = 30
        drawPolyline(bolt.main)
        ctx.restore()

        // 3. Inner glow
        ctx.save()
        ctx.globalAlpha = alpha * bolt.intensity * 0.25
        ctx.lineWidth = bolt.width * 4
        ctx.strokeStyle = grad
        ctx.shadowColor = glowColor; ctx.shadowBlur = 12
        drawPolyline(bolt.main)
        ctx.restore()

        // 4. Core bolt (brightest)
        ctx.save()
        ctx.globalAlpha = alpha * 0.95
        ctx.lineWidth = bolt.width
        ctx.strokeStyle = grad
        ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 3
        drawPolyline(bolt.main)
        ctx.restore()

        // 5. Branches — thinner, dimmer, fade toward tip
        for (const branch of bolt.branches) {
          if (branch.length < 2) continue
          const [b0, bN] = [branch[0], branch[branch.length - 1]]
          const bGrad = ctx.createLinearGradient(b0[0], b0[1], bN[0], bN[1])
          bGrad.addColorStop(0, pal[pal.length > 2 ? 1 : 0])
          bGrad.addColorStop(0.7, pal[pal.length - 1])
          bGrad.addColorStop(1, 'rgba(0,0,0,0)')

          // Thin inner glow
          ctx.save()
          ctx.globalAlpha = alpha * 0.18
          ctx.lineWidth = bolt.width * 2
          ctx.strokeStyle = glowColor
          ctx.shadowColor = glowColor; ctx.shadowBlur = 8
          drawPolyline(branch)
          ctx.restore()

          // Branch core
          ctx.save()
          ctx.globalAlpha = alpha * 0.72
          ctx.lineWidth = bolt.width * 0.55
          ctx.strokeStyle = bGrad
          drawPolyline(branch)
          ctx.restore()
        }

        if (bolt.life >= bolt.maxLife) bolt = null
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
    v.muted      = true
    v.playsInline = true
    v.preload    = 'auto'

    // Fade in once the first frame is ready — regardless of device
    const showVideo = () => { v.style.opacity = '1' }
    v.addEventListener('canplay', showVideo, { once: true })
    // If already buffered (cached), reveal immediately
    if (v.readyState >= 3) showVideo()

    // Mobile path: autoPlay + loop — hardware decoder can't handle rapid seeks.
    // Call load() first so Chrome on Android actually starts fetching
    // (mobile browsers often ignore preload="auto" to save battery).
    if (isMobileHardwareDecoder()) {
      v.loop = true
      v.load()
      v.play().catch(() => {})
      return () => {
        v.removeEventListener('canplay', showVideo)
        v.pause()
      }
    }

    // Desktop path: RAF currentTime scrubbing for slow reverse-loop
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
      v.removeEventListener('canplay', showVideo)
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
          opacity: 0,
          transition: 'opacity 1.2s ease',
        }}
      />
      <SkyLightning />
    </>
  )
}
