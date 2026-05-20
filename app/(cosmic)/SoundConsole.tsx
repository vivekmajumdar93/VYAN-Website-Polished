'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import './soundconsole.css';

type Preset = 'void' | 'gateway' | 'medha';
type Settings = {
  volume: number;       // 0..1
  bass: number;         // -8..+8 dB
  treble: number;       // -8..+8 dB
  reverb: boolean;
  lowpass: boolean;
  lowpassHz: number;    // 200..18000
  speed: number;        // 0.85..1.15
  pulseSync: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  volume: 0.85,
  bass: 0,
  treble: 0,
  reverb: false,
  lowpass: false,
  lowpassHz: 1800,
  speed: 1.0,
  pulseSync: false,
};

const PRESETS: Record<Preset, Partial<Settings>> = {
  void:    { bass: 3,  treble: -2, reverb: true,  lowpass: false, speed: 0.95, pulseSync: false },
  gateway: { bass: 5,  treble: 2,  reverb: false, lowpass: false, speed: 1.0,  pulseSync: true  },
  medha:   { bass: 1,  treble: -1, reverb: true,  lowpass: true,  lowpassHz: 2400, speed: 0.9, pulseSync: false },
};

export default function SoundConsole() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Hide on /medha (the cockpit already controls audio mood).
  const visible = !pathname?.startsWith('/medha');

  const applyToAudioEngine = useCallback((settings: Settings) => {
    const w: any = typeof window !== 'undefined' ? (window as any) : null;
    const audio = w?.__vyan?.audio;
    if (!audio) return;
    try {
      audio.applyConsole?.(settings);
    } catch {}
  }, []);

  // Push changes whenever settings change.
  useEffect(() => {
    applyToAudioEngine(s);
  }, [s, applyToAudioEngine]);

  const update = (patch: Partial<Settings>) => setS((prev) => ({ ...prev, ...patch }));
  const applyPreset = (p: Preset) => {
    setActivePreset(p);
    setS((prev) => ({ ...prev, ...PRESETS[p] }));
  };
  const reset = () => {
    setActivePreset(null);
    setS(DEFAULT_SETTINGS);
  };

  if (!mounted || !visible) return null;

  return (
    <div className="sc-root">
      <button
        type="button"
        className={`sc-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Sound Console"
        title="Sound Console"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10v4" />
          <path d="M7 6v12" />
          <path d="M11 9v6" />
          <path d="M15 4v16" />
          <path d="M19 8v8" />
        </svg>
      </button>

      {open && (
        <div className="sc-panel" role="dialog">
          <header className="sc-panel__head">
            <div className="sc-panel__title">SOUND CONSOLE</div>
            <button type="button" className="sc-panel__close" onClick={() => setOpen(false)}>×</button>
          </header>

          <div className="sc-presets">
            {(['void','gateway','medha'] as Preset[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`sc-preset ${activePreset === p ? 'is-active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
            <button type="button" className="sc-preset sc-preset--reset" onClick={reset}>RESET</button>
          </div>

          <Slider
            label="Volume" hint={`${Math.round(s.volume * 100)}%`}
            min={0} max={1} step={0.01} value={s.volume}
            onChange={(v) => update({ volume: v })}
          />
          <Slider
            label="Bass" hint={`${s.bass.toFixed(1)} dB`}
            min={-8} max={8} step={0.5} value={s.bass}
            onChange={(v) => update({ bass: v })}
          />
          <Slider
            label="Treble" hint={`${s.treble.toFixed(1)} dB`}
            min={-8} max={8} step={0.5} value={s.treble}
            onChange={(v) => update({ treble: v })}
          />
          <Slider
            label="Playback Speed" hint={`${s.speed.toFixed(2)}×`}
            min={0.85} max={1.15} step={0.01} value={s.speed}
            onChange={(v) => update({ speed: v })}
          />

          <Toggle
            label="Cosmic Reverb"
            checked={s.reverb}
            onChange={(v) => update({ reverb: v })}
          />
          <Toggle
            label="Submerge (Low-Pass)"
            checked={s.lowpass}
            onChange={(v) => update({ lowpass: v })}
          />
          {s.lowpass && (
            <Slider
              label="Cutoff" hint={`${Math.round(s.lowpassHz)} Hz`}
              min={300} max={18000} step={100} value={s.lowpassHz}
              onChange={(v) => update({ lowpassHz: v })}
            />
          )}
          <Toggle
            label="Pulse-Sync (bass reactive)"
            checked={s.pulseSync}
            onChange={(v) => update({ pulseSync: v })}
          />

          <footer className="sc-panel__foot">VYAN · Audio Layer</footer>
        </div>
      )}
    </div>
  );
}

function Slider({
  label, hint, min, max, step, value, onChange,
}: { label: string; hint: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="sc-row">
      <span className="sc-row__label">{label}<em>{hint}</em></span>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="sc-slider"
      />
    </label>
  );
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="sc-row sc-row--toggle">
      <span className="sc-row__label">{label}</span>
      <button
        type="button"
        className={`sc-toggle ${checked ? 'is-on' : ''}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="sc-toggle__thumb" />
      </button>
    </label>
  );
}
