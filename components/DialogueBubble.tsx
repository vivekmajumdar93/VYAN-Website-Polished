'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface DialogueBubbleProps {
  message: string
  role: 'assistant' | 'user'
  facultyName: string
  facultyColor: string
  roamPos: { x: number; y: number }
  visible: boolean
}

export function DialogueBubble({
  message, role, facultyName, facultyColor,
  roamPos, visible,
}: DialogueBubbleProps) {
  const isMediah = role === 'assistant'

  const bubbleLeft = isMediah
    ? `${Math.min(roamPos.x + 18, 55)}%`
    : '50%'
  const bubbleTop = isMediah
    ? `${roamPos.y - 8}%`
    : '72%'
  const bubbleTransform = isMediah ? 'translateY(-50%)' : 'translateX(-50%)'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`${message.slice(0, 20)}-${roamPos.x}`}
          initial={{ opacity: 0, scale: 0.88, x: isMediah ? -12 : 0, y: isMediah ? 0 : 10 }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.88 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'fixed',
            left: bubbleLeft,
            top: bubbleTop,
            transform: bubbleTransform,
            zIndex: 35,
            maxWidth: isMediah ? 'min(38vw, 320px)' : 'min(55vw, 400px)',
            pointerEvents: 'none',
            transition: 'left 2.8s cubic-bezier(0.16,1,0.3,1), top 2.8s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <div style={{
            fontSize: '8px', letterSpacing: '0.25em',
            color: isMediah ? `${facultyColor}90` : 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
            marginBottom: '5px',
            paddingLeft: isMediah ? '14px' : '0',
            textAlign: isMediah ? 'left' : 'center',
          }}>
            {isMediah ? `MEDHĀ · ${facultyName}` : 'YOU'}
          </div>

          <div style={{
            position: 'relative',
            padding: '12px 15px',
            background: isMediah
              ? 'rgba(255,218,185,0.10)'
              : 'rgba(255,255,255,0.05)',
            border: isMediah
              ? '1px solid rgba(255,200,160,0.20)'
              : '1px solid rgba(255,255,255,0.08)',
            borderRadius: isMediah ? '4px 14px 14px 14px' : '14px 14px 14px 4px',
            backdropFilter: 'blur(8px)',
          }}>
            {isMediah && (
              <div style={{
                position: 'absolute',
                left: '-7px', top: '14px',
                width: 0, height: 0,
                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderRight: '7px solid rgba(255,200,160,0.20)',
              }} />
            )}

            <p style={{
              fontFamily: 'var(--font-vyan)',
              fontSize: isMediah ? '13px' : '12px',
              lineHeight: '1.65',
              color: isMediah ? 'rgba(255,225,195,0.88)' : 'rgba(255,255,255,0.72)',
              letterSpacing: '0.02em',
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}>
              {message}
            </p>

            {isMediah && (
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: 'inherit',
                background: `radial-gradient(ellipse at 20% 50%, ${facultyColor}08, transparent 70%)`,
                pointerEvents: 'none',
              }} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
