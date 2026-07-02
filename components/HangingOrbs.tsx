'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BackIcon, FacultyIcon, SettingsIcon, CloseIcon } from '@/components/icons/VyanIcons'

// ─── Faculty data ──────────────────────────────────────────────────────────────
export const FACULTIES = [
  { key: 'prajna',   name: 'Prājña',   desc: 'Supreme cosmic wisdom',    color: '#2d9e7f' },
  { key: 'dhyana',   name: 'Dhyāna',   desc: 'Deep meditative thought',  color: '#c4622d' },
  { key: 'akshaya',  name: 'Akṣaya',   desc: 'Inexhaustible knowledge',  color: '#00c4cc' },
  { key: 'java',     name: 'Javā',     desc: 'Swift neural response',    color: '#a855f7' },
  { key: 'sanchara', name: 'Sañcāra',  desc: 'Transmission & relay',     color: '#e8b94f' },
]

// ─── Ring geometry ─────────────────────────────────────────────────────────────
// 5 equally-spaced angles: top, upper-right, lower-right, lower-left, upper-left
const RING_ANGLES_DEG = [-90, -18, 54, 126, 198]

function clampVal(min: number, max: number, val: number) {
  return Math.max(min, Math.min(max, val))
}

function getFacultyPos(index: number, entityPos: { x: number; y: number }) {
  const rad = (RING_ANGLES_DEG[index] * Math.PI) / 180
  return {
    x: clampVal(6, 88, entityPos.x + 23 * Math.cos(rad)),
    y: clampVal(6, 82, entityPos.y + 20 * Math.sin(rad)),
  }
}

// ─── Drift profiles ─────────────────────────────────────────────────────────────
// Per-axis keyframes + timing. x and y run on different periods → Lissajous-like roam.
// Faculty and Settings drift very slowly across the top half of the frame,
// staying clear of the MEDHĀ title at top-center and Back icon at top-left.

// Nav buttons — 3 distinct depth layers
const NAV_DRIFT = [
  // Back pill — subtle micro-drift only (stays anchored top-left)
  {
    x: [0, 4, -3, 5, -2, 0] as number[], xDur: 18, xPause: 8,
    y: [0, -3, 2, -4, 1, 0] as number[], yDur: 14, yPause: 6,
  },
  // Faculty diamond — slow atmospheric roam across left-center of top half
  {
    x: [0, 90, -55, 80, -40, 60, 0] as number[], xDur: 58, xPause: 0,
    y: [0, 60, -30, 70, -40, 50, 0] as number[], yDur: 45, yPause: 0,
  },
  // Settings circle — slow atmospheric roam across right-center of top half
  {
    x: [0, -80, 55, -70, 40, -50, 0] as number[], xDur: 52, xPause: 0,
    y: [0, 65, -35, 75, -45, 55, 0] as number[], yDur: 41, yPause: 0,
  },
]

// Faculty ring orbs — 5 unique drift paths, each suggesting its own depth
const ORB_DRIFT = [
  { x: [0,  13, -5, 10,  0], xDur: 12, xPause: 5,  y: [0, -9,  2, -6,  0], yDur:  8, yPause: 3 },
  { x: [0, -11,  5, -8,  0], xDur: 14, xPause: 3,  y: [0, -7, -13, -4,  0], yDur: 10, yPause: 5 },
  { x: [0,  15, -8, 12,  0], xDur: 11, xPause: 6,  y: [0,  5,  -9,  4,  0], yDur:  7, yPause: 2 },
  { x: [0,  -8,  4, -6,  0], xDur: 16, xPause: 4,  y: [0, -12,  2, -9,  0], yDur: 11, yPause: 6 },
  { x: [0,  12, -6,  9,  0], xDur: 13, xPause: 2,  y: [0, -10,  1, -7,  0], yDur:  9, yPause: 4 },
]

