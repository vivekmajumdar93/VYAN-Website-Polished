'use client'

import {
  useRef, useState, useEffect, useCallback,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GATEWAYS, assetPath, type Gateway } from '@/lib/vistara/gateways'
import { drawVortex } from '@/lib/vistara/vortex'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface GatewayState {
  idx: number
  x: number           // current screen X (animated)
  y: number           // current screen Y
  scale: number       // current display scale
  glowIntensity: number
  isHovered: boolean
  isActive: boolean
  orbitPhase: number  // current orbit angle
  imgLoaded: boolean
}

// ─── Gateway renderer on canvas ───────────────────────────────────────────────

function drawGateway(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  gw: GatewayState,
  gateway: Gateway,
  w: number, h: number,
  t: number,
  globalOpacity: number
) {
  const { x, y, scale, glowIntensity, isHovered, isActive } = gw

  // Base size — gateway images are tall portrait
  const baseW = w * scale
  const aspect = img.naturalHeight / img.naturalWidth
  const baseH = baseW * aspect

  // Depth-based opacity — closer = more visible
  const depthOpacity = 0.35 + gateway.depth * 0.55
  const hoverBoost = isHovered ? 0.25 : 0
  const activeBoost = isActive ? 0.35 : 0
  const finalOpacity = Math.min((depthOpacity + hoverBoost + activeBoost) * globalOpacity, 1)

  if (finalOpacity < 0.02) return

  ctx.save()
  ctx.globalAlpha = finalOpacity
  ctx.globalCompositeOperation = 'screen'

  // Draw gateway image
  ctx.drawImage(img, x - baseW / 2, y - baseH / 2, baseW, baseH)

  ctx.restore()

  // ── Hover/active glow halo ──────────────────────────────────────────────
  if (glowIntensity > 0.01) {
    const glowR = baseW * 0.7 * glowIntensity
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR)
    const col = gateway.color
    glow.addColorStop(0, `${col}${Math.floor(0.25 * glowIntensity * 255).toString(16).padStart(2,'0')}`)
    glow.addColorStop(0.5, `${col}${Math.floor(0.12 * glowIntensity * 255).toString(16).padStart(2,'0')}`)
    glow.addColorStop(1, `${col}00`)
    ctx.beginPath()
    ctx.arc(x, y, glowR, 0, Math.PI * 2)
    ctx.fillStyle = glow
    ctx.fill()

    // Energy particles around hovered gateway
    if (isHovered || isActive) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t * 0.02
        const pr = baseW * (0.4 + 0.3 * Math.sin(t * 0.03 + i))
        const px = x + Math.cos(angle) * pr
        const py = y + Math.sin(angle) * pr * 0.7
        const pop = 0.4 + 0.4 * Math.sin(t * 0.05 + i * 1.3)
        ctx.beginPath()
        ctx.arc(px, py, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = `${gateway.color}${Math.floor(pop * glowIntensity * 200).toString(16).padStart(2,'0')}`
        ctx.fill()
      }
    }
  }

  // ── Depth indicator dot (when not hovered) ──────────────────────────────
  if (!isHovered && !isActive && finalOpacity > 0.1) {
    const dotR = 2 + gateway.depth * 3
    const dotGlow = ctx.createRadialGradient(x, y, 0, x, y, dotR * 3)
    dotGlow.addColorStop(0, `rgba(255,255,255,${finalOpacity * 0.8})`)
    dotGlow.addColorStop(1, `${gateway.color}00`)
    ctx.beginPath()
    ctx.arc(x, y, dotR * 3, 0, Math.PI * 2)
    ctx.fillStyle = dotGlow
    ctx.fill()
  }
}

// ─── Main component ────────────────────────────────────────────────────────────

interface VistaraVoidProps {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}

