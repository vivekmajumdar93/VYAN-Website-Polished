'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const SPACING = 46      // px between dot centres
const HALF    = 3       // visible slots on each side of centre (7 total)
const RAIL_H  = SPACING * (HALF * 2 + 1)
const CENTER  = RAIL_H / 2

interface Msg { id: string; role: string; content: string }

interface VerticalChatRailProps {
  messages: Msg[]
  facultyColor: string
  onOpenTranscript: () => void
}

export function VerticalChatRail({
  messages,
  facultyColor,
  onOpenTranscript,
}: VerticalChatRailProps) {
  const exchanges = messages.filter(m => m.role === 'user')
  const N = exchanges.length

  const [active, setActive]     = useState(N > 0 ? N - 1 : 0)
  const [dragPx, setDragPx]     = useState(0)   // raw pixel drag offset
  const [dragging, setDragging] = useState(false)

  const isDragging    = useRef(false)
  const dragStartY    = useRef(0)
  const dragStartAct  = useRef(0)
  const dragPxRef     = useRef(0)

  // Auto-advance to the newest message when conversation grows
  useEffect(() => {
    if (N > 0) setActive(N - 1)
  }, [N])

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
    // Drag UP → newer items (higher index) → positive offset in index space
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

  return (
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

      {/* Dots — chain scrolls when active changes */}
      {exchanges.map((msg, i) => {
        const offset  = (i - active) * SPACING - dragPx
        const absOff  = Math.abs(offset)
        const maxShow = CENTER + SPACING        // hide beyond 1 slot past edge
        if (absOff > maxShow) return null

        const isCenter  = i === active
        const size      = isCenter ? 12 : Math.max(3, 9 * (1 - absOff / maxShow))
        const glow      = isCenter
          ? `0 0 10px 2px ${facultyColor}cc, 0 0 24px ${facultyColor}66`
          : `0 0 4px ${facultyColor}88`
        const opacity   = Math.max(0.1, 1 - absOff / maxShow) * (isCenter ? 1 : 0.65)
        const topPx     = CENTER + offset

        return (
          <button
            key={msg.id}
            onClick={() => isCenter ? onOpenTranscript() : setActive(i)}
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
              // Smooth spring-like settle after drag release; instant during drag
              transition: dragging
                ? 'none'
                : 'top 0.44s cubic-bezier(0.16,1,0.3,1), width 0.28s ease, height 0.28s ease, opacity 0.28s ease, box-shadow 0.28s ease',
              zIndex: isCenter ? 2 : 1,
            }}
          />
        )
      })}

      {/* Counter — shows current / total */}
      <div style={{
        position: 'absolute',
        left: '20px',
        top: `${CENTER}px`,
        transform: 'translateY(-50%)',
        fontSize: '7px',
        letterSpacing: '0.18em',
        color: `${facultyColor}70`,
        fontFamily: 'system-ui',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        {active + 1}/{N}
      </div>
    </div>
  )
}
