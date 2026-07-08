'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GATEWAYS, type Gateway } from '@/lib/vistara/gateways'
import { BackIcon, CloseIcon } from '@/components/icons/VyanIcons'
import { VistaraScene } from './scene/VistaraScene'

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
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

      {/* ── 3D Scene — all 8 layers ── */}
      <VistaraScene
        onOrbHover={setHoveredId}
        onOrbClick={handleOrbClick}
        hoveredId={hoveredId}
        activeId={activeId}
      />

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
