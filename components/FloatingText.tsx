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

  // Outer wrapper position — assistant floats beside Medhā, user anchors above composer
  const outerStyle: React.CSSProperties = isAssistant
    ? {
        position: 'fixed',
        left: `${Math.min(roamPos.x + 15, 56)}%`,
        top: `${Math.max(roamPos.y - 14, 8)}%`,
        width: 'min(34vw, 320px)',
        zIndex: 35,
        pointerEvents: 'none',
        transition: 'left 2.8s cubic-bezier(0.16,1,0.3,1), top 2.8s cubic-bezier(0.16,1,0.3,1)',
      }
    : {
        position: 'fixed',
        left: '14px',
        bottom: '152px',
        width: 'min(44vw, 400px)',
        zIndex: 35,
        pointerEvents: 'none',
      }

  return (
    <AnimatePresence>
      {visible && text && (
        <motion.div
          key={text.slice(0, 30)}
          initial={{ opacity: 0, y: isAssistant ? 10 : -6, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: isAssistant ? -6 : 6, filter: 'blur(4px)' }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          style={outerStyle}
        >
          {/* Scrollable glass container — caps height so long texts never fill the screen */}
          <div style={{
            maxHeight: isAssistant ? '30vh' : '18vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            pointerEvents: 'auto',  // allow scroll interaction
            // Subtle glass backdrop — makes text legible over any background
            background: isAssistant
              ? 'rgba(4,2,14,0.42)'
              : 'rgba(4,2,14,0.36)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderRadius: '14px',
            border: `1px solid ${isAssistant ? facultyColor + '22' : userColor + '28'}`,
            padding: '12px 14px',
            // Fade bottom edge to hint at more content below
            WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
          }}>
            {isAssistant ? (
              <p style={{
                fontFamily: "'Cinzel Decorative', 'Cormorant Garamond', Georgia, serif",
                fontSize: 'clamp(12px, 1.3vw, 16px)',
                fontWeight: 300,
                lineHeight: 1.78,
                letterSpacing: '0.03em',
                margin: 0,
                background: gradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: `drop-shadow(0 0 10px ${facultyColor}50)`,
              }}>
                {text}
              </p>
            ) : (
              <p style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: 'clamp(11px, 1.1vw, 14px)',
                fontWeight: 400,
                lineHeight: 1.65,
                letterSpacing: '0.025em',
                margin: 0,
                color: userColor,
                filter: `drop-shadow(0 0 6px ${userColor}70)`,
              }}>
                {text}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
