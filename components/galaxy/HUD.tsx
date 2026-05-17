'use client'
import { useGalaxyStore } from '@/lib/store'

export default function HUD() {
  const selected = useGalaxyStore((s) => s.selectedNode)
  const hovered = useGalaxyStore((s) => s.hoveredNode)
  const clear = useGalaxyStore((s) => s.setSelected)

  return (
    <>
      {/* Top-left title */}
      <div className="pointer-events-none fixed top-6 left-6 z-10 select-none">
        <div className="text-xs uppercase tracking-[0.4em] text-white/50">Procedural</div>
        <div className="text-3xl md:text-4xl font-light text-white/90 tracking-wider">
          Galaxy <span className="text-purple-300">Atlas</span>
        </div>
        <div className="mt-2 text-xs text-white/40 max-w-sm font-light">
          Drag to orbit · Scroll to zoom · Click a glowing node to explore
        </div>
      </div>

      {/* Bottom-left credits */}
      <div className="pointer-events-none fixed bottom-6 left-6 z-10 text-[10px] tracking-[0.3em] uppercase text-white/30">
        React Three Fiber · Three.js · GLSL · Bloom Postprocessing
      </div>

      {/* Hover indicator */}
      {hovered && !selected && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-10 text-xs tracking-widest uppercase text-purple-200/80">
          // {hovered}
        </div>
      )}

      {/* Selected node panel */}
      {selected && (
        <div className="fixed top-1/2 right-6 -translate-y-1/2 z-10 w-[320px] max-w-[90vw]">
          <div className="relative rounded-xl border border-white/10 bg-black/55 backdrop-blur-md p-5 shadow-2xl">
            <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-purple-300/70 to-transparent" />
            <div className="flex items-center justify-between mb-3">
              <div
                className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]"
                style={{ color: selected.color, backgroundColor: selected.color }}
              />
              <button
                onClick={() => clear(null)}
                className="text-white/40 hover:text-white text-xs tracking-widest uppercase"
              >
                Close
              </button>
            </div>
            <div className="text-xs uppercase tracking-[0.35em] text-white/40">Node</div>
            <div className="text-2xl font-light text-white mt-1">{selected.label}</div>
            <div className="mt-4 text-sm text-white/70 leading-relaxed">{selected.description}</div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-white/40">
              <div>
                <div className="text-white/80 text-base font-light">{selected.position[0].toFixed(1)}</div>
                X
              </div>
              <div>
                <div className="text-white/80 text-base font-light">{selected.position[1].toFixed(2)}</div>
                Y
              </div>
              <div>
                <div className="text-white/80 text-base font-light">{selected.position[2].toFixed(1)}</div>
                Z
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
