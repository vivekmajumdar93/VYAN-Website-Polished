'use client';
import React, { useEffect, useRef, useState } from 'react';
import './SoundConsole.css';

// ============================================================
// VYAN · Advanced Sound Console
// Top-left floating control. Compact "pill" by default; clicks-open
// into a full panel with:
//   • live three-band visualiser (bass / mid / treble bars + waveform)
//   • master mute · volume · pan
//   • bass + treble shelf EQ
//   • lowpass cutoff (mood) slider
//   • reverb toggle (acoustic / dry)
//   • 4 ambient presets (Cosmic · Meditative · Active · Silent)
// ============================================================

type Preset = 'cosmic' | 'meditative' | 'active' | 'silent';

const PRESETS: Record<Preset, { volume: number; bass: number; treble: number; lowpassHz: number; reverb: boolean; label: string }> = {
  cosmic:     { volume: 0.78, bass:  4,  treble:  3, lowpassHz: 16000, reverb: true,  label: 'Cosmic' },
  meditative: { volume: 0.55, bass:  6,  treble: -2, lowpassHz:  6500, reverb: true,  label: 'Meditative' },
  active:     { volume: 0.85, bass:  2,  treble:  6, lowpassHz: 20000, reverb: false, label: 'Active' },
  silent:     { volume: 0.00, bass:  0,  treble:  0, lowpassHz: 22000, reverb: false, label: 'Silent' },
};

type AudioEngine = {
  setVolume(v: number): void;
  setMuted(v: boolean): void;
  toggleMute(): void;
  setPan(v: number): void;
  applySettings(s: any): void;
  bass: number; mid: number; treble: number; energy: number;
  muted: boolean; volume: number;
};

function getEngine(): AudioEngine | null {
  if (typeof window === 'undefined') return null;
  const a = (window as any).__vyan?.audio;
  return a || null;
}

