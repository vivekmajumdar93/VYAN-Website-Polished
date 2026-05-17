'use client'
import { useGalaxyStore, DEFAULT_SETTINGS, type Settings } from '@/lib/store'
import { Settings as SettingsIcon, X, RotateCcw } from 'lucide-react'

type Field = {
  key: keyof Settings
  label: string
  min: number
  max: number
  step: number
  format?: (v: number) => string
}

const FIELDS: Field[] = [
  { key: 'branches',          label: 'Branches',          min: 2,    max: 8,     step: 1,   format: (v) => `${v}` },
  { key: 'spin',              label: 'Spin Intensity',    min: 0,    max: 3,     step: 0.05 },
  { key: 'count',             label: 'Particle Count',    min: 20000, max: 280000, step: 5000, format: (v) => `${(v/1000).toFixed(0)}k` },
  { key: 'bloom',             label: 'Bloom Intensity',   min: 0,    max: 3,     step: 0.05 },
  { key: 'coreGlow',          label: 'Core Glow',         min: 0,    max: 2.5,   step: 0.05 },
  { key: 'dustDensity',       label: 'Dust Density',      min: 0,    max: 1.5,   step: 0.02 },
  { key: 'nebulaStrength',    label: 'Nebula Strength',   min: 0,    max: 2,     step: 0.05 },
  { key: 'turbulence',        label: 'Turbulence',        min: 0,    max: 2.5,   step: 0.05 },
  { key: 'warpSpeed',         label: 'Warp Speed',        min: 0.2,  max: 3,     step: 0.05 },
  { key: 'orbitSpeed',        label: 'Camera Orbit Speed', min: 0,   max: 2,     step: 0.05 },
  { key: 'gradientIntensity', label: 'Gradient Intensity', min: 0.3, max: 1.8,   step: 0.02 },
]

export default function ControlPanel() {
  const open = useGalaxyStore((s) => s.panelOpen)
  const toggle = useGalaxyStore((s) => s.togglePanel)
  const settings = useGalaxyStore((s) => s.settings)
  const update = useGalaxyStore((s) => s.updateSetting)
  const reset = useGalaxyStore((s) => s.resetSettings)

  return (
    <>
      {/* Toggle button (visible only when panel closed) */}
      {!open && (
        <button
          onClick={toggle}
          className="fixed top-6 right-6 z-30 group flex items-center gap-2 rounded-full border border-white/15 bg-black/40 backdrop-blur-md px-3.5 py-2 text-xs uppercase tracking-[0.3em] text-white/70 hover:text-white hover:border-white/30 transition-all"
          aria-label="Open controls"
        >
          <SettingsIcon size={14} className="text-purple-300" />
          Controls
        </button>
      )}

      {/* Panel */}
      <div
        className={`fixed top-6 right-6 z-30 w-[300px] max-w-[92vw] rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl transition-all duration-300 ${open ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6 pointer-events-none'}`}
      >
        <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-rose-400/60 to-transparent" />
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_10px_#ff1a2e]" />
            <span className="text-[11px] uppercase tracking-[0.35em] text-white/70">Cosmos Tuner</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={reset}
              className="p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/5"
              title="Reset to defaults"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={toggle}
              className="p-1.5 rounded-md text-white/45 hover:text-white hover:bg-white/5"
              aria-label="Close controls"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 max-h-[72vh] overflow-y-auto custom-scroll">
          {FIELDS.map((f) => {
            const v = settings[f.key] as number
            const display = f.format ? f.format(v) : v.toFixed(2)
            const percent = ((v - f.min) / (f.max - f.min)) * 100
            return (
              <div key={f.key} className="mb-3.5">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-white/55">{f.label}</span>
                  <span className="text-[11px] font-mono text-rose-200/80">{display}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={v}
                  onChange={(e) => update(f.key, Number(e.target.value) as never)}
                  className="galaxy-slider w-full -mt-1.5"
                />
              </div>
            )
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-white/5 text-[9px] uppercase tracking-[0.3em] text-white/35">
          Live shader uniforms · zero rebuild
        </div>
      </div>
    </>
  )
}
