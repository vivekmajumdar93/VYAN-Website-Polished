'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Layout constants ─────────────────────────────────────────────────────────
// Measured from video frames:
// Medhā in video occupies left 0–42% of frame, drifts to max 42%
// Gazebo/arch occupies right 50–100%
// Safe mask: covers 0–45% (our entity lives here), gradient 45–52%, clear 52–100%

const MASK_SOLID_END = 0.45      // left 45% fully covered
const MASK_GRADIENT_END = 0.52   // gradient fade ends at 52%

// Roam positions — constrained to LEFT side only (0–45% of screen)
// Entity must never cross into gazebo territory
const ROAM_POSITIONS = [
  { x: 22, y: 38 },   // upper left center
  { x: 18, y: 28 },   // upper left
  { x: 32, y: 35 },   // center left
  { x: 15, y: 48 },   // mid left
  { x: 28, y: 25 },   // high left
  { x: 38, y: 40 },   // rightmost safe position
  { x: 20, y: 55 },   // lower left
]

function nextRoam(cur: { x: number; y: number }) {
  const others = ROAM_POSITIONS.filter(p => p.x !== cur.x || p.y !== cur.y)
  return others[Math.floor(Math.random() * others.length)]
}

// ─── Pixie — small ambient creature ───────────────────────────────────────────
interface Pixie {
  x: number; y: number
  orbitCX: number; orbitCY: number
  orbitRX: number; orbitRY: number
  orbitAngle: number; orbitSpeed: number
  size: number; depth: number
  wingPhase: number; glowPhase: number
  reacting: boolean; reactTimer: number
}

function buildPixies(w: number, h: number): Pixie[] {
  // Pixies constrained to left 50% of screen
  return Array.from({ length: 8 }, (_, i) => ({
    x: w * (0.05 + Math.random() * 0.40),
    y: h * (0.10 + Math.random() * 0.70),
    orbitCX: w * (0.08 + Math.random() * 0.36),
    orbitCY: h * (0.15 + Math.random() * 0.60),
    orbitRX: 20 + Math.random() * 60,
    orbitRY: 10 + Math.random() * 30,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitSpeed: (0.002 + Math.random() * 0.003) * (Math.random() < 0.5 ? 1 : -1),
    size: 1.0 + Math.random() * 1.5,
    depth: 0.3 + Math.random() * 0.7,
    wingPhase: Math.random() * Math.PI * 2,
    glowPhase: Math.random() * Math.PI * 2,
    reacting: false,
    reactTimer: 0,
  }))
}

