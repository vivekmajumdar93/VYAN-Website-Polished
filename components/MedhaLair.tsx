'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'

// ─── Pixie ────────────────────────────────────────────────────────────────────

interface Pixie {
  x: number; y: number
  orbitCX: number; orbitCY: number
  orbitRX: number; orbitRY: number
  orbitAngle: number; orbitSpeed: number
  size: number; depth: number
  wingPhase: number; glowPhase: number
  reacting: boolean; reactTimer: number
  color: string
}

function buildPixies(w: number, h: number): Pixie[] {
  const colors = ['#c4a882', '#e8d5a3', '#b8956a', '#dfc38a', '#ffffff']
  return Array.from({ length: 12 }, (_, i) => ({
    x: w * (0.1 + Math.random() * 0.8),
    y: h * (0.1 + Math.random() * 0.7),
    orbitCX: w * (0.15 + Math.random() * 0.7),
    orbitCY: h * (0.15 + Math.random() * 0.6),
    orbitRX: 40 + Math.random() * 120,
    orbitRY: 20 + Math.random() * 60,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitSpeed: (0.002 + Math.random() * 0.003) * (Math.random() < 0.5 ? 1 : -1),
    size: 1.2 + Math.random() * 2,
    depth: 0.3 + Math.random() * 0.7,
    wingPhase: Math.random() * Math.PI * 2,
    glowPhase: Math.random() * Math.PI * 2,
    reacting: false,
    reactTimer: 0,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))
}

// ─── Layer config ─────────────────────────────────────────────────────────────

interface LairLayer {
  src: string
  x: number        // % from left
  y: number        // % from top
  w: number        // % of viewport width
  parallaxX: number  // mouse parallax multiplier
  parallaxY: number
  blendMode: string
  opacity: number
  floatAmp: number   // floating animation amplitude px
  floatSpeed: number
  floatPhase: number
  zIndex: number
}

// ─── Main component ────────────────────────────────────────────────────────────

interface MedhaLairProps {
  entityX?: number
  entityY?: number
  facultyColor?: string
  onReact?: boolean
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
  const mouseRef = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 })
  const tRef = useRef(0)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [imagesLoaded, setImagesLoaded] = useState(false)

  // Layer definitions — each image as a composited layer
  const LAYERS: LairLayer[] = [
    // Layer 0 — Deepest: two floating castles + purple nebula
    {
      src: '/assets/D5B90A6C-2556-4780-9904-121FA590EC00.png',
      x: 0, y: 10, w: 100,
      parallaxX: 0.006, parallaxY: 0.004,
      blendMode: 'screen',
      opacity: 0.18,
      floatAmp: 2, floatSpeed: 0.0003, floatPhase: 0,
      zIndex: 1,
    },
    // Layer 1 — Deep: castle with gold orb circle
    {
      src: '/assets/3ADEFC69-A670-49AD-9938-75EE09A18F9C.png',
      x: 20, y: 15, w: 35,
      parallaxX: 0.012, parallaxY: 0.008,
      blendMode: 'screen',
      opacity: 0.22,
      floatAmp: 4, floatSpeed: 0.0004, floatPhase: 0.8,
      zIndex: 2,
    },
    // Layer 2 — Mid-deep: castle with diamond base + gold ring
    {
      src: '/assets/88BE0E29-F269-4321-88A5-3AAAD30CE5AA.png',
      x: 25, y: 12, w: 30,
      parallaxX: 0.016, parallaxY: 0.010,
      blendMode: 'screen',
      opacity: 0.20,
      floatAmp: 5, floatSpeed: 0.0005, floatPhase: 1.6,
      zIndex: 3,
    },
    // Layer 3 — Mid: castle with large purple ring
    {
      src: '/assets/892C5B1F-93CA-43EB-8C78-310BA8C5E527.png',
      x: 5, y: 10, w: 40,
      parallaxX: 0.022, parallaxY: 0.014,
      blendMode: 'screen',
      opacity: 0.18,
      floatAmp: 4, floatSpeed: 0.0004, floatPhase: 2.4,
      zIndex: 4,
    },
    // Layer 4 — Foreground left: gazebo + platform + purple arcs
    {
      src: '/assets/07B0E72C-79FA-4998-AFAC-DF75CDD4B15C.png',
      x: -5, y: 22, w: 38,
      parallaxX: 0.030, parallaxY: 0.018,
      blendMode: 'screen',
      opacity: 0.25,
      floatAmp: 3, floatSpeed: 0.0004, floatPhase: 3.2,
      zIndex: 5,
    },
    // Layer 5 — Foreground right: arch + purple tree
    {
      src: '/assets/C788C6AD-194E-4EC4-8906-E4D27F21E57E.png',
      x: 30, y: 0, w: 45,
      parallaxX: 0.040, parallaxY: 0.025,
      blendMode: 'screen',
      opacity: 0.28,
      floatAmp: 3, floatSpeed: 0.0005, floatPhase: 4.1,
      zIndex: 6,
    },
  ]

  // Preload images
  useEffect(() => {
    let loaded = 0
    const total = LAYERS.length
    LAYERS.forEach(layer => {
      if (imagesRef.current.has(layer.src)) { loaded++; if (loaded === total) setImagesLoaded(true); return }
      const img = new Image()
      img.src = layer.src
      img.onload = () => {
        imagesRef.current.set(layer.src, img)
        loaded++
        if (loaded === total) setImagesLoaded(true)
      }
      img.onerror = () => { loaded++; if (loaded === total) setImagesLoaded(true) }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Main canvas draw loop
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
      const w = canvas.width, h = canvas.height
      const t = ++tRef.current

      // Smooth mouse
      const m = mouseRef.current
      m.smoothX += (m.x - m.smoothX) * 0.04
      m.smoothY += (m.y - m.smoothY) * 0.04

      ctx.clearRect(0, 0, w, h)

      // ── Draw image layers ────────────────────────────────────────────────
      LAYERS.forEach(layer => {
        const img = imagesRef.current.get(layer.src)
        if (!img) return

        // Float animation
        const floatY = Math.sin(t * layer.floatSpeed + layer.floatPhase) * layer.floatAmp
        const floatX = Math.cos(t * layer.floatSpeed * 0.7 + layer.floatPhase) * layer.floatAmp * 0.4

        // Parallax offset from mouse
        const px = m.smoothX * w * layer.parallaxX
        const py = m.smoothY * h * layer.parallaxY

        // Position & size
        const layerW = w * layer.w / 100
        const aspect = img.naturalHeight / img.naturalWidth
        const layerH = layerW * aspect
        const layerX = w * layer.x / 100 + px + floatX
        const layerY = h * layer.y / 100 + py + floatY

        ctx.save()
        ctx.globalAlpha = layer.opacity
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
        ctx.drawImage(img, layerX, layerY, layerW, layerH)
        ctx.restore()
      })

      // ── Atmospheric glow behind entity position ──────────────────────────
      const ex = w * entityX
      const ey = h * entityY
      const auroraPulse = 0.025 + 0.008 * Math.sin(t * 0.004)
      const aurora = ctx.createRadialGradient(ex, ey + 40, 0, ex, ey + 40, w * 0.25)
      aurora.addColorStop(0, `rgba(100,60,180,${auroraPulse * 0.5})`)
      aurora.addColorStop(0.4, `rgba(60,30,120,${auroraPulse})`)
      aurora.addColorStop(1, 'rgba(20,10,60,0)')
      ctx.beginPath()
      ctx.arc(ex, ey + 40, w * 0.25, 0, Math.PI * 2)
      ctx.fillStyle = aurora
      ctx.fill()

      // ── Ground mist ──────────────────────────────────────────────────────
      const mistY = h * 0.72
      const mist = ctx.createLinearGradient(0, mistY, 0, h)
      mist.addColorStop(0, 'rgba(40,20,80,0)')
      mist.addColorStop(0.4, 'rgba(30,15,60,0.06)')
      mist.addColorStop(1, 'rgba(20,10,50,0.12)')
      ctx.fillStyle = mist
      ctx.fillRect(0, mistY, w, h - mistY)

      // ── Pixies ───────────────────────────────────────────────────────────
      pixiesRef.current.forEach((p, i) => {
        p.orbitAngle += p.orbitSpeed
        const tx = p.orbitCX + Math.cos(p.orbitAngle) * p.orbitRX
        const ty = p.orbitCY + Math.sin(p.orbitAngle) * p.orbitRY

        if (p.reacting) {
          p.reactTimer--
          const toEx = ex - p.x, toEy = ey - p.y
          const d = Math.sqrt(toEx**2 + toEy**2)
          if (d > 50) { p.x += toEx/d * 2.8; p.y += toEy/d * 2.8 }
          if (p.reactTimer <= 0) p.reacting = false
        } else {
          p.x += (tx - p.x) * 0.007
          p.y += (ty - p.y) * 0.007
          p.x += Math.sin(t * 0.008 + p.glowPhase) * 0.25
          p.y += Math.cos(t * 0.006 + p.glowPhase) * 0.18
        }

        const glow = 0.4 + 0.35 * Math.sin(t * 0.012 + p.glowPhase)
        const wingSpan = p.size * (1.2 + 0.5 * Math.sin(t * 0.018 + p.wingPhase))
        const baseOp = p.depth * glow

        // Glow halo
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4)
        halo.addColorStop(0, `rgba(212,180,100,${baseOp * 0.9})`)
        halo.addColorStop(0.4, `rgba(160,120,60,${baseOp * 0.35})`)
        halo.addColorStop(1, 'rgba(100,70,30,0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2)
        ctx.fillStyle = halo
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,245,220,${baseOp})`
        ctx.fill()

        // Wings — 4 tiny ellipses
        ctx.save()
        ctx.translate(p.x, p.y)
        ;[[-1,-0.5],[1,-0.5],[-0.8,0.4],[0.8,0.4]].forEach(([wx,wy]) => {
          ctx.beginPath()
          ctx.ellipse(wx*wingSpan, wy*wingSpan*0.7, wingSpan*0.85, wingSpan*0.35,
            wx < 0 ? -0.35 : 0.35, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(212,180,100,${baseOp * 0.5})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        })
        ctx.restore()

        // React sparkle trail
        if (p.reacting) {
          for (let j = 0; j < 3; j++) {
            ctx.beginPath()
            ctx.arc(p.x+(Math.random()-0.5)*16, p.y+(Math.random()-0.5)*16, Math.random()*1.2, 0, Math.PI*2)
            ctx.fillStyle = `rgba(212,180,100,${baseOp*0.6})`
            ctx.fill()
          }
        }
      })

      // ── Floating dust particles ───────────────────────────────────────────
      // Pre-seeded so they don't jump frame to frame
      ctx.save()
      for (let i = 0; i < 60; i++) {
        // Deterministic per-particle position using sin/cos of index
        const px = w * (0.1 + 0.8 * ((Math.sin(i * 2.39) + 1) / 2))
        const py = h * (0.05 + 0.85 * ((Math.cos(i * 1.61) + 1) / 2))
        const drift = Math.sin(t * 0.003 + i * 0.8) * 8
        const op = (0.15 + 0.12 * Math.sin(t * 0.005 + i * 1.1)) * 0.7
        ctx.beginPath()
        ctx.arc(px + drift, py + drift * 0.4, 0.5 + (i % 3) * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(212,180,100,${op})`
        ctx.fill()
      }
      ctx.restore()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [imagesLoaded, entityX, entityY]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pixie reaction
  useEffect(() => {
    if (!onReact) return
    const count = 3 + Math.floor(Math.random() * 2)
    const shuffled = [...pixiesRef.current].sort(() => Math.random() - 0.5).slice(0, count)
    shuffled.forEach(p => { p.reacting = true; p.reactTimer = 90 + Math.floor(Math.random() * 50) })
  }, [onReact])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      />
      {/* Vignette — darkens edges to focus on center */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 6, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.65) 100%)',
      }} />
    </>
  )
}
