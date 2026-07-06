'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GATEWAYS, assetPath, type Gateway } from '@/lib/vistara/gateways'
import { BackIcon, CloseIcon } from '@/components/icons/VyanIcons'

// ─── Vortex background — image made alive with canvas overlay ─────────────────

function VortexBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const mouseRef = useRef({ x: 0, y: 0, sx: 0, sy: 0 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const t = ++tRef.current
      const m = mouseRef.current

      m.sx += (m.x - m.sx) * 0.03
      m.sy += (m.y - m.sy) * 0.03

      ctx.clearRect(0, 0, w, h)

      const cx = w * 0.5 + m.sx * w * 0.012
      const cy = h * 0.48 + m.sy * h * 0.008

      // ── Breathing core glow ──────────────────────────────────────────────
      const breathe = (Math.sin(t * 0.004) + 1) / 2
      const coreR = Math.min(w, h) * (0.10 + breathe * 0.02)
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR)
      core.addColorStop(0, `rgba(255,255,255,${0.08 + breathe * 0.04})`)
      core.addColorStop(0.3, `rgba(220,210,255,${0.04 + breathe * 0.02})`)
      core.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fillStyle = core
      ctx.fill()

      // ── Slow-moving particle layer along vortex arms ─────────────────────
      for (let i = 0; i < 220; i++) {
        // Each particle travels along a spiral path
        const speed = 0.00015 + (i % 7) * 0.00005
        const phase = (i / 220) * Math.PI * 2 + t * speed
        const armIdx = i % 5
        const armAngle = armIdx * (Math.PI * 2 / 5)
        const progress = ((i * 0.618) % 1)
        const r = Math.min(w, h) * 0.52 * Math.pow(1 - progress, 0.6)
        const angle = armAngle + phase + progress * Math.PI * 6
        const yRatio = 0.40 + progress * 0.18

        const px = cx + Math.cos(angle) * r
        const py = cy + Math.sin(angle) * r * yRatio

        // Only draw if within canvas
        if (px < 0 || px > w || py < 0 || py > h) continue

        const twinkle = 0.3 + 0.5 * Math.sin(t * 0.012 + i * 0.8)
        const isGold = i % 5 === 0
        const isBright = i % 18 === 0
        const size = 0.5 + (i % 4) * 0.3

        if (isGold) {
          ctx.beginPath()
          ctx.arc(px, py, size * 1.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,190,60,${twinkle * 0.55})`
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(px, py, size, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255,255,255,${twinkle * 0.40})`
          ctx.fill()
        }

        // Bright star burst
        if (isBright) {
          for (let s = 0; s < 4; s++) {
            const sa = (s / 4) * Math.PI * 2
            ctx.beginPath()
            ctx.moveTo(px, py)
            ctx.lineTo(px + Math.cos(sa) * 4, py + Math.sin(sa) * 4)
            ctx.strokeStyle = `rgba(255,255,255,${twinkle * 0.5})`
            ctx.lineWidth = 0.4
            ctx.stroke()
          }
        }
      }

      // ── Subtle vortex energy shimmer ─────────────────────────────────────
      // Thin bright arcs that shimmer within the existing vortex
      for (let arm = 0; arm < 6; arm++) {
        const armBase = (arm / 6) * Math.PI * 2 + t * 0.00012
        const arcOpacity = 0.03 + 0.02 * Math.sin(t * 0.006 + arm * 1.1)
        if (arcOpacity < 0.01) continue

        ctx.beginPath()
        const segments = 60
        for (let i = 0; i <= segments; i++) {
          const prog = i / segments
          const r = Math.min(w, h) * 0.5 * Math.pow(1 - prog, 0.65)
          const angle = armBase + prog * Math.PI * 2 * 2.8
          const yRatio = 0.38 + prog * 0.20
          const wave = Math.sin(prog * Math.PI * 8 + t * 0.02 + arm) * r * 0.015
          const x = cx + Math.cos(angle) * (r + wave)
          const y = cy + Math.sin(angle) * (r + wave) * yRatio
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(220,215,255,${arcOpacity})`
        ctx.lineWidth = 0.7
        ctx.stroke()
      }

      // ── Edge darkening — vignette ─────────────────────────────────────────
      const vignette = ctx.createRadialGradient(cx, cy, Math.min(w,h)*0.3, cx, cy, Math.min(w,h)*0.75)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.45)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, w, h)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      {/* Base vortex image — desktop */}
      <img
        src="/D0070A92-4437-4E55-9AC1-08A7AD47EA1A.png"
        alt=""
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 1,
          pointerEvents: 'none',
        }}
        onError={e => {
          // Try assets/ subfolder
          ;(e.target as HTMLImageElement).src = '/assets/D0070A92-4437-4E55-9AC1-08A7AD47EA1A.png'
        }}
      />
      {/* Mobile vortex — storm image */}
      <style>{`
        @media (max-width: 768px) {
          .vistara-bg-desktop { display: none !important; }
          .vistara-bg-mobile { display: block !important; }
        }
        @media (min-width: 769px) {
          .vistara-bg-mobile { display: none !important; }
        }
      `}</style>
      <img
        className="vistara-bg-mobile"
        src="/02594BF3-E885-4D46-92BF-0187367C0AC6.png"
        alt=""
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 1,
          pointerEvents: 'none',
          display: 'none',
        }}
        onError={e => {
          ;(e.target as HTMLImageElement).src = '/assets/02594BF3-E885-4D46-92BF-0187367C0AC6.png'
        }}
      />
      {/* Live canvas overlay — particles, shimmer, glow */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </>
  )
}

// ─── Gateway drawn on canvas ───────────────────────────────────────────────────

function drawGatewayOnCanvas(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number, sy: number,     // screen position
  displayW: number,           // display width in pixels
  gateway: Gateway,
  glowIntensity: number,
  isHovered: boolean,
  isActive: boolean,
  globalOpacity: number,
  t: number
) {
  const aspect = img.naturalHeight / img.naturalWidth
  const displayH = displayW * aspect

  const depthOpacity = 0.40 + gateway.depth * 0.50
  const boost = (isHovered ? 0.20 : 0) + (isActive ? 0.30 : 0)
  const finalOpacity = Math.min((depthOpacity + boost) * globalOpacity, 1.0)

  if (finalOpacity < 0.02) return

  ctx.save()
  ctx.globalAlpha = finalOpacity
  ctx.globalCompositeOperation = 'screen'
  ctx.drawImage(img, sx - displayW / 2, sy - displayH / 2, displayW, displayH)
  ctx.restore()

  // Hover/active glow
  if (glowIntensity > 0.01) {
    const glowR = displayW * 0.65 * glowIntensity
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR)
    const col = gateway.color
    glow.addColorStop(0, `${col}${Math.floor(0.30 * glowIntensity * 255).toString(16).padStart(2,'0')}`)
    glow.addColorStop(0.5, `${col}${Math.floor(0.12 * glowIntensity * 255).toString(16).padStart(2,'0')}`)
    glow.addColorStop(1, `${col}00`)
    ctx.beginPath()
    ctx.arc(sx, sy, glowR, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // Orbiting particles on hover
    if (isHovered || isActive) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + t * 0.025
        const pr = displayW * (0.5 + 0.2 * Math.sin(t * 0.04 + i))
        const px = sx + Math.cos(a) * pr
        const py = sy + Math.sin(a) * pr * 0.6
        const op = (0.4 + 0.4 * Math.sin(t * 0.06 + i * 1.4)) * glowIntensity
        ctx.beginPath()
        ctx.arc(px, py, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = `${gateway.color}${Math.floor(op * 200).toString(16).padStart(2,'0')}`
        ctx.fill()
      }
    }
  }
}

// ─── Gateway canvas layer ─────────────────────────────────────────────────────

interface GatewayState {
  idx: number
  screenX: number
  screenY: number
  displayW: number
  orbitPhase: number
  glowIntensity: number
  isHovered: boolean
  isActive: boolean
  imgLoaded: boolean
}

interface GatewayCanvasProps {
  onHover: (idx: number | null) => void
  onActivate: (idx: number) => void
  globalOpacity: number
}

function GatewayCanvas({ onHover, onActivate, globalOpacity }: GatewayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const statesRef = useRef<GatewayState[]>(
    GATEWAYS.map((gw, i) => ({
      idx: i, screenX: 0, screenY: 0, displayW: 0,
      orbitPhase: gw.orbitPhase,
      glowIntensity: 0, isHovered: false, isActive: false, imgLoaded: false,
    }))
  )
  const mouseRef = useRef({ x: 0, y: 0, sx: 0, sy: 0 })
  const hoveredRef = useRef<number | null>(null)
  const tRef = useRef(0)

  // Preload images
  useEffect(() => {
    GATEWAYS.forEach((gw, i) => {
      const tryLoad = (src: string, fallback?: string) => {
        const img = new Image()
        img.src = src
        img.onload = () => {
          imagesRef.current.set(gw.filename, img)
          statesRef.current[i].imgLoaded = true
        }
        img.onerror = () => {
          if (fallback) tryLoad(fallback)
        }
      }
      tryLoad(`/${gw.filename}`, `/assets/${gw.filename}`)
    })
  }, [])

  // Mouse
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      const t = ++tRef.current
      const m = mouseRef.current
      const minDim = Math.min(w, h)

      m.sx += (m.x - m.sx) * 0.04
      m.sy += (m.y - m.sy) * 0.04

      ctx.clearRect(0, 0, w, h)

      // Update and draw each gateway
      statesRef.current.forEach((state, i) => {
        const gw = GATEWAYS[i]

        // Orbit
        state.orbitPhase += gw.orbitSpeed
        const orbitX = Math.cos(state.orbitPhase) * gw.orbitRadius * minDim * 0.001
        const orbitY = Math.sin(state.orbitPhase * 0.7) * gw.orbitRadius * 0.5 * minDim * 0.001

        // Parallax — far gateways move less
        const parallaxX = m.sx * w * 0.018 * (1 - gw.depth * 0.65)
        const parallaxY = m.sy * h * 0.012 * (1 - gw.depth * 0.65)

        // Final screen position
        state.screenX = w * gw.x / 100 + orbitX + parallaxX
        state.screenY = h * gw.y / 100 + orbitY + parallaxY

        // Display size — depth scaled, minDim based
        const depthScale = 0.45 + gw.depth * 0.55
        const hoverScale = state.isHovered ? 1.08 : 1
        state.displayW = minDim * gw.scale * depthScale * hoverScale

        // Glow
        const targetGlow = state.isHovered || state.isActive ? 1 : 0
        state.glowIntensity += (targetGlow - state.glowIntensity) * 0.07

        // Draw
        const img = imagesRef.current.get(gw.filename)
        if (img && state.imgLoaded) {
          drawGatewayOnCanvas(
            ctx, img,
            state.screenX, state.screenY,
            state.displayW, gw,
            state.glowIntensity,
            state.isHovered, state.isActive,
            globalOpacity, t
          )
        }
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [globalOpacity])

  // Hit detection
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let hit = -1
    for (let i = statesRef.current.length - 1; i >= 0; i--) {
      const s = statesRef.current[i]
      const img = imagesRef.current.get(GATEWAYS[i].filename)
      if (!img) continue
      const hitW = s.displayW * 0.55
      const hitH = hitW * (img.naturalHeight / img.naturalWidth) * 0.55
      if (
        mx > s.screenX - hitW && mx < s.screenX + hitW &&
        my > s.screenY - hitH && my < s.screenY + hitH
      ) { hit = i; break }
    }

    if (hit !== hoveredRef.current) {
      if (hoveredRef.current !== null && hoveredRef.current >= 0) {
        statesRef.current[hoveredRef.current].isHovered = false
      }
      hoveredRef.current = hit >= 0 ? hit : null
      if (hit >= 0) statesRef.current[hit].isHovered = true
      onHover(hit >= 0 ? hit : null)
      canvasRef.current!.style.cursor = hit >= 0 ? 'pointer' : 'default'
    }
  }, [onHover])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredRef.current !== null && hoveredRef.current >= 0) {
      statesRef.current.forEach((s, i) => { s.isActive = i === hoveredRef.current })
      onActivate(hoveredRef.current)
    }
  }, [onActivate])

  // Touch
  const touchStart = useRef({ x: 0, y: 0 })
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x)
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y)
    if (dx > 12 || dy > 12) return
    const rect = canvasRef.current!.getBoundingClientRect()
    const mx = e.changedTouches[0].clientX - rect.left
    const my = e.changedTouches[0].clientY - rect.top
    for (let i = statesRef.current.length - 1; i >= 0; i--) {
      const s = statesRef.current[i]
      const img = imagesRef.current.get(GATEWAYS[i].filename)
      if (!img) continue
      const hitR = s.displayW * 0.6
      if (Math.hypot(mx - s.screenX, my - s.screenY) < hitR) {
        statesRef.current.forEach((st, si) => { st.isActive = si === i })
        onActivate(i)
        break
      }
    }
  }, [onActivate])

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 10 }}
    />
  )
}

// ─── Main Vistara component ────────────────────────────────────────────────────

export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [showPanel, setShowPanel] = useState(false)
  const [panelGateway, setPanelGateway] = useState<Gateway | null>(null)
  const statesRef = useRef<{ isActive: boolean }[]>(GATEWAYS.map(() => ({ isActive: false })))

  const handleActivate = useCallback((idx: number) => {
    statesRef.current.forEach((s, i) => { s.isActive = i === idx })
    setActiveIdx(idx)
    setPanelGateway(GATEWAYS[idx])
    setShowPanel(true)
  }, [])

  const handlePanelClose = useCallback(() => {
    setShowPanel(false)
    setActiveIdx(null)
    statesRef.current.forEach(s => { s.isActive = false })
    setPanelGateway(null)
  }, [])

  const hoveredGateway = hoveredIdx !== null ? GATEWAYS[hoveredIdx] : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>

      {/* Layer 1+2: Vortex image + live canvas overlay */}
      <VortexBackground />

      {/* Layer 3: Gateway canvas */}
      <GatewayCanvas
        onHover={setHoveredIdx}
        onActivate={handleActivate}
        globalOpacity={showPanel ? 0.4 : 1}
      />

      {/* Gateway name label — HTML, appears on hover */}
      <AnimatePresence>
        {hoveredGateway && !showPanel && (
          <motion.div
            key={hoveredGateway.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              bottom: '14%',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 30,
            }}
          >
            <div style={{
              fontFamily: 'var(--font-vyan)',
              fontSize: '13px',
              letterSpacing: '0.32em',
              color: hoveredGateway.color,
              textTransform: 'uppercase',
              textShadow: `0 0 24px ${hoveredGateway.color}`,
              marginBottom: '5px',
            }}>
              {hoveredGateway.name}
            </div>
            <div style={{
              fontFamily: 'var(--font-vyan)',
              fontSize: '9px',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
            }}>
              {hoveredGateway.tagline}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
        style={{
          position: 'fixed', top: '22px', right: '24px', zIndex: 30,
          pointerEvents: 'none', textAlign: 'right',
        }}
      >
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '11px', letterSpacing: '0.4em', color: 'rgba(212,180,80,0.55)', textTransform: 'uppercase' }}>
          Vistāra
        </div>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '8px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', marginTop: '3px' }}>
          The Manifestations
        </div>
      </motion.div>

      {/* Back */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          onClick={onBack}
          style={{
            position: 'fixed', top: '22px', left: '22px', zIndex: 30,
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, color: '#9B59FF',
          }}
        >
          <BackIcon size={28} />
          <span style={{ fontFamily: 'var(--font-vyan)', fontSize: 11, letterSpacing: '0.2em', opacity: 0.7 }}>ŚŪNYA MAṆḌALA</span>
        </motion.button>
      )}

      {/* Hint */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}
        style={{
          position: 'fixed', bottom: '5%', left: '50%',
          transform: 'translateX(-50%)', zIndex: 20, pointerEvents: 'none',
        }}
      >
        <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.14)', textTransform: 'uppercase' }}>
          Hover to discover · Click to enter
        </p>
      </motion.div>

      {/* Gateway panel */}
      <AnimatePresence>
        {showPanel && panelGateway && (
          <GatewayPanel
            gateway={panelGateway}
            onClose={handlePanelClose}
            onEnter={() => { handlePanelClose(); onGatewayEnter?.(panelGateway) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Glass panel ───────────────────────────────────────────────────────────────

function GatewayPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway; onClose: () => void; onEnter: () => void
}) {
  const [closeHov, setCloseHov] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 20 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px',
          background: 'rgba(255,255,255,0.03)', border: `1px solid ${gateway.color}25`,
          borderRadius: '20px', backdropFilter: 'blur(24px)', padding: '34px',
          boxShadow: `0 0 60px ${gateway.color}12`,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: '1px', background: `linear-gradient(90deg, transparent, ${gateway.color}55, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '0.28em', color: `${gateway.color}80`, fontFamily: 'var(--font-vyan)', textTransform: 'uppercase', marginBottom: '7px' }}>{gateway.tantra}</div>
            <h2 style={{ fontFamily: 'var(--font-vyan)', fontSize: '24px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', marginBottom: '6px', textShadow: `0 0 30px ${gateway.color}35` }}>{gateway.name}</h2>
            <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '10px', letterSpacing: '0.15em', color: `${gateway.color}70`, textTransform: 'uppercase' }}>{gateway.tagline}</p>
          </div>
          <button
            onMouseEnter={() => setCloseHov(true)}
            onMouseLeave={() => setCloseHov(false)}
            onClick={onClose}
            style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', zIndex: 10 }}
          >
            <CloseIcon size={24} isHovered={closeHov} />
          </button>
        </div>
        <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '14px', lineHeight: '1.75', color: 'rgba(255,255,255,0.58)', letterSpacing: '0.02em', marginBottom: '30px' }}>{gateway.description}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer' }}>Return</button>
          <button onClick={onEnter} style={{ padding: '12px 26px', background: `${gateway.color}15`, border: `1px solid ${gateway.color}38`, borderRadius: '10px', color: gateway.color, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer', boxShadow: `0 0 20px ${gateway.color}12` }}>Enter</button>
        </div>
      </motion.div>
    </motion.div>
  )
}
