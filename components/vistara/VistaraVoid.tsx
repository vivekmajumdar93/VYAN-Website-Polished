'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GATEWAYS, type Gateway, assetPath } from '@/lib/vistara/gateways'
import { BackIcon } from '@/components/icons/VyanIcons'
import { VistaraScene } from './scene/VistaraScene'

const AUTO_MS = 7000

// ── Main export ────────────────────────────────────────────────────────────────

export function VistaraVoid({ onBack, onGatewayEnter }: {
  onBack?: () => void
  onGatewayEnter?: (gateway: Gateway) => void
}) {
  const [index, setIndex] = useState(0)
  const gw = GATEWAYS[index]

  // Auto-advance — resets whenever index changes (manual or auto)
  useEffect(() => {
    const t = setTimeout(() => setIndex(i => (i + 1) % GATEWAYS.length), AUTO_MS)
    return () => clearTimeout(t)
  }, [index])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setIndex(i => (i - 1 + GATEWAYS.length) % GATEWAYS.length)
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % GATEWAYS.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Touch / swipe
  const touchX = useRef(0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 2 }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40)
          setIndex(i => dx < 0
            ? (i + 1) % GATEWAYS.length
            : (i - 1 + GATEWAYS.length) % GATEWAYS.length)
      }}
    >
      {/* ── Animated nebula void ── */}
      <VistaraScene onOrbHover={() => {}} onOrbClick={() => {}} hoveredId={null} activeId={null} />

      {/* ── Gallery ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 5,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0,
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={gw.id}
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.75, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {/* Coloured atmospheric halo behind the image */}
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                position: 'absolute',
                width: '160%',
                height: '160%',
                background: `radial-gradient(ellipse at 50% 50%, ${gw.color}28 0%, transparent 62%)`,
                pointerEvents: 'none',
              }} />

              {/* Product art — dissolves into the void at all edges */}
              <img
                src={assetPath(gw.filename)}
                alt={gw.name}
                draggable={false}
                style={{
                  display: 'block',
                  width:  'clamp(180px, 52vw, 290px)',
                  height: 'clamp(240px, 69vw, 387px)',
                  objectFit: 'cover',
                  objectPosition: 'center',
                  userSelect: 'none',
                  maskImage:
                    'radial-gradient(ellipse 52% 58% at 50% 50%, ' +
                    'black 20%, rgba(0,0,0,.85) 42%, rgba(0,0,0,.45) 60%, transparent 76%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 52% 58% at 50% 50%, ' +
                    'black 20%, rgba(0,0,0,.85) 42%, rgba(0,0,0,.45) 60%, transparent 76%)',
                }}
              />
            </div>

            {/* Name */}
            <h1 style={{
              fontFamily: 'var(--font-vyan)',
              fontSize: 'clamp(26px, 5.5vw, 46px)',
              letterSpacing: '0.22em',
              color: 'rgba(255,255,255,0.92)',
              textTransform: 'uppercase',
              textShadow: `0 0 40px ${gw.color}55`,
              margin: '26px 0 0',
              textAlign: 'center',
            }}>
              {gw.name}
            </h1>

            {/* Tantra line */}
            <p style={{
              fontFamily: 'var(--font-vyan)',
              fontSize: 'clamp(8px, 1.5vw, 11px)',
              letterSpacing: '0.32em',
              color: `${gw.color}90`,
              textTransform: 'uppercase',
              margin: '9px 0 0',
              textAlign: 'center',
            }}>
              {gw.tantra}
            </p>

            {/* Tagline */}
            <p style={{
              fontFamily: 'var(--font-vyan)',
              fontSize: 'clamp(8px, 1.2vw, 10px)',
              letterSpacing: '0.18em',
              color: 'rgba(255,255,255,0.30)',
              textTransform: 'uppercase',
              margin: '5px 0 0',
              textAlign: 'center',
            }}>
              {gw.tagline}
            </p>

            {/* Enter CTA */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onGatewayEnter?.(gw)}
              style={{
                marginTop: '22px',
                padding: '9px 30px',
                background: `${gw.color}12`,
                border: `1px solid ${gw.color}45`,
                borderRadius: '100px',
                color: gw.color,
                fontFamily: 'var(--font-vyan)',
                fontSize: '9px',
                letterSpacing: '0.30em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'border-color 0.3s',
              }}
            >
              Enter
            </motion.button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Navigation dots ── */}
      <div style={{
        position: 'fixed', bottom: '6%', left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex', gap: '9px', alignItems: 'center',
        zIndex: 40,
      }}>
        {GATEWAYS.map((g, i) => (
          <button
            key={g.id}
            onClick={() => setIndex(i)}
            style={{
              width:  i === index ? '22px' : '6px',
              height: '5px',
              borderRadius: '100px',
              background: i === index ? gw.color : 'rgba(255,255,255,0.18)',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.4s ease',
              boxShadow: i === index ? `0 0 10px ${gw.color}80` : 'none',
            }}
          />
        ))}
      </div>

      {/* ── Arrow navigation ── */}
      {(['left', 'right'] as const).map(side => (
        <button
          key={side}
          onClick={() => setIndex(i =>
            side === 'left'
              ? (i - 1 + GATEWAYS.length) % GATEWAYS.length
              : (i + 1) % GATEWAYS.length
          )}
          style={{
            position: 'fixed',
            [side]: 'clamp(8px, 3%, 28px)',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: '50%',
            width: '38px', height: '38px',
            color: 'rgba(255,255,255,0.28)',
            fontSize: '20px',
            lineHeight: '38px',
            textAlign: 'center',
            cursor: 'pointer',
            zIndex: 40,
            padding: 0,
            transition: 'border-color 0.3s, color 0.3s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = `${gw.color}60`
            ;(e.currentTarget as HTMLButtonElement).style.color = gw.color
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.28)'
          }}
        >
          {side === 'left' ? '‹' : '›'}
        </button>
      ))}

      {/* ── Wordmark ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        style={{
          position: 'fixed', top: '22px', right: '24px',
          zIndex: 40, pointerEvents: 'none', textAlign: 'right',
        }}
      >
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '11px', letterSpacing: '0.40em', color: 'rgba(212,180,80,0.55)', textTransform: 'uppercase' }}>
          Vistāra
        </div>
        <div style={{ fontFamily: 'var(--font-vyan)', fontSize: '8px', letterSpacing: '0.22em', color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', marginTop: '3px' }}>
          The Manifestations
        </div>
      </motion.div>

      {/* ── Back ── */}
      {onBack && (
        <motion.button
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          onClick={onBack}
          style={{
            position: 'fixed', top: '22px', left: '22px', zIndex: 40,
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
    </div>
  )
}
