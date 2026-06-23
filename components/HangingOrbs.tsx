'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Faculty data ──────────────────────────────────────────────────────────────
export const FACULTIES = [
  { key: 'prajna',   name: 'Prājña',   desc: 'Supreme cosmic wisdom',    color: '#2d9e7f' },
  { key: 'dhyana',   name: 'Dhyāna',   desc: 'Deep meditative thought',  color: '#c4622d' },
  { key: 'akshaya',  name: 'Akṣaya',   desc: 'Inexhaustible knowledge',  color: '#00c4cc' },
  { key: 'java',     name: 'Javā',     desc: 'Swift neural response',    color: '#a855f7' },
  { key: 'sanchara', name: 'Sañcāra',  desc: 'Transmission & relay',     color: '#e8b94f' },
]

// 5 equally-spaced angles around entity: top, upper-right, lower-right, lower-left, upper-left
const RING_ANGLES_DEG = [-90, -18, 54, 126, 198]

function clampVal(min: number, max: number, val: number) {
  return Math.max(min, Math.min(max, val))
}

function getFacultyPos(index: number, entityPos: { x: number; y: number }) {
  const rad = (RING_ANGLES_DEG[index] * Math.PI) / 180
  const rx = 23   // % of viewport width
  const ry = 20   // % of viewport height
  return {
    x: clampVal(6, 88, entityPos.x + rx * Math.cos(rad)),
    y: clampVal(6, 82, entityPos.y + ry * Math.sin(rad)),
  }
}

// ─── Main component ────────────────────────────────────────────────────────────
interface HangingOrbsProps {
  onSettingsOpen: () => void
  onFacultySelect: (key: string, color: string) => void
  onBack: () => void
  activeFaculty: string
  entityPos?: { x: number; y: number }
  onFacultyOpenChange?: (open: boolean) => void
}