export function VistaraVoid({ onBack, onGatewayEnter }: VistaraVoidProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const mouseRef = useRef({ x: 0, y: 0, smoothX: 0, smoothY: 0 })
  const tRef = useRef(0)
  const rotationRef = useRef(0)
  const breatheRef = useRef(0)

  const [gatewayStates, setGatewayStates] = useState<GatewayState[]>(() =>
    GATEWAYS.map((gw, i) => ({
      idx: i,
      x: 0, y: 0,
      scale: gw.scale,
      glowIntensity: 0,
      isHovered: false,
      isActive: false,
      orbitPhase: gw.orbitPhase,
      imgLoaded: false,
    }))
  )
  const gatewayStatesRef = useRef(gatewayStates)
  useEffect(() => { gatewayStatesRef.current = gatewayStates }, [gatewayStates])

  const [hoveredGateway, setHoveredGateway] = useState<number | null>(null)
  const [activeGateway, setActiveGateway] = useState<number | null>(null)
  const [globalOpacity, setGlobalOpacity] = useState(1)
  const [showPanel, setShowPanel] = useState(false)
  const [panelGateway, setPanelGateway] = useState<Gateway | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Preload gateway images
  useEffect(() => {
    GATEWAYS.forEach((gw, i) => {
      const img = new Image()
      img.src = assetPath(gw.filename)
      img.onload = () => {
        imagesRef.current.set(gw.filename, img)
        setGatewayStates(prev => prev.map((s, si) =>
          si === i ? { ...s, imgLoaded: true } : s
        ))
      }
      img.onerror = () => {
        // Try assets/ subfolder as fallback
        const img2 = new Image()
        img2.src = `/assets/${gw.filename}`
        img2.onload = () => {
          imagesRef.current.set(gw.filename, img2)
          setGatewayStates(prev => prev.map((s, si) =>
            si === i ? { ...s, imgLoaded: true } : s
          ))
        }
      }
    })
  }, [])

  // Mouse / touch tracking
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

  // ── Main draw loop ─────────────────────────────────────────────────────────
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

      // Smooth mouse
      m.smoothX += (m.x - m.smoothX) * 0.03
      m.smoothY += (m.y - m.smoothY) * 0.03

      // Vortex rotation — slow, deliberate
      rotationRef.current += 0.00018
      // Breathe — 8 second cycle
      breatheRef.current = (Math.sin(t * 0.004) + 1) / 2

      ctx.clearRect(0, 0, w, h)

      // Vortex center — slightly above center
      const vcx = w * 0.5
      const vcy = h * 0.46

      // ── Draw procedural vortex ────────────────────────────────────────────
      drawVortex(ctx, w, h, {
        cx: vcx,
        cy: vcy,
        rotation: rotationRef.current,
        breathe: breatheRef.current,
        mouseX: m.smoothX,
        mouseY: m.smoothY,
      }, t)

      // ── Update and draw gateways ──────────────────────────────────────────
      const states = gatewayStatesRef.current
      const newStates = states.map((state, i) => {
        const gw = GATEWAYS[i]

        // Orbit animation — each gateway drifts in slow ellipse
        const newPhase = state.orbitPhase + gw.orbitSpeed
        const orbitX = Math.cos(newPhase) * gw.orbitRadius * (w / 1440)
        const orbitY = Math.sin(newPhase * 0.7) * gw.orbitRadius * 0.5 * (h / 900)

        // Screen position from % config + orbit + mouse parallax
        const parallaxX = m.smoothX * w * 0.025 * (1 - gw.depth * 0.6)
        const parallaxY = m.smoothY * h * 0.015 * (1 - gw.depth * 0.6)

        const sx = w * gw.x / 100 + orbitX + parallaxX
        const sy = h * gw.y / 100 + orbitY + parallaxY

        // Depth-based scale
        const depthScale = 0.5 + gw.depth * 0.5
        const hoverScale = state.isHovered ? 1.12 : 1
        const finalScale = gw.scale * depthScale * hoverScale

        // Glow intensity
        const targetGlow = state.isHovered || state.isActive ? 1 : 0
        const newGlow = state.glowIntensity + (targetGlow - state.glowIntensity) * 0.06

        const newState: GatewayState = {
          ...state,
          x: sx, y: sy,
          scale: finalScale,
          glowIntensity: newGlow,
          orbitPhase: newPhase,
        }

        // Draw gateway
        const img = imagesRef.current.get(gw.filename)
        if (img && state.imgLoaded) {
          drawGateway(ctx, img, newState, gw, w, h, t, globalOpacity)
        }

        return newState
      })

      // Sort by depth before updating (closer gateways drawn last/on top)
      // Already handled by GATEWAYS order, but update states
      setGatewayStates(newStates)

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [globalOpacity])

  // ── Hit detection ─────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    let hit = -1
    const states = gatewayStatesRef.current
    // Check from front to back (reverse depth order)
    for (let i = states.length - 1; i >= 0; i--) {
      const s = states[i]
      const hitR = canvas.width * s.scale * 0.6
      const dist = Math.hypot(mx - s.x, my - s.y)
      if (dist < hitR) { hit = i; break }
    }

    if (hit !== hoveredGateway) {
      setHoveredGateway(hit)
      setGatewayStates(prev => prev.map((s, i) => ({
        ...s, isHovered: i === hit
      })))
      if (canvas) canvas.style.cursor = hit >= 0 ? 'pointer' : 'default'
    }
  }, [hoveredGateway])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredGateway === null || hoveredGateway < 0) return
    const gw = GATEWAYS[hoveredGateway]
    setActiveGateway(hoveredGateway)
    setGatewayStates(prev => prev.map((s, i) => ({
      ...s, isActive: i === hoveredGateway, isHovered: false
    })))
    setPanelGateway(gw)
    setShowPanel(true)
  }, [hoveredGateway])

  // Touch tap
  const touchStart = useRef({ x: 0, y: 0 })
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const dx = Math.abs(e.changedTouches[0].clientX - touchStart.current.x)
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y)
    if (dx > 10 || dy > 10) return // was a drag, not a tap

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.changedTouches[0].clientX - rect.left
    const my = e.changedTouches[0].clientY - rect.top

    const states = gatewayStatesRef.current
    for (let i = states.length - 1; i >= 0; i--) {
      const s = states[i]
      const hitR = canvas.width * s.scale * 0.8
      const dist = Math.hypot(mx - s.x, my - s.y)
      if (dist < hitR) {
        const gw = GATEWAYS[i]
        setActiveGateway(i)
        setGatewayStates(prev => prev.map((st, si) => ({
          ...st, isActive: si === i
        })))
        setPanelGateway(gw)
        setShowPanel(true)
        break
      }
    }
  }, [])

  const handlePanelClose = useCallback(() => {
    setShowPanel(false)
    setActiveGateway(null)
    setGatewayStates(prev => prev.map(s => ({ ...s, isActive: false })))
    setPanelGateway(null)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>

      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Gateway name labels — HTML overlay, appear on hover */}
      {gatewayStates.map((state, i) => {
        const gw = GATEWAYS[i]
        if (!state.isHovered && !state.isActive) return null
        const labelOp = state.glowIntensity * globalOpacity
        if (labelOp < 0.05) return null

        return (
          <motion.div
            key={gw.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: labelOp, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              left: state.x,
              top: state.y + (canvasRef.current?.width ?? 0) * state.scale * 0.55,
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            <div style={{
              fontFamily: 'Georgia, serif',
              fontSize: `${10 + gw.depth * 4}px`,
              letterSpacing: '0.28em',
              color: gw.color,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textShadow: `0 0 20px ${gw.color}`,
              marginBottom: '4px',
            }}>
              {gw.name}
            </div>
            <div style={{
              fontFamily: 'system-ui',
              fontSize: '8px',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {gw.tagline}
            </div>
          </motion.div>
        )
      })}

      {/* Vistāra wordmark */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        style={{
          position: 'fixed', top: '22px', right: '24px',
          zIndex: 30, pointerEvents: 'none', textAlign: 'right',
        }}
      >
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          letterSpacing: '0.4em',
          color: 'rgba(212,180,80,0.6)',
          textTransform: 'uppercase',
        }}>
          Vistāra
        </div>
        <div style={{
          fontFamily: 'system-ui',
          fontSize: '8px',
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.2)',
          textTransform: 'uppercase',
          marginTop: '3px',
        }}>
          The Manifestations
        </div>
      </motion.div>

      {/* Back button */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={onBack}
          style={{
            position: 'fixed', top: '22px', left: '22px', zIndex: 30,
            background: 'transparent',
            border: '1px solid rgba(212,180,80,0.2)',
            borderRadius: '20px', padding: '7px 14px',
            color: 'rgba(212,180,80,0.4)',
            fontSize: '10px', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontFamily: 'system-ui',
            cursor: 'pointer',
          }}
        >
          ← Śūnya
        </motion.button>
      )}

      {/* Hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        style={{
          position: 'fixed', bottom: '5%', left: '50%',
          transform: 'translateX(-50%)', zIndex: 20,
          pointerEvents: 'none', textAlign: 'center',
        }}
      >
        <p style={{
          fontFamily: 'system-ui', fontSize: '9px',
          letterSpacing: '0.25em', color: 'rgba(255,255,255,0.15)',
          textTransform: 'uppercase',
        }}>
          {isMobile ? 'Tap a gateway to enter' : 'Hover to discover · Click to enter'}
        </p>
      </motion.div>

      {/* Gateway panel */}
      <AnimatePresence>
        {showPanel && panelGateway && (
          <GatewayPanel
            gateway={panelGateway}
            onClose={handlePanelClose}
            onEnter={() => {
              handlePanelClose()
              onGatewayEnter?.(panelGateway)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Gateway glass panel ───────────────────────────────────────────────────────

function GatewayPanel({
  gateway, onClose, onEnter,
}: {
  gateway: Gateway; onClose: () => void; onEnter: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 24 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: '480px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${gateway.color}22`,
          borderRadius: '20px',
          backdropFilter: 'blur(24px)',
          padding: '36px',
          boxShadow: `0 0 60px ${gateway.color}15`,
        }}
      >
        {/* Accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
          background: `linear-gradient(90deg, transparent, ${gateway.color}60, transparent)`,
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{
              fontSize: '9px', letterSpacing: '0.3em',
              color: `${gateway.color}90`, fontFamily: 'system-ui',
              textTransform: 'uppercase', marginBottom: '8px',
            }}>
              {gateway.tantra}
            </div>
            <h2 style={{
              fontFamily: 'Georgia, serif', fontSize: '26px',
              letterSpacing: '0.2em', color: 'rgba(255,255,255,0.92)',
              textTransform: 'uppercase', marginBottom: '6px',
              textShadow: `0 0 30px ${gateway.color}40`,
            }}>
              {gateway.name}
            </h2>
            <p style={{
              fontFamily: 'system-ui', fontSize: '11px',
              letterSpacing: '0.15em', color: `${gateway.color}80`,
              textTransform: 'uppercase',
            }}>
              {gateway.tagline}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.4)',
              padding: '6px 10px', cursor: 'pointer', fontSize: '12px',
            }}
          >✕</button>
        </div>

        <p style={{
          fontFamily: 'system-ui', fontSize: '14px',
          lineHeight: '1.75', color: 'rgba(255,255,255,0.6)',
          letterSpacing: '0.02em', marginBottom: '32px',
        }}>
          {gateway.description}
        </p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', color: 'rgba(255,255,255,0.5)',
              fontSize: '10px', letterSpacing: '0.2em',
              textTransform: 'uppercase', fontFamily: 'system-ui', cursor: 'pointer',
            }}
          >
            Return
          </button>
          <button
            onClick={onEnter}
            style={{
              padding: '13px 28px',
              background: `${gateway.color}18`,
              border: `1px solid ${gateway.color}40`,
              borderRadius: '10px', color: gateway.color,
              fontSize: '10px', letterSpacing: '0.2em',
              textTransform: 'uppercase', fontFamily: 'system-ui', cursor: 'pointer',
              boxShadow: `0 0 20px ${gateway.color}15`,
            }}
          >
            Enter
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