// ─── Faculty close button ──────────────────────────────────────────────────────
function FacultyCloseButton({ onClose }: { onClose: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.button
      key="faculty-close"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClose}
      style={{
        position: 'fixed', top: 12, right: 12, zIndex: 83,
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px', borderRadius: '50%',
      }}
    >
      <CloseIcon size={22} isHovered={hovered} />
    </motion.button>
  )
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

  // Helper: per-axis drift transition config
  function driftTx(dur: number, pause: number) {
    return { duration: dur, repeat: Infinity, ease: 'easeInOut' as const, repeatDelay: pause }
  }

  return (
    <>
      {/* ── Three nav buttons — fade out when faculty ring opens ───────────── */}
      <motion.div
        animate={{ opacity: showFaculty ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        style={{ pointerEvents: showFaculty ? 'none' : 'auto' }}
      >
        {/* Back — transparent icon, anchored top-left */}
        <motion.div
          animate={{ x: NAV_DRIFT[0].x, y: NAV_DRIFT[0].y }}
          transition={{ x: driftTx(NAV_DRIFT[0].xDur, NAV_DRIFT[0].xPause), y: driftTx(NAV_DRIFT[0].yDur, NAV_DRIFT[0].yPause) }}
          style={{ position: 'fixed', left: 'clamp(14px, 3.5vw, 28px)', top: 'clamp(14px, 3.5vh, 26px)', zIndex: 70 }}
        >
          <button
            onClick={onBack}
            data-label="Śūnya"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', padding: '6px',
              cursor: 'pointer',
              filter: 'drop-shadow(0 0 8px rgba(157,89,255,0.5))',
              transition: 'filter 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'drop-shadow(0 0 18px rgba(157,89,255,0.9))')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(157,89,255,0.5))')}
          >
            <BackIcon size={24} />
          </button>
        </motion.div>

        {/* Faculty toggle — transparent icon, roams slowly across top-left zone */}
        <motion.div
          animate={{ x: NAV_DRIFT[1].x, y: NAV_DRIFT[1].y }}
          transition={{ x: driftTx(NAV_DRIFT[1].xDur, NAV_DRIFT[1].xPause), y: driftTx(NAV_DRIFT[1].yDur, NAV_DRIFT[1].yPause) }}
          style={{ position: 'fixed', left: '22%', top: '25%', zIndex: 70 }}
        >
          <button
            onClick={toggleFaculty}
            aria-label="Faculty selector"
            data-label="Faculty"
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', padding: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              filter: 'drop-shadow(0 0 8px rgba(157,89,255,0.5))',
              transition: 'filter 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'drop-shadow(0 0 18px rgba(157,89,255,0.9))')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(157,89,255,0.5))')}
          >
            <FacultyIcon size={24} />
          </button>
        </motion.div>

        {/* Settings — transparent icon, roams slowly across right-center of top half */}
        <motion.div
          animate={{ x: NAV_DRIFT[2].x, y: NAV_DRIFT[2].y }}
          transition={{ x: driftTx(NAV_DRIFT[2].xDur, NAV_DRIFT[2].xPause), y: driftTx(NAV_DRIFT[2].yDur, NAV_DRIFT[2].yPause) }}
          style={{ position: 'fixed', right: '20%', top: '28%', zIndex: 70 }}
        >
          <button
            onClick={onSettingsOpen}
            data-label="Settings"
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', padding: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              filter: 'drop-shadow(0 0 8px rgba(157,89,255,0.5))',
              transition: 'filter 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'drop-shadow(0 0 18px rgba(157,89,255,0.9))')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'drop-shadow(0 0 8px rgba(157,89,255,0.5))')}
          >
            <SettingsIcon size={24} />
          </button>
        </motion.div>
      </motion.div>

      {/* ── Faculty ring ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFaculty && (
          <>
            <motion.div
              key="faculty-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={closeFaculty}
              style={{
                position: 'fixed', inset: 0, zIndex: 79,
                background: 'rgba(0,0,0,0.28)',
                backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
              }}
            />
            <FacultyCloseButton onClose={closeFaculty} />

            {FACULTIES.map((f, i) => {
              const pos = getFacultyPos(i, entityPos)
              const isActive = activeFaculty === f.key
              const od = ORB_DRIFT[i]
              return (
                // Outer: position (margin-centered) + entrance/exit scale
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
                    marginLeft: '-41px',
                    marginTop: '-41px',
                    zIndex: 82,
                  }}
                >
                  {/* Inner: ongoing 2D roam — mismatched x/y periods for organic figure-8 drift */}
                  <motion.div
                    animate={{ x: od.x, y: od.y }}
                    transition={{
                      x: driftTx(od.xDur, od.xPause),
                      y: driftTx(od.yDur, od.yPause),
                    }}
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
