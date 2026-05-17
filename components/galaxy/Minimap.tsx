'use client'
import { useEffect, useState } from 'react'
import { useGalaxyStore, getWorldPos, NODES, TOUR_SEQUENCE, getTourNode, PRIMARY_GALAXY, VOID_GALAXY } from '@/lib/store'

function Minimap() {
  const currentGalaxy = useGalaxyStore((s) => s.currentGalaxy)
  const selected = useGalaxyStore((s) => s.selectedNode)
  const [cam, setCam] = useState({ x: 0, z: 9 })

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const c = (window as any).__cam
      if (c) setCam({ x: c.position.x, z: c.position.z })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Map world XZ to minimap pixel coords (180x180). Center the midpoint between galaxies.
  const midX = (PRIMARY_GALAXY.position.x + VOID_GALAXY.position.x) / 2
  const midZ = (PRIMARY_GALAXY.position.z + VOID_GALAXY.position.z) / 2
  const span = 170
  const scale = 0.55
  const toMap = (x: number, z: number) => ({
    cx: span / 2 + (x - midX) * scale,
    cy: span / 2 + (z - midZ) * scale,
  })
  const primary = toMap(PRIMARY_GALAXY.position.x, PRIMARY_GALAXY.position.z)
  const voidM = toMap(VOID_GALAXY.position.x, VOID_GALAXY.position.z)
  const camM = toMap(cam.x, cam.z)

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-30 select-none">
      <div className="relative w-[170px] h-[170px] rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md shadow-2xl overflow-hidden">
        <svg viewBox={`0 0 ${span} ${span}`} className="w-full h-full">
          {/* Grid */}
          <defs>
            <pattern id="grid" width="17" height="17" patternUnits="userSpaceOnUse">
              <path d="M 17 0 L 0 0 0 17" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={span} height={span} fill="url(#grid)" />

          {/* Travel arc */}
          <line x1={primary.cx} y1={primary.cy} x2={voidM.cx} y2={voidM.cy} stroke="rgba(180,200,255,0.18)" strokeWidth="1" strokeDasharray="2 3" />

          {/* Primary galaxy */}
          <circle cx={primary.cx} cy={primary.cy} r="10" fill="url(#g1)" />
          <defs>
            <radialGradient id="g1">
              <stop offset="0" stopColor="rgba(180,140,255,0.95)" />
              <stop offset="1" stopColor="rgba(20,30,90,0)" />
            </radialGradient>
            <radialGradient id="g2">
              <stop offset="0" stopColor="rgba(255,150,200,0.95)" />
              <stop offset="1" stopColor="rgba(60,20,60,0)" />
            </radialGradient>
          </defs>
          <circle cx={primary.cx} cy={primary.cy} r="3.2" fill="#ffffff" />

          {/* Void galaxy */}
          <circle cx={voidM.cx} cy={voidM.cy} r="8" fill="url(#g2)" />
          <circle cx={voidM.cx} cy={voidM.cy} r="2.6" fill="#ffd1ec" />

          {/* Selected node ring */}
          {selected && (() => {
            const w = getWorldPos(selected)
            const p = toMap(w.x, w.z)
            return <circle cx={p.cx} cy={p.cy} r="4" fill="none" stroke={selected.color} strokeWidth="1.2" />
          })()}

          {/* Camera position */}
          <circle cx={camM.cx} cy={camM.cy} r="3.4" fill="#7ee8ff" />
          <circle cx={camM.cx} cy={camM.cy} r="7" fill="none" stroke="rgba(126,232,255,0.45)" strokeWidth="1">
            <animate attributeName="r" from="6" to="12" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Labels */}
        <div className="absolute top-1.5 left-2.5 text-[8px] uppercase tracking-[0.32em] text-white/50">Sector Map</div>
        <div className="absolute bottom-1.5 left-2.5 text-[8px] uppercase tracking-[0.32em] text-white/40">
          {currentGalaxy === 'void' ? 'Void Sector' : 'Home Sector'}
        </div>
      </div>
    </div>
  )
}

export default Minimap