export function HangingOrbs({
  onSettingsOpen, onFacultySelect, onBack, activeFaculty,
  entityPos = { x: 50, y: 42 },
  onFacultyOpenChange,
}: HangingOrbsProps) {
  const [showFaculty, setShowFaculty] = useState(false)

  const toggleFaculty = useCallback(() => {
    setShowFaculty(v => {
      const next = !v
      onFacultyOpenChange?.(next)
      return next
    })
  }, [onFacultyOpenChange])

  const handleFacultySelect = useCallback((key: string, color: string) => {
    setShowFaculty(false)
    onFacultyOpenChange?.(false)
    onFacultySelect(key, color)
  }, [onFacultySelect, onFacultyOpenChange])

  const closeFaculty = useCallback(() => {
    setShowFaculty(false)
    onFacultyOpenChange?.(false)
  }, [onFacultyOpenChange])

  return (
    <>
      {/* ── Three nav buttons — fade out when faculty ring opens ───────────── */}
      {/* Outer wrapper handles shared opacity + pointer-events */}
      <motion.div
        animate={{ opacity: showFaculty ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: showFaculty ? 'none' : 'auto' }}
      >
        {/* Back — pill / elongated capsule, gold */}
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 4.6, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
          style={{ position: 'fixed', left: 'clamp(14px, 3.5vw, 28px)', top: 'clamp(14px, 3.5vh, 26px)', zIndex: 70 }}
        >
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'linear-gradient(135deg, rgba(232,175,52,0.18) 0%, rgba(200,130,28,0.10) 100%)',
              border: '1px solid rgba(232,175,52,0.42)',
              borderRadius: '100px',
              padding: '9px 20px 9px 14px',
              color: '#e8b036',
              fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase',
              fontFamily: 'system-ui', cursor: 'pointer',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 0 22px rgba(232,175,52,0.16), inset 0 0 14px rgba(232,175,52,0.06)',
              whiteSpace: 'nowrap',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
            </svg>
            Śūnya
          </button>
        </motion.div>

        {/* Faculty toggle — diamond / rhombus, amber-gold */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5.3, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
          style={{
            position: 'fixed', left: '50%', top: 'clamp(10px, 2.5vh, 20px)',
            transform: 'translateX(-50%)', zIndex: 70,
          }}
        >
          <button
            onClick={toggleFaculty}
            aria-label="Faculty selector"
            style={{
              width: '58px', height: '58px',
              background: 'transparent', border: 'none',
              cursor: 'pointer', padding: 0, position: 'relative',
            }}
          >
            {/* Diamond shape — rotated square */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(220,148,38,0.22) 0%, rgba(172,104,14,0.12) 100%)',
              border: '1px solid rgba(220,148,38,0.48)',
              transform: 'rotate(45deg) scale(0.78)',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 0 30px rgba(220,148,38,0.22), inset 0 0 18px rgba(220,148,38,0.08)',
              borderRadius: '5px',
            }}/>
            {/* Icon — centered, counter-rotated */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '19px', color: '#dc9424',
              textShadow: '0 0 14px rgba(220,148,38,0.70)',
            }}>
              ✦
            </div>
          </button>
        </motion.div>

        {/* Settings — circle, warm copper-gold */}
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3.9, repeat: Infinity, ease: 'easeInOut', delay: 2.3 }}
          style={{ position: 'fixed', right: 'clamp(14px, 3.5vw, 28px)', top: 'clamp(18px, 4.5vh, 34px)', zIndex: 70 }}
        >
          <button
            onClick={onSettingsOpen}
            style={{
              width: '46px', height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(200,118,26,0.24) 0%, rgba(154,82,8,0.13) 100%)',
              border: '1px solid rgba(200,118,26,0.44)',
              color: '#c87818',
              fontSize: '20px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 0 20px rgba(200,118,26,0.20), inset 0 0 13px rgba(200,118,26,0.07)',
            }}
          >
            ⚙
          </button>
        </motion.div>
      </motion.div>

      {/* ── Faculty ring ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFaculty && (
          <>
            {/* Backdrop — click to close */}
            <motion.div
              key="faculty-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={closeFaculty}
              style={{
                position: 'fixed', inset: 0, zIndex: 79,
                background: 'rgba(0,0,0,0.30)',
                backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
              }}
            />

            {/* Faculty buttons — staggered one-by-one around entity */}
            {FACULTIES.map((f, i) => {
              const pos = getFacultyPos(i, entityPos)
              const isActive = activeFaculty === f.key
              return (
                <motion.div
                  key={f.key}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0, scale: 0,
                    transition: { duration: 0.22, delay: (FACULTIES.length - 1 - i) * 0.06, ease: 'easeIn' },
                  }}
                  transition={{ duration: 0.48, delay: i * 0.13, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'fixed',
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 82,
                  }}
                >
                  {/* Inner float animation */}
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3.4 + i * 0.65, repeat: Infinity, ease: 'easeInOut', delay: i * 0.45 }}
                  >
                    <button
                      onClick={() => handleFacultySelect(f.key, f.color)}
                      style={{
                        width: '82px', height: '82px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 35% 32%, ${f.color}32 0%, ${f.color}0e 100%)`,
                        border: `1px solid ${f.color}${isActive ? 'aa' : '55'}`,
                        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                        cursor: 'pointer',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: '5px', padding: 0,
                        boxShadow: isActive
                          ? `0 0 32px ${f.color}45, 0 0 60px ${f.color}18, inset 0 0 24px ${f.color}14`
                          : `0 0 22px ${f.color}22, inset 0 0 18px ${f.color}0a`,
                        outline: isActive ? `2px solid ${f.color}70` : 'none',
                        outlineOffset: '4px',
                        transition: 'box-shadow 0.3s, outline 0.3s',
                      }}
                    >
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: f.color,
                        boxShadow: `0 0 9px ${f.color}, 0 0 18px ${f.color}80`,
                      }}/>
                      <div style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: '11px', letterSpacing: '0.09em',
                        color: f.color, textAlign: 'center',
                        textShadow: `0 0 10px ${f.color}90`,
                      }}>
                        {f.name}
                      </div>
                      <div style={{
                        fontFamily: 'system-ui', fontSize: '7.5px',
                        color: 'rgba(255,255,255,0.38)',
                        textAlign: 'center', padding: '0 7px',
                        lineHeight: 1.35, letterSpacing: '0.04em',
                      }}>
                        {f.desc}
                      </div>
                    </button>
                  </motion.div>
                </motion.div>
              )
            })}
          </>
        )}
      </AnimatePresence>
    </>
  )
}