export default function SoundConsole() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.78);
  const [pan, setPan] = useState(0);
  const [bass, setBass] = useState(4);
  const [treble, setTreble] = useState(3);
  const [lowpass, setLowpass] = useState(16000);
  const [reverb, setReverb] = useState(true);
  const [preset, setPreset] = useState<Preset | null>('cosmic');
  const vizRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Sync our state from the engine once it's available.
  useEffect(() => {
    const tick = () => {
      const e = getEngine();
      if (e) {
        setMuted(e.muted);
        setVolume(e.volume);
      } else {
        setTimeout(tick, 250);
      }
    };
    tick();
  }, []);

  // Visualiser — live 3-band bars + soft waveform shape driven by engine.
  useEffect(() => {
    const canvas = vizRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const setSize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();
    const onResize = () => setSize();
    window.addEventListener('resize', onResize);
    const draw = () => {
      const e = getEngine();
      const r = canvas.getBoundingClientRect();
      const W = r.width, H = r.height;
      ctx.clearRect(0, 0, W, H);
      // Background subtle red gradient strip
      const bg = ctx.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, 'rgba(255, 90, 122, 0.05)');
      bg.addColorStop(1, 'rgba(255, 138, 90, 0.05)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      // 3-band bars (bass, mid, treble) — left half
      const bars = [
        { v: e?.bass   ?? Math.abs(Math.sin(Date.now() / 700)) * 0.4, col: '#ff5a7a' },
        { v: e?.mid    ?? Math.abs(Math.sin(Date.now() / 500)) * 0.5, col: '#ff8a5a' },
        { v: e?.treble ?? Math.abs(Math.sin(Date.now() / 380)) * 0.45, col: '#ffd0a0' },
      ];
      const bw = (W * 0.45) / bars.length;
      bars.forEach((b, i) => {
        const v = Math.min(1, b.v);
        const bh = Math.max(2, v * (H * 0.78));
        ctx.fillStyle = b.col;
        ctx.fillRect(8 + i * bw + bw * 0.18, H - bh - 6, bw * 0.6, bh);
      });
      // Energy ring — right half
      const cx = W * 0.74, cy = H / 2;
      const energy = e?.energy ?? (Math.abs(Math.sin(Date.now() / 600)) * 0.45);
      const ringR = H * 0.36 + energy * 8;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 138, 138, ${0.45 + energy * 0.4})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Inner pulse dot
      ctx.beginPath();
      ctx.arc(cx, cy, 2 + energy * 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#ff5a7a';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const applyPreset = (p: Preset) => {
    const e = getEngine();
    setPreset(p);
    const s = PRESETS[p];
    setVolume(s.volume); setBass(s.bass); setTreble(s.treble); setLowpass(s.lowpassHz); setReverb(s.reverb);
    if (!e) return;
    e.applySettings({ volume: s.volume, bass: s.bass, treble: s.treble, lowpassHz: s.lowpassHz, reverb: s.reverb, muted: muted || s.volume === 0 });
    if (p === 'silent') { e.setMuted(true); setMuted(true); } else if (muted && s.volume > 0) { e.setMuted(false); setMuted(false); }
  };

  const onToggleMute = () => { const e = getEngine(); if (!e) return; e.toggleMute(); setMuted(e.muted); };
  const onVolume = (v: number) => { setVolume(v); setPreset(null); const e = getEngine(); if (e) e.setVolume(v); };
  const onPan = (v: number) => { setPan(v); const e = getEngine(); if (e) e.setPan(v); };
  const onEQ = (which: 'bass' | 'treble', v: number) => {
    if (which === 'bass') setBass(v); else setTreble(v);
    setPreset(null);
    const e = getEngine(); if (!e) return;
    e.applySettings({ [which]: v });
  };
  const onLowpass = (v: number) => { setLowpass(v); setPreset(null); const e = getEngine(); if (!e) return; e.applySettings({ lowpassHz: v }); };
  const onReverb = () => { const v = !reverb; setReverb(v); setPreset(null); const e = getEngine(); if (!e) return; e.applySettings({ reverb: v }); };

  // ESC closes the panel.
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open]);

  return (
    <div className={`sc-root ${open ? 'is-open' : ''}`} data-vyan-panel={open ? 'open' : 'closed'}>
      <button type="button" className="sc-trigger" onClick={() => setOpen(o => !o)} aria-label="Sound console">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {muted
            ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
            : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></>
          }
        </svg>
        <span className="sc-trigger__label">acoustic</span>
      </button>

      {open && (
        <div className="sc-panel">
          <header className="sc-panel__head">
            <span className="sc-kicker">VYAN · Acoustic Console</span>
            <button type="button" className="sc-x" onClick={() => setOpen(false)} aria-label="close">✕</button>
          </header>

          <canvas ref={vizRef} className="sc-viz" />

          <div className="sc-row">
            <button type="button" className={`sc-mute ${muted ? 'is-muted' : ''}`} onClick={onToggleMute}>
              {muted ? 'unmute' : 'mute'}
            </button>
            <div className="sc-slider">
              <span>master</span>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => onVolume(parseFloat(e.target.value))} />
              <em>{Math.round(volume * 100)}%</em>
            </div>
          </div>

          <div className="sc-row">
            <div className="sc-slider">
              <span>bass</span>
              <input type="range" min={-12} max={12} step={0.5} value={bass} onChange={(e) => onEQ('bass', parseFloat(e.target.value))} />
              <em>{bass > 0 ? '+' : ''}{bass.toFixed(1)} dB</em>
            </div>
          </div>
          <div className="sc-row">
            <div className="sc-slider">
              <span>treble</span>
              <input type="range" min={-12} max={12} step={0.5} value={treble} onChange={(e) => onEQ('treble', parseFloat(e.target.value))} />
              <em>{treble > 0 ? '+' : ''}{treble.toFixed(1)} dB</em>
            </div>
          </div>
          <div className="sc-row">
            <div className="sc-slider">
              <span>mood</span>
              <input type="range" min={400} max={22000} step={100} value={lowpass} onChange={(e) => onLowpass(parseFloat(e.target.value))} />
              <em>{lowpass >= 20000 ? 'open' : lowpass < 1000 ? 'deep' : `${(lowpass/1000).toFixed(1)}k`}</em>
            </div>
          </div>
          <div className="sc-row">
            <div className="sc-slider">
              <span>pan</span>
              <input type="range" min={-1} max={1} step={0.02} value={pan} onChange={(e) => onPan(parseFloat(e.target.value))} />
              <em>{pan === 0 ? 'C' : pan < 0 ? `${Math.round(pan * -100)}L` : `${Math.round(pan * 100)}R`}</em>
            </div>
            <button type="button" className={`sc-toggle ${reverb ? 'is-on' : ''}`} onClick={onReverb}>reverb</button>
          </div>

          <div className="sc-presets">
            {(Object.keys(PRESETS) as Preset[]).map((p) => (
              <button key={p} type="button" className={`sc-preset ${preset === p ? 'is-active' : ''}`} onClick={() => applyPreset(p)}>
                {PRESETS[p].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
