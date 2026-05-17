'use client'
import { useGalaxyStore, getWorldPos } from '@/lib/store'
import ControlPanel from './ControlPanel'

export default function HUD() {
  const selected = useGalaxyStore((s) => s.selectedNode)
  const hovered = useGalaxyStore((s) => s.hoveredNode)
  const clear = useGalaxyStore((s) => s.setSelected)

  return (
    <>
      <div className="pointer-events-none fixed top-6 left-6 z-10 select-none">
        <div className="text-[10px] uppercase tracking-[0.45em] text-white/40">Procedural · Neural Cosmos</div>
        <div className="text-3xl md:text-4xl font-light text-white/95 tracking-[0.05em]">
          Galaxy <span className="bg-gradient-to-r from-cyan-300 via-indigo-400 to-violet-400 bg-clip-text text-transparent">Atlas</span>
        </div>
        <div className="mt-2 text-xs text-white/40 max-w-sm font-light">
          Drag to orbit · Scroll to zoom · Click a glowing node to warp
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-6 left-6 z-10 text-[10px] tracking-[0.35em] uppercase text-white/30">
        R3F · Three.js · GLSL · Bloom · Sibling Galaxies
      </div>

      {hovered && !selected && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-10 text-xs tracking-widest uppercase text-cyan-200/80">
          // {hovered}
        </div>
      )}

      {selected && (() => {
        const w = getWorldPos(selected)
        return (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-[380px] max-w-[92vw]">
            <div className="relative rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-5 shadow-2xl">
              <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]"
                    style={{ color: selected.color, backgroundColor: selected.color }}
                  />
                  {selected.isPortal && (
                    <span className="text-[9px] uppercase tracking-[0.3em] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      Wormhole
                    </span>
                  )}
                  {selected.galaxyId === 'void' && !selected.isPortal && (
                    <span className="text-[9px] uppercase tracking-[0.3em] px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30">
                      Void Galaxy
                    </span>
                  )}
                </div>
                <button onClick={() => clear(null)} className="text-white/40 hover:text-white text-[10px] tracking-[0.3em] uppercase">
                  Close
                </button>
              </div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-white/40">Locked Node</div>
              <div className="text-2xl font-light text-white mt-1">{selected.label}</div>
              <div className="mt-3 text-sm text-white/70 leading-relaxed">{selected.description}</div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-white/40">
                <div><div className="text-white/85 text-base font-light font-mono">{w.x.toFixed(1)}</div>X</div>
                <div><div className="text-white/85 text-base font-light font-mono">{w.y.toFixed(2)}</div>Y</div>
                <div><div className="text-white/85 text-base font-light font-mono">{w.z.toFixed(1)}</div>Z</div>
              </div>
            </div>
          </div>
        )
      })()}

      <ControlPanel />
    </>
  )
}
