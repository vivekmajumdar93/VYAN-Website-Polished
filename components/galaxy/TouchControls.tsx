'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// On-screen rotation joystick for touch devices.
// Drag inside the puck to rotate the camera around its target via the OrbitControls API.
export default function TouchControls() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const dragging = useRef(false)
  const centerRef = useRef({ x: 0, y: 0 })
  const knobRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Show on touch devices only
    const isTouch = (typeof window !== 'undefined') && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    setVisible(isTouch)
  }, [])

  useEffect(() => {
    if (!visible) return
    let raf = 0
    let azDelta = 0
    let polDelta = 0

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const controls = (window as any).__controls?.current
      if (!controls) return
      if (azDelta !== 0 || polDelta !== 0) {
        const az = controls.getAzimuthalAngle?.() ?? 0
        const pol = controls.getPolarAngle?.() ?? 0
        controls.setAzimuthalAngle?.(az - azDelta * 0.04)
        controls.setPolarAngle?.(THREE.MathUtils.clamp(pol - polDelta * 0.04, 0.15, Math.PI - 0.15))
        controls.update?.()
      }
    }
    raf = requestAnimationFrame(tick)

    const handleStart = (e: PointerEvent) => {
      if (!containerRef.current) return
      dragging.current = true
      const rect = containerRef.current.getBoundingClientRect()
      centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    }
    const handleMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - centerRef.current.x
      const dy = e.clientY - centerRef.current.y
      const max = 38
      const cdx = Math.max(-max, Math.min(max, dx))
      const cdy = Math.max(-max, Math.min(max, dy))
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${cdx}px, ${cdy}px)`
      }
      azDelta = cdx / max
      polDelta = cdy / max
    }
    const handleEnd = () => {
      dragging.current = false
      azDelta = 0
      polDelta = 0
      if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)'
    }

    const el = containerRef.current
    if (el) {
      el.addEventListener('pointerdown', handleStart)
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleEnd)
      window.addEventListener('pointercancel', handleEnd)
    }
    return () => {
      cancelAnimationFrame(raf)
      if (el) el.removeEventListener('pointerdown', handleStart)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      ref={containerRef}
      className="fixed bottom-24 left-6 z-30 h-24 w-24 rounded-full border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl touch-none"
      style={{ touchAction: 'none' }}
    >
      <div
        ref={knobRef}
        className="absolute top-1/2 left-1/2 -ml-3 -mt-3 h-6 w-6 rounded-full bg-white/90 shadow-[0_0_12px_rgba(126,232,255,0.7)] transition-transform"
      />
      <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
        <span className="text-[8px] uppercase tracking-[0.32em] text-white/40">Rotate</span>
      </div>
    </div>
  )
}
