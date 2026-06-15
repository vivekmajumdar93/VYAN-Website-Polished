'use client'

import { useEffect, useRef, useState } from 'react'

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
  return Array.from({ length: 10 }, (_, i) => ({
    x: w * (0.1 + Math.random() * 0.8),
    y: h * (0.1 + Math.random() * 0.7),
    orbitCX: w * (0.15 + Math.random() * 0.7),
    orbitCY: h * (0.15 + Math.random() * 0.6),
    orbitRX: 30 + Math.random() * 100,
    orbitRY: 15 + Math.random() * 50,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitSpeed: (0.002 + Math.random() * 0.003) * (Math.random() < 0.5 ? 1 : -1),
    size: 1.0 + Math.random() * 1.8,
    depth: 0.3 + Math.random() * 0.7,
    wingPhase: Math.random() * Math.PI * 2,
    glowPhase: Math.random() * Math.PI * 2,
    reacting: false,
    reactTimer: 0,
  }))
}

// ─── Layer definition ──────────────────────────────────────────────────────────
// Position is % of viewport. Measured from target composition (Image 1).
// parallaxX/Y: how much this layer shifts on mouse move (deeper = less shift)
interface Layer {
  src: string
  // Placement — % of viewport
  left: number    // % from left edge
  top: number     // % from top edge
  width: number   // % of viewport width
  // Animation
  parallaxX: number
  parallaxY: number
  floatAmp: number
  floatSpeed: number
  floatPhase: number
  opacity: number
  blendMode: GlobalCompositeOperation
}

// Exact placements matching Image 1 composition
const LAYERS: Layer[] = [
  // ── Deepest bg: multiple distant castles (Image_3 equivalent)
  // Full screen, very faint, slowest parallax
  {
    src: '/assets/D5B90A6C-2556-4780-9904-121FA590EC00.png',
    left: 0, top: 0, width: 100,
    parallaxX: 0.005, parallaxY: 0.003,
    floatAmp: 1.5, floatSpeed: 0.0003, floatPhase: 0,
    opacity: 0.18,
    blendMode: 'screen',
  },
  // ── Large floating castle — center, upper-mid
  // Image 1: castle sits at ~x:35-65%, y:15-55%
  {
    src: '/assets/3ADEFC69-A670-49AD-9938-75EE09A18F9C.png',
    left: 28, top: 8, width: 42,
    parallaxX: 0.010, parallaxY: 0.007,
    floatAmp: 4, floatSpeed: 0.0004, floatPhase: 0.8,
    opacity: 0.55,
    blendMode: 'screen',
  },
  // ── Castle with diamond base — center, slightly behind main castle
  {
    src: '/assets/88BE0E29-F269-4321-88A5-3AAAD30CE5AA.png',
    left: 32, top: 12, width: 36,
    parallaxX: 0.013, parallaxY: 0.009,
    floatAmp: 3, floatSpeed: 0.0005, floatPhase: 1.6,
    opacity: 0.45,
    blendMode: 'screen',
  },
  // ── Castle with large purple ring — overlapping center
  {
    src: '/assets/892C5B1F-93CA-43EB-8C78-310BA8C5E527.png',
    left: 22, top: 5, width: 48,
    parallaxX: 0.008, parallaxY: 0.005,
    floatAmp: 3, floatSpeed: 0.0003, floatPhase: 2.4,
    opacity: 0.35,
    blendMode: 'screen',
  },
  // ── Gazebo + platform — bottom LEFT
  // Image 1: left edge, bottom ~y:45-100%, x:0-30%
  {
    src: '/assets/07B0E72C-79FA-4998-AFAC-DF75CDD4B15C.png',
    left: -8, top: 38, width: 42,
    parallaxX: 0.022, parallaxY: 0.014,
    floatAmp: 2, floatSpeed: 0.0004, floatPhase: 3.2,
    opacity: 0.70,
    blendMode: 'screen',
  },
  // ── Arch + tree — RIGHT SIDE
  // Image 1: right edge x:60-100%, y:10-100%
  {
    src: '/assets/C788C6AD-194E-4EC4-8906-E4D27F21E57E.png',
    left: 55, top: 5, width: 48,
    parallaxX: 0.030, parallaxY: 0.018,
    floatAmp: 2.5, floatSpeed: 0.0005, floatPhase: 4.1,
    opacity: 0.75,
    blendMode: 'screen',
  },
]

interface MedhaLairProps {
  entityX?: number
  entityY?: number
  facultyColor?: string
  onReact?: boolean
}

