'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GATEWAYS, type Gateway, assetPath } from '@/lib/vistara/gateways'
import { BackIcon, CloseIcon } from '@/components/icons/VyanIcons'
import { VistaraScene } from './scene/VistaraScene'

// ── Gateway orb ───────────────────────────────────────────────────────────────

function GatewayOrb({ gw, isHovered, isActive, onEnter, onLeave, onClick }: {
  gw: Gateway
  isHovered: boolean
  isActive: boolean
  onEnter: () => void
  onLeave: () => void
  onClick: () => void
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const size = Math.round(gw.scale * 700)

  useEffect(() => {
    let raf = 0
    function tick(t: number) {
      if (innerRef.current) {
        const dx = gw.orbitRadius * Math.cos(t * gw.orbitSpeed + gw.orbitPhase)
        const dy = gw.orbitRadius * 0.45 * Math.sin(t * gw.orbitSpeed + gw.orbitPhase)
        innerRef.current.style.transform = `translate(${dx}px, ${dy}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [gw.orbitRadius, gw.orbitSpeed, gw.orbitPhase])

  const lit = isHovered || isActive
  const glowSize  = Math.round(size * (lit ? 0.55 : 0.28))
  const glowSize2 = Math.round(size * (lit ? 1.1  : 0.55))
  const alpha1 = lit ? '70' : '38'
  const alpha2 = lit ? '28' : '12'

  return (
    <div style={{
      position: 'absolute',
      left: `${gw.x}%`,
      top: `${gw.y}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: Math.round(gw.depth * 10) + 1,
      pointerEvents: 'none',
    }}>
      <div
        ref={innerRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          pointerEvents: 'all',
          cursor: 'pointer',
          position: 'relative',
          filter: `drop-shadow(0 0 ${Math.round(size * (lit ? 0.22 : 0.1))}px ${gw.color}${lit ? '80' : '50'})`,
          transition: 'filter 0.35s ease',
        }}
      >
        {/* Outer halo */}
        <div style={{
          position: 'absolute',
          inset: '-18%',
          borderRadius: '50%',
          border: `1px solid ${gw.color}${lit ? '40' : '18'}`,
          boxShadow: `0 0 ${glowSize}px ${gw.color}${alpha1}, 0 0 ${glowSize2}px ${gw.color}${alpha2}`,
          transition: 'all 0.35s ease',
          pointerEvents: 'none',
        }} />
        {/* Second inner halo — tighter pulse ring */}
        <div style={{
          position: 'absolute',
          inset: '-6%',
          borderRadius: '50%',
          border: `1px solid ${gw.color}${lit ? '55' : '22'}`,
          transition: 'all 0.35s ease',
          pointerEvents: 'none',
        }} />
        {/* Product image */}
        <img
          src={assetPath(gw.filename)}
          alt={gw.name}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            opacity: 0.45 + gw.depth * 0.55,
            transition: 'opacity 0.35s ease',
            userSelect: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ── Main Vistara component ─────────────────────────────────────────────────────

export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [hoveredId,  setHoveredId]  = useState<string | null>(null)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [showPanel,  setShowPanel]  = useState(false)
  const [panelGateway, setPanelGateway] = useState<Gateway | null>(null)

  const hoveredGateway = hoveredId ? GATEWAYS.find(g => g.id === hoveredId) ?? null : null

  const handleOrbClick = useCallback((id: string) => {
    const gw = GATEWAYS.find(g => g.id === id)
    if (!gw) return
    setActiveId(id)
    setPanelGateway(gw)
    setShowPanel(true)
  }, [])

  const handlePanelClose = useCallback(() => {
    setShowPanel(false)
    setActiveId(null)
    setPanelGateway(null)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 2 }}>

      {/* ── 3D Scene — all 8 layers ── */}
      <VistaraScene
        onOrbHover={setHoveredId}
        onOrbClick={handleOrbClick}
        hoveredId={hoveredId}
        activeId={activeId}
      />

      {/* ── Gateway orbs — float above the nebula ── */}
      {GATEWAYS.map(gw => (
        <GatewayOrb
          key={gw.id}
          gw={gw}
          isHovered={hoveredId === gw.id}
          isActive={activeId === gw.id}
          onEnter={() => setHoveredId(gw.id)}
          onLeave={() => setHoveredId(null)}
          onClick={() => handleOrbClick(gw.id)}
        />
      ))}

      {/* ── HTML UI overlay — sits above the Canvas ── */}

      {/* Gateway name tooltip */}
      <AnimatePresence>
        {hoveredGateway && !showPanel && (
          <motion.div
            key={hoveredGateway.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', bottom: '14%', left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none', zIndex: 30,
            }}
          >
            <div style={{
              fontFamily: 'var(--font-vyan)', fontSize: '13px',
              letterSpacing: '0.32em', color: hoveredGateway.color,
              textTransform: 'uppercase',
              textShadow: `0 0 24px ${hoveredGateway.color}`,
              marginBottom: '5px',
            }}>
              {hoveredGateway.name}
            </div>
            <div style={{
              fontFamily: 'var(--font-vyan)', fontSize: '9px',
              letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)',
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
          position: 'fixed', top: '22px', right: '24px',
          zIndex: 30, pointerEvents: 'none', textAlign: 'right',
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
          <span style={{ fontFamily: 'var(--font-vyan)', fontSize: 11, letterSpacing: '0.2em', opacity: 0.7 }}>
            ŚŪNYA MAṆḌALA
          </span>
        </motion.button>
      )}

      {/* Hover hint */}
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

      {/* Gateway detail panel */}
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

// ── Gateway glass panel ────────────────────────────────────────────────────────

function GatewayPanel({ gateway, onClose, onEnter }: {
  gateway: Gateway
  onClose: () => void
  onEnter: () => void
}) {
  const [closeHov, setCloseHov] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 20 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: '460px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${gateway.color}25`,
          borderRadius: '20px', backdropFilter: 'blur(24px)', padding: '34px',
          boxShadow: `0 0 60px ${gateway.color}12`,
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: '1px', background: `linear-gradient(90deg, transparent, ${gateway.color}55, transparent)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '9px', letterSpacing: '0.28em', color: `${gateway.color}80`, fontFamily: 'var(--font-vyan)', textTransform: 'uppercase', marginBottom: '7px' }}>
              {gateway.tantra}
            </div>
            <h2 style={{ fontFamily: 'var(--font-vyan)', fontSize: '24px', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', marginBottom: '6px', textShadow: `0 0 30px ${gateway.color}35` }}>
              {gateway.name}
            </h2>
            <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '10px', letterSpacing: '0.15em', color: `${gateway.color}70`, textTransform: 'uppercase' }}>
              {gateway.tagline}
            </p>
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
        <p style={{ fontFamily: 'var(--font-vyan)', fontSize: '14px', lineHeight: '1.75', color: 'rgba(255,255,255,0.58)', letterSpacing: '0.02em', marginBottom: '30px' }}>
          {gateway.description}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.45)', fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer' }}
          >
            Return
          </button>
          <button
            onClick={onEnter}
            style={{ padding: '12px 26px', background: `${gateway.color}15`, border: `1px solid ${gateway.color}38`, borderRadius: '10px', color: gateway.color, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer', boxShadow: `0 0 20px ${gateway.color}12` }}
          >
            Enter
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
