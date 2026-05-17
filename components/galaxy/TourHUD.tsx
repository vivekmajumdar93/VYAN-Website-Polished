'use client'
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { useGalaxyStore, getTourNode, getWorldPos, TOUR_SEQUENCE } from '@/lib/store'

export default function TourHUD() {
  const tourIndex = useGalaxyStore((s) => s.tourIndex)
  const selected = useGalaxyStore((s) => s.selectedNode)
  const advance = useGalaxyStore((s) => s.advanceTour)
  const isWarping = useGalaxyStore((s) => s.isWarping)
  const [distance, setDistance] = useState<number | null>(null)

  // Live distance from camera to currently selected node
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const cam = (window as any).__cam as THREE.PerspectiveCamera | undefined
      if (cam && selected) {
        const w = getWorldPos(selected)
        setDistance(w.distanceTo(cam.position))
      } else {
        setDistance(null)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selected])

  const nextNode = getTourNode(tourIndex + 1)
  const prevNode = getTourNode(tourIndex - 1)
  const total = TOUR_SEQUENCE.length
  const pos = tourIndex >= 0 ? tourIndex + 1 : 0

  return (
    <>
      {/* Bottom-center: tour position + distance */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
        <div className="rounded-full border border-white/10 bg-black/45 backdrop-blur-md px-4 py-2 flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">Stop</span>
          <span className="text-sm font-mono text-white/90">
            {String(pos).padStart(2, '0')} <span className="text-white/30">/ {String(total).padStart(2, '0')}</span>
          </span>
          {distance !== null && (
            <>
              <span className="h-3 w-px bg-white/15" />
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">Distance</span>
              <span className="text-sm font-mono text-cyan-200/90">{distance.toFixed(1)} u</span>
            </>
          )}
        </div>
      </div>

      {/* Left/right tour buttons */}
      <button
        onClick={() => advance(-1)}
        disabled={tourIndex <= 0 || isWarping}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/45 backdrop-blur-md text-white/70 hover:text-white hover:border-white/30 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all"
        aria-label="Previous stop"
        title="Previous (← / Scroll up / Swipe right)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        onClick={() => advance(1)}
        disabled={tourIndex >= TOUR_SEQUENCE.length - 1 || isWarping}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full border border-white/10 bg-black/45 backdrop-blur-md text-white/70 hover:text-white hover:border-white/30 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all"
        aria-label="Next stop"
        title="Next (→ / Scroll down / Swipe left)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </>
  )
}