export function MedhaLair({
  entityX = 0.5,
  entityY = 0.36,
  onReact = false,
}: MedhaLairProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const pixiesRef = useRef<Pixie[]>([])
  const mouseRef = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 })
  const tRef = useRef(0)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const [loaded, setLoaded] = useState(false)

  // Preload all images
  useEffect(() => {
    let done = 0
    const total = LAYERS.length
    LAYERS.forEach(layer => {
      const img = new Image()
      img.src = layer.src
      img.onload = () => {
        imagesRef.current.set(layer.src, img)
        done++
        if (done === total) setLoaded(true)
      }
      img.onerror = () => { done++; if (done === total) setLoaded(true) }
    })
  }, [])

  // Mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const onTouch = (e: TouchEvent) => {
      mouseRef.current.x = (e.touches[0].clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = (e.touches[0].clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
    }
  }, [])

  // Main draw loop
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
      const m = mouseRef.current

      // Smooth mouse
      m.smoothX += (m.x - m.smoothX) * 0.04
      m.smoothY += (m.y - m.smoothY) * 0.04

      ctx.clearRect(0, 0, w, h)

      // ── Draw image layers ────────────────────────────────────────────────
      LAYERS.forEach(layer => {
        const img = imagesRef.current.get(layer.src)
        if (!img || !img.complete) return

        // Float
        const fy = Math.sin(t * layer.floatSpeed + layer.floatPhase) * layer.floatAmp
        const fx = Math.cos(t * layer.floatSpeed * 0.7 + layer.floatPhase) * layer.floatAmp * 0.3

        // Parallax from mouse
        const px = m.smoothX * w * layer.parallaxX
        const py = m.smoothY * h * layer.parallaxY

        // Calculate pixel dimensions
        const lw = w * layer.width / 100
        const aspect = img.naturalHeight / img.naturalWidth
        const lh = lw * aspect
        const lx = w * layer.left / 100 + px + fx
        const ly = h * layer.top / 100 + py + fy

        ctx.save()
        ctx.globalAlpha = layer.opacity
        ctx.globalCompositeOperation = layer.blendMode
        ctx.drawImage(img, lx, ly, lw, lh)
        ctx.restore()
      })

      // ── Subtle aurora behind entity ──────────────────────────────────────
      const ex = w * entityX
      const ey = h * entityY
      const ap = 0.015 + 0.005 * Math.sin(t * 0.004)
      const aurora = ctx.createRadialGradient(ex, ey + 60, 0, ex, ey + 60, w * 0.18)
      aurora.addColorStop(0, `rgba(80,40,160,${ap * 2})`)
      aurora.addColorStop(0.5, `rgba(50,20,120,${ap})`)
      aurora.addColorStop(1, 'rgba(20,10,60,0)')
      ctx.beginPath()
      ctx.arc(ex, ey + 60, w * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = aurora
      ctx.fill()

      // ── Ground mist ──────────────────────────────────────────────────────
      const mistY = h * 0.75
      const mist = ctx.createLinearGradient(0, mistY, 0, h)
      mist.addColorStop(0, 'rgba(20,10,50,0)')
      mist.addColorStop(0.5, 'rgba(15,8,40,0.08)')
      mist.addColorStop(1, 'rgba(10,5,30,0.15)')
      ctx.fillStyle = mist
      ctx.fillRect(0, mistY, w, h - mistY)

      // ── Pixies ───────────────────────────────────────────────────────────
      pixiesRef.current.forEach(p => {
        p.orbitAngle += p.orbitSpeed
        const tx = p.orbitCX + Math.cos(p.orbitAngle) * p.orbitRX
        const ty = p.orbitCY + Math.sin(p.orbitAngle) * p.orbitRY

        if (p.reacting) {
          p.reactTimer--
          const dx = ex - p.x, dy = ey - p.y
          const d = Math.sqrt(dx*dx + dy*dy)
          if (d > 50) { p.x += dx/d*2.5; p.y += dy/d*2.5 }
          if (p.reactTimer <= 0) p.reacting = false
        } else {
          p.x += (tx - p.x) * 0.007
          p.y += (ty - p.y) * 0.007
          p.x += Math.sin(t * 0.008 + p.glowPhase) * 0.2
          p.y += Math.cos(t * 0.006 + p.glowPhase) * 0.15
        }

        const glow = 0.35 + 0.30 * Math.sin(t * 0.012 + p.glowPhase)
        const wingSpan = p.size * (1.2 + 0.5 * Math.sin(t * 0.018 + p.wingPhase))
        const op = p.depth * glow

        // Glow halo
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5)
        halo.addColorStop(0, `rgba(212,180,100,${op * 0.85})`)
        halo.addColorStop(0.4, `rgba(160,120,60,${op * 0.3})`)
        halo.addColorStop(1, 'rgba(100,70,30,0)')
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2)
        ctx.fillStyle = halo
        ctx.fill()

        // Core
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,245,220,${op})`
        ctx.fill()

        // Wings
        ctx.save()
        ctx.translate(p.x, p.y)
        ;[[-1,-0.5],[1,-0.5],[-0.7,0.35],[0.7,0.35]].forEach(([wx,wy]) => {
          ctx.beginPath()
          ctx.ellipse(wx*wingSpan, wy*wingSpan*0.7, wingSpan*0.8, wingSpan*0.3,
            wx < 0 ? -0.3 : 0.3, 0, Math.PI*2)
          ctx.strokeStyle = `rgba(212,180,100,${op * 0.45})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        })
        ctx.restore()
      })

      // ── Floating dust ────────────────────────────────────────────────────
      for (let i = 0; i < 40; i++) {
        const dpx = w * (0.1 + 0.8 * ((Math.sin(i * 2.39) + 1) / 2))
        const dpy = h * (0.05 + 0.85 * ((Math.cos(i * 1.61) + 1) / 2))
        const drift = Math.sin(t * 0.003 + i * 0.8) * 6
        const op = (0.08 + 0.07 * Math.sin(t * 0.005 + i * 1.1))
        ctx.beginPath()
        ctx.arc(dpx + drift, dpy + drift * 0.3, 0.4 + (i % 3) * 0.35, 0, Math.PI * 2)
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
  }, [loaded, entityX, entityY])

  // Pixie reaction
  useEffect(() => {
    if (!onReact) return
    const count = 3 + Math.floor(Math.random() * 2)
    ;[...pixiesRef.current].sort(() => Math.random() - 0.5)
      .slice(0, count)
      .forEach(p => { p.reacting = true; p.reactTimer = 80 + Math.floor(Math.random() * 40) })
  }, [onReact])

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          zIndex: 5, pointerEvents: 'none',
        }}
      />
      {/* Edge vignette — darkens corners, focuses center on Medhā */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 6, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 70% at 50% 42%, transparent 35%, rgba(0,0,0,0.75) 100%)',
      }} />
    </>
  )
}
