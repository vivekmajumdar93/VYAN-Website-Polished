'use client'
import { useEffect } from 'react'
import { useGalaxyStore } from '@/lib/store'

// Handles wheel + touch swipe navigation through the fixed tour sequence.
// Each discrete scroll/swipe gesture advances exactly one stop.
export default function ScrollNavigator() {
  const advance = useGalaxyStore((s) => s.advanceTour)
  const isWarping = useGalaxyStore((s) => s.isWarping)

  useEffect(() => {
    let cooldown = false
    let wheelAccum = 0
    let touchStartX = 0
    let touchStartY = 0
    const COOLDOWN_MS = 700
    const WHEEL_THRESHOLD = 60
    const SWIPE_THRESHOLD = 50

    const trigger = (dir: 1 | -1) => {
      if (cooldown || useGalaxyStore.getState().isWarping) return
      cooldown = true
      wheelAccum = 0
      advance(dir)
      setTimeout(() => { cooldown = false }, COOLDOWN_MS)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      wheelAccum += e.deltaY
      if (wheelAccum > WHEEL_THRESHOLD) trigger(1)
      else if (wheelAccum < -WHEEL_THRESHOLD) trigger(-1)
    }

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStartX = t.clientX
      touchStartY = t.clientY
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStartX
      const dy = t.clientY - touchStartY
      // Prefer horizontal swipe for nav; vertical also works for parity with scroll
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 0.8) {
        trigger(dx < 0 ? 1 : -1)
      } else if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 0.8) {
        trigger(dy > 0 ? 1 : -1)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault(); trigger(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault(); trigger(-1)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKey)
    }
  }, [advance, isWarping])

  return null
}
