'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface FloatingTextProps {
  text: string
  role: 'assistant' | 'user'
  facultyColor: string
  visible: boolean
  userColor?: string
}

// Renders inline Markdown: **bold**, *italic*, _italic_, bullet lines (*/-), strips pipes/tables
function renderMarkdown(raw: string, color: string): React.ReactNode[] {
  const lines = raw.split('\n')
  const output: React.ReactNode[] = []

  lines.forEach((line, li) => {
    if (/^\|[\s\-|]+\|$/.test(line.trim())) return

    let stripped = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').trim()
    stripped = stripped.replace(/\s*\|\s*/g, ' — ')

    const headingMatch = stripped.match(/^#{1,6}\s+(.+)$/)
    const cleanLine = headingMatch ? headingMatch[1] : stripped

    const bulletMatch = cleanLine.match(/^[\*\-•]\s+(.+)$/)
    const content = bulletMatch ? bulletMatch[1] : cleanLine
    const prefix = bulletMatch ? '• ' : ''

    const inlineNodes: React.ReactNode[] = []
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g
    let cursor = 0
    let m: RegExpExecArray | null
    let ki = 0
    while ((m = regex.exec(content)) !== null) {
      if (m.index > cursor) inlineNodes.push(content.slice(cursor, m.index))
      if (m[2]) {
        inlineNodes.push(
          <strong key={`${li}-b-${ki}`} style={{ fontWeight: 700, color }}>
            {m[2]}
          </strong>
        )
      } else {
        const inner = m[3] ?? m[4]
        inlineNodes.push(
          <em key={`${li}-i-${ki}`} style={{ fontStyle: 'italic' }}>
            {inner}
          </em>
        )
      }
      cursor = m.index + m[0].length
      ki++
    }
    if (cursor < content.length) inlineNodes.push(content.slice(cursor))

    output.push(
      <React.Fragment key={li}>
        {prefix && <span>{prefix}</span>}
        {inlineNodes}
        {li < lines.length - 1 && <br />}
      </React.Fragment>
    )
  })

  return output
}

export function FloatingText({
  text, role, facultyColor, visible, userColor = '#d4a853',
}: FloatingTextProps) {
  const isAssistant = role === 'assistant'

  const outerStyle: React.CSSProperties = isAssistant
    ? {
        position: 'fixed',
        left: '52%',
        top: '35%',
        width: 'min(34vw, 320px)',
        zIndex: 35,
        pointerEvents: 'none',
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
          <div style={{
            maxHeight: isAssistant ? '30vh' : '18vh',
            overflowY: 'auto',
            scrollbarWidth: 'none',
            pointerEvents: 'auto',
            background: isAssistant ? 'rgba(4,2,14,0.42)' : 'rgba(4,2,14,0.36)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderRadius: '14px',
            border: `1px solid ${isAssistant ? facultyColor + '22' : userColor + '28'}`,
            padding: '12px 14px',
            WebkitMaskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
            maskImage: 'linear-gradient(to bottom, black 75%, transparent 100%)',
          }}>
            {isAssistant ? (
              <p style={{
                fontFamily: "'Cormorant Garamond', 'Cormorant', Georgia, serif",
                fontSize: 'clamp(13px, 1.4vw, 17px)',
                fontWeight: 400,
                lineHeight: 1.82,
                letterSpacing: '0.04em',
                margin: 0,
                color: facultyColor,
                textShadow: `0 0 18px ${facultyColor}90, 0 0 40px ${facultyColor}40`,
              }}>
                {renderMarkdown(text, facultyColor)}
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
                textShadow: `0 0 10px ${userColor}70`,
              }}>
                {renderMarkdown(text, userColor)}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
