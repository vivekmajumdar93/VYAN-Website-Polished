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

// ─── Pendant positions — invisible hotspots over video orbs ───────────────────
const HANGINGS = [
  { id: 'back',     top: 18, right: 26, size: 16, title: 'Śūnya' },
  { id: 'faculty',  top: 38, right: 28, size: 14, title: 'Faculty' },
  { id: 'settings', top: 52, right: 18, size: 12, title: 'Settings' },
]

// CSS animation strings — swing + glow pulse, staggered per pendant
const PENDANT_ANIMATIONS = [
  'pendantSwing 4s ease-in-out 0s infinite, pendantPulse 3s ease-in-out 0s infinite',
  'pendantSwing 5s ease-in-out 0.8s infinite, pendantPulse 3s ease-in-out 1s infinite',
  'pendantSwing 4.5s ease-in-out 1.6s infinite, pendantPulse 3s ease-in-out 2s infinite',
]

// Offsets (in viewport %) from entity centre — places buttons in a ring around Medhā
const FACULTY_OFFSETS = [
  { dx: -18, dy: -22 },  // upper-left
  { dx:  16, dy: -20 },  // upper-right
  { dx:  26, dy:   2 },  // right
  { dx:  14, dy:  20 },  // lower-right
  { dx: -16, dy:  20 },  // lower-left
]

// ─── Faculty floater button ────────────────────────────────────────────────────
interface FacultyButtonProps {
  faculty: typeof FACULTIES[0]
  index: number
  posX: number  // viewport % left
  posY: number  // viewport % top
  onSelect: (key: string, color: string) => void
}

function FacultyButton({ faculty, index, posX, posY, onSelect }: FacultyButtonProps) {
  const floatDX = (Math.random() - 0.5) * 6
  const floatDY = (Math.random() - 0.5) * 4
  const duration = 8 + Math.random() * 6

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0, x: '-50%', y: '-50%' }}
      animate={{
        opacity: 1, scale: 1,
        x: ['-50%', `calc(-50% + ${floatDX}px)`, '-50%'],
        y: ['-50%', `calc(-50% + ${floatDY}px)`, '-50%'],
      }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{
        opacity: { duration: 0.4, delay: index * 0.35 },
        scale: { duration: 0.4, delay: index * 0.35, ease: [0.16, 1, 0.3, 1] },
        x: { duration, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 },
        y: { duration: duration * 0.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 },
      }}
      onClick={() => onSelect(faculty.key, faculty.color)}
      style={{
        position: 'fixed',
        left: `${Math.max(2, Math.min(90, posX))}%`,
        top: `${Math.max(5, Math.min(88, posY))}%`,
        width: '88px', height: '88px',
        borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${faculty.color}28, ${faculty.color}10)`,
        border: `1px solid ${faculty.color}50`,
        backdropFilter: 'blur(12px)',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '4px', zIndex: 80,
        boxShadow: `0 0 24px ${faculty.color}25, inset 0 0 20px ${faculty.color}10`,
      }}
    >
      {/* Color dot */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: faculty.color,
        backgroundColor: faculty.color,
        boxShadow: `0 0 8px ${faculty.color}`,
        marginBottom: '2px',
      }} />
      {/* Faculty name */}
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: '11px',
        letterSpacing: '0.1em', color: faculty.color,
        textTransform: 'uppercase',
        background: 'none',
        backgroundColor: 'transparent',
      }}>
        {faculty.name}
      </div>
      {/* Faculty description */}
      <div style={{
        fontFamily: 'system-ui', fontSize: '8px',
        letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)',
        textAlign: 'center', padding: '0 6px',
        lineHeight: 1.3,
        background: 'none',
        backgroundColor: 'transparent',
      }}>
        {faculty.desc}
      </div>
    </motion.button>
  )
}

// ─── Main hanging orbs component ──────────────────────────────────────────────
interface HangingOrbsProps {
  onSettingsOpen: () => void
  onFacultySelect: (key: string, color: string) => void
  onBack: () => void
  activeFaculty: string
  entityPos?: { x: number; y: number }  // entity centre in viewport %
}

export function HangingOrbs({
  onSettingsOpen, onFacultySelect, onBack, activeFaculty, entityPos,
}: HangingOrbsProps) {
  const [showFaculty, setShowFaculty] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const handleHangingTap = useCallback((id: string) => {
    if (id === 'settings') onSettingsOpen()
    if (id === 'faculty') setShowFaculty(v => !v)
    if (id === 'back') onBack()
  }, [onSettingsOpen, onBack])

  const handleFacultySelect = useCallback((key: string, color: string) => {
    setShowFaculty(false)
    onFacultySelect(key, color)
  }, [onFacultySelect])

  return (
    <>
      <style>{`
        @keyframes pendantPulse {
          0%   { box-shadow: 0 0 0px rgba(255,200,80,0); }
          50%  { box-shadow: 0 0 22px rgba(255,200,80,0.55), 0 0 40px rgba(255,160,40,0.25); }
          100% { box-shadow: 0 0 0px rgba(255,200,80,0); }
        }
        @keyframes pendantSwing {
          0%   { transform: rotate(-2deg); }
          50%  { transform: rotate(2deg); }
          100% { transform: rotate(-2deg); }
        }
      `}</style>

      {/* Pendant hotspot divs — position:fixed so they anchor to viewport, not a container */}
      {HANGINGS.map((h, i) => (
        <div
          key={h.id}
          style={{
            position: 'fixed',
            right: `${h.right}%`,
            top: `${h.top}%`,
            zIndex: 15,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transformOrigin: 'top center',
            animation: PENDANT_ANIMATIONS[i],
            cursor: 'pointer',
            background: 'none',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
          onClick={() => handleHangingTap(h.id)}
        >
          {/* Invisible orb hitzone */}
          <div style={{
            width: `${h.size * 3}px`,
            height: `${h.size * 3}px`,
            borderRadius: '50%',
            background: 'none',
            backgroundColor: 'transparent',
            border: 'none',
            boxShadow: hoveredIdx === i ? '0 0 18px rgba(255,200,80,0.35)' : undefined,
            position: 'relative',
            transition: 'box-shadow 0.2s',
          }}>
            {/* Hover label */}
            <div style={{
              position: 'absolute',
              bottom: '-18px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '8px',
              letterSpacing: '0.2em',
              color: 'rgba(255,200,80,0.7)',
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui',
              textTransform: 'uppercase',
              pointerEvents: 'none',
              opacity: hoveredIdx === i ? 1 : 0,
              transition: 'opacity 0.2s',
              background: 'none',
              backgroundColor: 'transparent',
            }}>
              {h.title}
            </div>
          </div>
        </div>
      ))}

      {/* Faculty floaters */}
      <AnimatePresence>
        {showFaculty && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFaculty(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'none', backgroundColor: 'transparent' }}
            />
            {FACULTIES.map((f, i) => {
              const ex = entityPos?.x ?? 25
              const ey = entityPos?.y ?? 38
              const off = FACULTY_OFFSETS[i] ?? { dx: 0, dy: 0 }
              return (
                <FacultyButton
                  key={f.key}
                  faculty={f}
                  index={i}
                  posX={ex + off.dx}
                  posY={ey + off.dy}
                  onSelect={handleFacultySelect}
                />
              )
            })}
          </>
        )}
      </AnimatePresence>
    </>
  )
}
