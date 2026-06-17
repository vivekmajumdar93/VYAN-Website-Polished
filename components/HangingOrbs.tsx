'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Faculty data ──────────────────────────────────────────────────────────────
export const FACULTIES = [
  { key: 'prajna',   name: 'Prājña',   desc: 'Supreme cosmic wisdom',    color: '#2d9e7f' },
  { key: 'dhyana',   name: 'Dhyāna',   desc: 'Deep meditative thought',  color: '#c4622d' },
  { key: 'akshaya',  name: 'Akṣaya',   desc: 'Inexhaustible knowledge',  color: '#00c4cc' },
  { key: 'java',     name: 'Javā',     desc: 'Swift neural response',    color: '#a855f7' },
  { key: 'sanchara', name: 'Sañcāra',  desc: 'Transmission & relay',     color: '#e8b94f' },
]

// ─── Hanging orb positions ─────────────────────────────────────────────────────
const HANGINGS = [
  { id: 'settings', top: 28, right: 14, size: 18, label: '⚙', swingAmp: 3,  swingSpeed: 0.0018 },
  { id: 'faculty',  top: 42, right: 8,  size: 14, label: '◈', swingAmp: 5,  swingSpeed: 0.0024 },
  { id: 'back',     top: 58, right: 18, size: 11, label: '↩', swingAmp: 4,  swingSpeed: 0.0020 },
]

// ─── Faculty floater button ────────────────────────────────────────────────────
interface FacultyButtonProps {
  faculty: typeof FACULTIES[0]
  index: number
  onSelect: (key: string, color: string) => void
}

function FacultyButton({ faculty, index, onSelect }: FacultyButtonProps) {
  const startX = 15 + Math.random() * 60
  const startY = 20 + Math.random() * 55
  const floatDX = (Math.random() - 0.5) * 12
  const floatDY = (Math.random() - 0.5) * 8
  const duration = 4 + Math.random() * 3

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
        opacity: { duration: 0.4, delay: index * 0.08 },
        scale: { duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] },
        x: { duration, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 },
        y: { duration: duration * 0.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.2 },
      }}
      onClick={() => onSelect(faculty.key, faculty.color)}
      style={{
        position: 'fixed',
        left: `${startX}%`,
        top: `${startY}%`,
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
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: faculty.color,
        boxShadow: `0 0 8px ${faculty.color}`,
        marginBottom: '2px',
      }} />
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: '11px',
        letterSpacing: '0.1em', color: faculty.color,
        textTransform: 'uppercase',
      }}>
        {faculty.name}
      </div>
      <div style={{
        fontFamily: 'system-ui', fontSize: '8px',
        letterSpacing: '0.08em', color: 'rgba(255,255,255,0.4)',
        textAlign: 'center', padding: '0 6px',
        lineHeight: 1.3,
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
}

export function HangingOrbs({
  onSettingsOpen, onFacultySelect, onBack, activeFaculty,
}: HangingOrbsProps) {
  const [swingAngles, setSwingAngles] = useState(HANGINGS.map(() => 0))
  const [showFaculty, setShowFaculty] = useState(false)
  const [swingin, setSwingin] = useState<number | null>(null)
  const tRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const animate = () => {
      tRef.current++
      setSwingAngles(prev => prev.map((angle, i) => {
        const h = HANGINGS[i]
        const ambient = Math.sin(tRef.current * h.swingSpeed + i * 1.2) * h.swingAmp
        if (swingin === i) {
          const decay = Math.sin(tRef.current * 0.08) * 12 * Math.exp(-tRef.current * 0.002)
          return ambient + decay
        }
        return ambient
      }))
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [swingin])

  const handleHangingTap = useCallback((id: string, idx: number) => {
    setSwingin(idx)
    setTimeout(() => setSwingin(null), 2000)

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
            transform: `rotate(${swingAngles[i]}deg)`,
            cursor: 'pointer',
          }}
          onClick={() => handleHangingTap(h.id, i)}
        >
          <div style={{
            width: '1px',
            height: `${h.size * 2.5}px`,
            background: `linear-gradient(to bottom, rgba(212,180,80,0.6), rgba(212,180,80,0.2))`,
          }} />
          <div style={{
            width: `${h.size}px`,
            height: `${h.size}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, rgba(255,220,120,0.9), rgba(180,120,40,0.6))',
            border: '1px solid rgba(255,210,80,0.5)',
            boxShadow: `0 0 ${h.size}px rgba(255,180,60,0.4), 0 0 ${h.size * 2}px rgba(255,160,40,0.15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: `${h.size * 0.45}px`,
            color: 'rgba(255,240,180,0.9)',
            transition: 'box-shadow 0.2s',
          }}>
            {h.label}
          </div>
        </div>
      ))}

      <AnimatePresence>
        {showFaculty && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFaculty(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 79 }}
            />
            {FACULTIES.map((f, i) => (
              <FacultyButton key={f.key} faculty={f} index={i} onSelect={handleFacultySelect} />
            ))}
          </>
        )}
      </AnimatePresence>
    </>
  )
}
