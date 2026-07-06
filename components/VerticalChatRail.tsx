'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SPACING = 46
const HALF    = 3
const RAIL_H  = SPACING * (HALF * 2 + 1)
const CENTER  = RAIL_H / 2

interface Msg { id: string; role: string; content: string }

interface VerticalChatRailProps {
  messages: Msg[]
  facultyColor: string
  onOpenTranscript: () => void
  onEditMessage?: (id: string, newContent: string) => void
  onRegenerate?: (userMessageId: string) => void
}

export function VerticalChatRail({
  messages,
  facultyColor,
  onOpenTranscript,
  onEditMessage,
  onRegenerate,
}: VerticalChatRailProps) {
  const exchanges = messages.filter(m => m.role === 'user')
  const N = exchanges.length

  const [active, setActive]       = useState(N > 0 ? N - 1 : 0)
  const [dragPx, setDragPx]       = useState(0)
  const [dragging, setDragging]   = useState(false)
  const [panelIdx, setPanelIdx]   = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText]   = useState('')

  const isDragging    = useRef(false)
  const dragStartY    = useRef(0)
  const dragStartAct  = useRef(0)
  const dragPxRef     = useRef(0)

  useEffect(() => {
    if (N > 0) setActive(N - 1)
  }, [N])

  // For each user message find the next assistant reply
  const exchangeData = useMemo(() => {
    return exchanges.map(userMsg => {
      const msgIdx = messages.findIndex(m => m.id === userMsg.id)
      const assistantMsg =
        msgIdx >= 0 &&
        msgIdx + 1 < messages.length &&
        messages[msgIdx + 1].role === 'assistant'
          ? messages[msgIdx + 1]
          : null
      return { userMsg, assistantMsg }
    })
  }, [messages, exchanges])

  const snap = useCallback((pxOffset: number, fromIdx: number) => {
    const steps = Math.round(pxOffset / SPACING)
    setActive(prev => Math.max(0, Math.min(N - 1, fromIdx + steps)))
    setDragPx(0)
    dragPxRef.current = 0
  }, [N])

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    setDragging(true)
    dragStartY.current   = e.clientY
    dragStartAct.current = active
    dragPxRef.current    = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    const raw = -(e.clientY - dragStartY.current)
    dragPxRef.current = raw
    setDragPx(raw)
  }

  const onPointerUp = () => {
    if (!isDragging.current) return
    isDragging.current = false
    setDragging(false)
    snap(dragPxRef.current, dragStartAct.current)
  }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setActive(prev => Math.max(0, Math.min(N - 1, prev + (e.deltaY > 0 ? 1 : -1))))
  }

  if (N === 0) return null

  const panelData = panelIdx !== null ? exchangeData[panelIdx] ?? null : null

  return (
    <>
      {/* Rail */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{
          position: 'fixed',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '28px',
          height: `${RAIL_H}px`,
          zIndex: 44,
          cursor: dragging ? 'grabbing' : 'ns-resize',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Track — luminous centre glow fading to transparent at edges */}
        <div style={{
          position: 'absolute',
          left: '13px',
          top: 0,
          bottom: 0,
          width: '1px',
          background: `linear-gradient(to bottom,
            transparent 0%,
            ${facultyColor}20 12%,
            ${facultyColor}55 35%,
            ${facultyColor}80 50%,
            ${facultyColor}55 65%,
            ${facultyColor}20 88%,
            transparent 100%
          )`,
          pointerEvents: 'none',
        }} />

        {/* Dots */}
        {exchanges.map((msg, i) => {
          const offset  = (i - active) * SPACING - dragPx
          const absOff  = Math.abs(offset)
          const maxShow = CENTER + SPACING
          if (absOff > maxShow) return null

          const isCenter    = i === active
          const isPanelOpen = panelIdx === i
          const size        = isCenter ? 12 : Math.max(3, 9 * (1 - absOff / maxShow))
          const glow        = isPanelOpen
            ? `0 0 14px 4px ${facultyColor}ee, 0 0 32px ${facultyColor}88`
            : isCenter
              ? `0 0 10px 2px ${facultyColor}cc, 0 0 24px ${facultyColor}66`
              : `0 0 4px ${facultyColor}88`
          const opacity = Math.max(0.1, 1 - absOff / maxShow) * (isCenter ? 1 : 0.65)
          const topPx   = CENTER + offset

          return (
            <button
              key={msg.id}
              onClick={() => {
                if (!isCenter) setActive(i)
                setPanelIdx(prev => prev === i ? null : i)
                setEditingId(null)
              }}
              style={{
                position: 'absolute',
                left: '50%',
                top: `${topPx}px`,
                transform: 'translate(-50%, -50%)',
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: '50%',
                background: isCenter ? facultyColor : `${facultyColor}bb`,
                boxShadow: glow,
                opacity,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: dragging
                  ? 'none'
                  : 'top 0.44s cubic-bezier(0.16,1,0.3,1), width 0.28s ease, height 0.28s ease, opacity 0.28s ease, box-shadow 0.28s ease',
                zIndex: isCenter ? 2 : 1,
              }}
            />
          )
        })}

        {/* Counter */}
        <div style={{
          position: 'absolute',
          left: '20px',
          top: `${CENTER}px`,
          transform: 'translateY(-50%)',
          fontSize: '7px',
          letterSpacing: '0.18em',
          color: `${facultyColor}70`,
          fontFamily: 'var(--font-vyan)',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {active + 1}/{N}
        </div>
      </div>

      {/* Exchange panel — slides in from the left edge */}
      <AnimatePresence>
        {panelData && panelIdx !== null && (
          <motion.div
            key={`panel-${panelIdx}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              left: '36px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: 'min(320px, 42vw)',
              maxHeight: '68vh',
              zIndex: 43,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              scrollbarWidth: 'none',
              pointerEvents: 'auto',
            }}
          >
            {/* Close */}
            <button
              onClick={() => { setPanelIdx(null); setEditingId(null) }}
              style={{
                alignSelf: 'flex-end',
                background: 'transparent',
                border: 'none',
                color: `${facultyColor}70`,
                cursor: 'pointer',
                fontSize: '11px',
                padding: '0 4px 2px',
                fontFamily: 'var(--font-vyan)',
                lineHeight: 1,
              }}
            >
              ✕
            </button>

            {/* User message card */}
            <div style={{
              background: 'rgba(4,2,14,0.85)',
              border: `1px solid ${facultyColor}28`,
              borderRadius: '12px',
              padding: '12px 14px',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}>
              <div style={{
                fontSize: '7px',
                letterSpacing: '0.24em',
                color: `${facultyColor}70`,
                textTransform: 'uppercase',
                fontFamily: 'var(--font-vyan)',
                marginBottom: '8px',
              }}>
                You · #{(panelIdx ?? 0) + 1}
              </div>

              {editingId === panelData.userMsg.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    autoFocus
                    rows={3}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${facultyColor}38`,
                      borderRadius: '8px',
                      color: 'rgba(255,255,255,0.82)',
                      fontSize: '12px',
                      lineHeight: '1.65',
                      fontFamily: 'var(--font-vyan)',
                      padding: '8px 10px',
                      resize: 'none',
                      outline: 'none',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: '6px',
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-vyan)',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (onEditMessage && editText.trim()) {
                          onEditMessage(panelData.userMsg.id, editText.trim())
                        }
                        setEditingId(null)
                        setPanelIdx(null)
                      }}
                      style={{
                        background: `${facultyColor}1a`,
                        border: `1px solid ${facultyColor}50`,
                        borderRadius: '6px',
                        color: facultyColor,
                        fontSize: '9px',
                        letterSpacing: '0.12em',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-vyan)',
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{
                    margin: 0,
                    fontSize: '12px',
                    lineHeight: '1.65',
                    color: 'rgba(255,255,255,0.75)',
                    fontFamily: 'var(--font-vyan)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {panelData.userMsg.content}
                  </p>
                  {onEditMessage && (
                    <button
                      onClick={() => {
                        setEditingId(panelData.userMsg.id)
                        setEditText(panelData.userMsg.content)
                      }}
                      style={{
                        marginTop: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: `${facultyColor}55`,
                        fontSize: '8px',
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-vyan)',
                        padding: '2px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                      </svg>
                      Edit &amp; Resend
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Assistant response card */}
            {panelData.assistantMsg ? (
              <div style={{
                background: 'rgba(4,2,14,0.85)',
                border: `1px solid ${facultyColor}28`,
                borderRadius: '12px',
                padding: '12px 14px',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}>
                <div style={{
                  fontSize: '7px',
                  letterSpacing: '0.24em',
                  color: `${facultyColor}70`,
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-vyan)',
                  marginBottom: '8px',
                }}>
                  Medhā
                </div>
                <p style={{
                  margin: 0,
                  fontFamily: 'var(--font-vyan)',
                  fontSize: 'clamp(12px, 1.25vw, 15px)',
                  lineHeight: '1.82',
                  color: facultyColor,
                  textShadow: `0 0 14px ${facultyColor}55`,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>
                  {panelData.assistantMsg.content}
                </p>
                {onRegenerate && (
                  <button
                    onClick={() => {
                      onRegenerate(panelData.userMsg.id)
                      setPanelIdx(null)
                    }}
                    style={{
                      marginTop: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: `${facultyColor}55`,
                      fontSize: '8px',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-vyan)',
                      padding: '2px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                      <path d="M21 3v5h-5"/>
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                      <path d="M3 21v-5h5"/>
                    </svg>
                    Regenerate
                  </button>
                )}
              </div>
            ) : (
              <div style={{
                background: 'rgba(4,2,14,0.60)',
                border: `1px solid ${facultyColor}16`,
                borderRadius: '12px',
                padding: '12px 14px',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}>
                <p style={{ margin: 0, fontSize: '11px', color: `${facultyColor}45`, fontFamily: 'var(--font-vyan)', fontStyle: 'italic' }}>
                  Medhā is thinking…
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