// ─── Entity size — device responsive ─────────────────────────────────────────
function getEntitySize(): string {
  // Uses vmin so it scales with the smaller dimension
  // Mobile portrait: smaller, tablet: medium, desktop: larger
  if (typeof window === 'undefined') return '52vmin'
  const w = window.innerWidth
  if (w < 480) return '68vmin'        // mobile portrait — larger relative
  if (w < 768) return '58vmin'        // mobile landscape / small tablet
  if (w < 1024) return '52vmin'       // tablet
  if (w < 1440) return '46vmin'       // desktop
  return '42vmin'                     // large desktop
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface MedhaLairProps {
  entityVideoSrc?: string
  lairVideoSrc?: string
  entityState?: string
  facultyColor?: string
  onReact?: boolean
  roamPos?: { x: number; y: number }
  entityVisible?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MedhaLair({
  entityVideoSrc = '/assets/medha-dormant.mp4',
  lairVideoSrc = '/assets/medha-lair.mp4',
  entityState = 'dormant',
  facultyColor = '#7b2fff',
  onReact = false,
  roamPos,
  entityVisible = true,
}: MedhaLairProps) {
  const lairVideoRef = useRef<HTMLVideoElement>(null)
  const entityVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pixiesRef = useRef<Pixie[]>([])
  const tRef = useRef(0)
  const lairDirRef = useRef<1 | -1>(1)
  const lairScrubRef = useRef<number>(0)
  const [entitySize, setEntitySize] = useState('52vmin')
  const [mounted, setMounted] = useState(false)

  // Internal roam state if not controlled externally
  const [internalRoam, setInternalRoam] = useState(ROAM_POSITIONS[0])
  const [internalVisible, setInternalVisible] = useState(true)
  const roamTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeRoam = roamPos ?? internalRoam
  const activeVisible = entityVisible && internalVisible

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true)
    setEntitySize(getEntitySize())

    const onResize = () => setEntitySize(getEntitySize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Reverse loop system for lair video ─────────────────────────────────────
  // Plays forward at slow speed, then reverses back — seamless boomerang
  // No visible loop cut. The gazebo breathes forward and back continuously.
  const lairDirectionRef = useRef<1 | -1>(1)   // 1 = forward, -1 = reverse
  const lairRafRef = useRef<number>(0)
  const LAIR_SPEED = 0.18   // very slow — frames per animation frame (lower = slower)
  const TRANSITION_BUFFER = 0.08  // seconds before end/start to begin reversing

  useEffect(() => {
    const v = lairVideoRef.current
    if (!v) return
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'

    const startScrub = () => {
      // Don't use native play — we manually scrub currentTime
      v.pause()
      v.currentTime = 0
      lairDirRef.current = 1

      const scrub = () => {
        if (!v.duration || isNaN(v.duration)) {
          lairScrubRef.current = requestAnimationFrame(scrub)
          return
        }

        const dir = lairDirRef.current
        const next = v.currentTime + dir * LAIR_SPEED * (1/60)

        if (dir === 1 && next >= v.duration - TRANSITION_BUFFER) {
          // Approaching end — start reversing
          lairDirRef.current = -1
          v.currentTime = v.duration - TRANSITION_BUFFER
        } else if (dir === -1 && next <= TRANSITION_BUFFER) {
          // Approaching start — start going forward
          lairDirRef.current = 1
          v.currentTime = TRANSITION_BUFFER
        } else {
          v.currentTime = Math.max(0, Math.min(next, v.duration))
        }

        lairScrubRef.current = requestAnimationFrame(scrub)
      }

      lairScrubRef.current = requestAnimationFrame(scrub)
    }

    v.addEventListener('loadedmetadata', startScrub)
    if (v.readyState >= 1) startScrub()

    return () => {
      v.removeEventListener('loadedmetadata', startScrub)
      cancelAnimationFrame(lairScrubRef.current)
    }
  }, [lairVideoSrc])

  // ── Play entity video on loop ───────────────────────────────────────────────
  useEffect(() => {
    const v = entityVideoRef.current
    if (!v) return
    v.loop = true
    v.muted = true
    v.playsInline = true
    const play = () => v.play().catch(() => {})
    v.addEventListener('canplay', play)
    if (v.readyState >= 3) play()
    return () => v.removeEventListener('canplay', play)
  }, [entityVideoSrc])

  // ── Internal roam schedule (if not externally controlled) ──────────────────
  useEffect(() => {
    if (roamPos) return // externally controlled
    const schedule = () => {
      roamTimer.current = setTimeout(() => {
        setInternalVisible(false)
        setTimeout(() => {
          setInternalRoam(prev => nextRoam(prev))
          setTimeout(() => setInternalVisible(true), 600)
        }, 800)
        schedule()
      }, 30000 + Math.random() * 20000)
    }
    schedule()
    return () => { if (roamTimer.current) clearTimeout(roamTimer.current) }
  }, [roamPos])

  // ── Canvas — pixies + dust + aurora ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      pixiesRef.current = buildPixies(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const t = ++tRef.current

      ctx.clearRect(0, 0, w, h)

      // Entity position in pixels
      const ex = w * activeRoam.x / 100
      const ey = h * activeRoam.y / 100

      // ── Aurora behind entity (left side only) ──────────────────────────
      const ap = 0.018 + 0.008 * Math.sin(t * 0.004)
      const aurora = ctx.createRadialGradient(ex, ey + 30, 0, ex, ey + 30, w * 0.14)
      aurora.addColorStop(0, `rgba(80,40,160,${ap * 2})`)
      aurora.addColorStop(0.5, `rgba(50,20,120,${ap})`)
      aurora.addColorStop(1, 'rgba(20,10,60,0)')
      ctx.beginPath()
      ctx.arc(ex, ey + 30, w * 0.14, 0, Math.PI * 2)
      ctx.fillStyle = aurora
      ctx.fill()

      // ── Pixies ──────────────────────────────────────────────────────────
      pixiesRef.current.forEach(p => {
        p.orbitAngle += p.orbitSpeed
        const tx = p.orbitCX + Math.cos(p.orbitAngle) * p.orbitRX
        const ty = p.orbitCY + Math.sin(p.orbitAngle) * p.orbitRY

        if (p.reacting) {
          p.reactTimer--
          const dx = ex - p.x, dy = ey - p.y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d > 40) { p.x += dx/d*2.2; p.y += dy/d*2.2 }
          if (p.reactTimer <= 0) p.reacting = false
        } else {
          p.x += (tx - p.x) * 0.007
          p.y += (ty - p.y) * 0.007
          // Keep pixies on left side
          if (p.x > w * 0.50) p.x = w * 0.50
        }

        const glow = 0.30 + 0.28 * Math.sin(t * 0.012 + p.glowPhase)
        const wingSpan = p.size * (1.2 + 0.5 * Math.sin(t * 0.018 + p.wingPhase))
        const op = p.depth * glow

        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5)
        halo.addColorStop(0, `rgba(212,180,100,${op * 1.4})`)
        halo.addColorStop(0.4, `rgba(160,120,60,${op * 0.6})`)
        halo.addColorStop(1, 'rgba(100,70,30,0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2)
        ctx.fillStyle = halo
        ctx.fill()

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,250,230,${op * 1.5})`
        ctx.fill()

        ctx.save()
        ctx.translate(p.x, p.y)
        ;[[-1,-0.5],[1,-0.5],[-0.7,0.35],[0.7,0.35]].forEach(([wx,wy]) => {
          ctx.beginPath()
          ctx.ellipse(wx*wingSpan, wy*wingSpan*0.7, wingSpan*0.8, wingSpan*0.3,
            wx < 0 ? -0.3 : 0.3, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(220,190,120,${op * 0.7})`
          ctx.lineWidth = 0.4
          ctx.stroke()
        })
        ctx.restore()
      })

      // ── Floating dust (left side) ───────────────────────────────────────
      for (let i = 0; i < 30; i++) {
        const dpx = w * 0.45 * ((Math.sin(i * 2.39) + 1) / 2)
        const dpy = h * (0.05 + 0.88 * ((Math.cos(i * 1.61) + 1) / 2))
        const drift = Math.sin(t * 0.003 + i * 0.8) * 5
        const op = 0.06 + 0.05 * Math.sin(t * 0.005 + i * 1.1)
        ctx.beginPath()
        ctx.arc(dpx + drift, dpy + drift * 0.3, 0.4 + (i % 3) * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(212,180,100,${op})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [activeRoam.x, activeRoam.y])

  // ── Pixie reaction ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!onReact) return
    const count = 2 + Math.floor(Math.random() * 2)
    ;[...pixiesRef.current]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .forEach(p => { p.reacting = true; p.reactTimer = 70 + Math.floor(Math.random() * 40) })
  }, [onReact])

  if (!mounted) return null

  return (
    <>
      {/* ── Layer 1: Lair background video ─────────────────────────────── */}
      <video
        ref={lairVideoRef}
        src={lairVideoSrc}
        muted playsInline preload="auto"
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'right center',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      />

      {/* ── Layer 2: Dark mask — hides Medhā in video (left 0–45%) ─────── */}
      {/* Gradient: left solid black → fade → transparent at 52% */}
      <div
        style={{
          position: 'fixed', inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          background: `linear-gradient(
            to right,
            rgba(0,0,0,1) 0%,
            rgba(0,0,0,1) ${MASK_SOLID_END * 100}%,
            rgba(0,0,0,0.85) ${(MASK_SOLID_END + 0.02) * 100}%,
            rgba(0,0,0,0.5) ${(MASK_SOLID_END + 0.04) * 100}%,
            rgba(0,0,0,0.15) ${(MASK_GRADIENT_END - 0.01) * 100}%,
            rgba(0,0,0,0) ${MASK_GRADIENT_END * 100}%,
            rgba(0,0,0,0) 100%
          )`,
        }}
      />

      {/* ── Layer 3: Canvas — aurora, pixies, dust (left side only) ────── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />

      {/* ── Layer 4: Entity video — positioned on left side ─────────────── */}
      <div
        style={{
          position: 'fixed',
          // Position follows roam — but clamped to left safe zone
          left: `${Math.min(activeRoam.x, 42)}%`,
          top: `${activeRoam.y}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 6,
          pointerEvents: 'none',
          width: entitySize,
          height: entitySize,
          opacity: activeVisible ? 1 : 0,
          filter: activeVisible ? 'blur(0px) brightness(1.8)' : 'blur(12px)',
          transition: 'left 2.8s cubic-bezier(0.16,1,0.3,1), top 2.8s cubic-bezier(0.16,1,0.3,1), opacity 1.6s ease, filter 1.6s ease',
          willChange: 'transform, opacity',
        }}
      >
        {/* Faculty colour aura beneath entity */}
        <div style={{
          position: 'absolute',
          bottom: '-8%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '15%',
          background: `radial-gradient(ellipse at center, ${facultyColor}30 0%, transparent 70%)`,
          filter: 'blur(12px)',
          zIndex: -1,
        }} />

        <video
          ref={entityVideoRef}
          src={entityVideoSrc}
          autoPlay loop muted playsInline preload="auto"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            // Screen blend removes black background from entity video
            mixBlendMode: 'screen',
            filter: 'brightness(2.2) saturate(1.8) contrast(1.15)',
            clipPath: 'inset(0 0 9% 0)',
          }}
        />
      </div>

      {/* ── Edge vignette — darkens screen edges ─────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 7, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 85% 85% at 62% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
      }} />
    </>
  )
}
