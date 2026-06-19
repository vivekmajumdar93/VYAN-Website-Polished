'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FloatingTextProps {
  text: string
  role: 'assistant' | 'user'
  facultyColor: string
  roamPos: { x: number; y: number }
  visible: boolean
  userColor?: string
}

const FACULTY_GRADIENTS: Record<string, string> = {
  '#2d9e7f': 'linear-gradient(135deg, #2d9e7f, #4ecdc4)',
  '#c4622d': 'linear-gradient(135deg, #c4622d, #ff8c42)',
  '#00c4cc': 'linear-gradient(135deg, #00c4cc, #7bfcff)',
  '#a855f7': 'linear-gradient(135deg, #a855f7, #d8b4fe)',
  '#e8b94f': 'linear-gradient(135deg, #e8b94f, #fde68a)',
}

export function FloatingText({
  text, role, facultyColor, roamPos, visible, userColor = '#d4a853',
}: FloatingTextProps) {
  const isAssistant = role === 'assistant'
  const gradient = FACULTY_GRADIENTS[facultyColor] ?? `linear-gradient(135deg, ${facultyColor}, #ffffff)`

  // Assistant: floats to the right of Medhā's entity position
  // User: fixed anchor above the composer input box (bottom-left)
  const style: React.CSSProperties = isAssistant
    ? {
        position: 'fixed',
        left: `${Math.min(roamPos.x + 16, 58)}%`,
        top: `${roamPos.y - 12}%`,
        maxWidth: 'min(38vw, 340px)',
        zIndex: 35,
        pointerEvents: 'none',
        transition: 'left 2.8s cubic-bezier(0.16,1,0.3,1), top 2.8s cubic-bezier(0.16,1,0.3,1)',
      }
    : {
        position: 'fixed',
        left: '14px',
        bottom: '148px',   // sits just above the composer bar
        maxWidth: 'min(44vw, 400px)',
        zIndex: 35,
        pointerEvents: 'none',
      }

  return (
    <AnimatePresence>
      {visible && text && (
        <motion.div
          key={text.slice(0, 30)}
          initial={{ opacity: 0, y: isAssistant ? 12 : -8, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: isAssistant ? -8 : 8, filter: 'blur(6px)' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={style}
        >
          {isAssistant ? (
            <p style={{
              fontFamily: "'Cinzel Decorative', 'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(13px, 1.4vw, 17px)',
              fontWeight: 300,
              lineHeight: 1.75,
              letterSpacing: '0.04em',
              margin: 0,
              background: gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              filter: `drop-shadow(0 0 12px ${facultyColor}60)`,
            }}>
              {text}
            </p>
          ) : (
            <p style={{
              fontFamily: 'system-ui, sans-serif',
              fontSize: 'clamp(12px, 1.2vw, 15px)',
              fontWeight: 400,
              lineHeight: 1.65,
              letterSpacing: '0.03em',
              margin: 0,
              color: userColor,
              filter: `drop-shadow(0 0 8px ${userColor}80)`,
            }}>
              {text}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
