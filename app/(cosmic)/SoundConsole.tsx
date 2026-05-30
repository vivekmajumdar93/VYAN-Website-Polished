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

      // Time-driven decay buffers (smoother bars).
      const now = Date.now();
      const tSec = now / 1000;

      // ===== BACKGROUND GRID — subtle holographic crosshatch ===========
      ctx.save();
      ctx.globalAlpha = 0.10;
      ctx.strokeStyle = '#ff8c8c';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 8; i++) {
        const x = (W * i) / 8;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let j = 1; j < 4; j++) {
        const y = (H * j) / 4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();

      // ===== SPECTRUM BARS (12 bars across left 62%) ===================
      const bandsLive = [
        e?.bass ?? 0,
        e?.mid ?? 0,
        e?.treble ?? 0,
      ];
      const barCount = 12;
      const barAreaW = W * 0.62;
      const barW = (barAreaW - 16) / barCount - 1.5;
      for (let i = 0; i < barCount; i++) {
        // Distribute frequencies across the 3 bands with sine modulation.
        const bandIdx = i < 4 ? 0 : i < 8 ? 1 : 2;
        const base = bandsLive[bandIdx];
        const v = Math.min(1,
          Math.max(0,
            base * (0.7 + Math.abs(Math.sin(tSec * 6 + i * 0.55)) * 0.55)
            + (e ? 0 : Math.abs(Math.sin(tSec * (3 + i * 0.4))) * 0.35)
          )
        );
        const bh = Math.max(2, v * (H - 14));
        const x = 8 + i * (barW + 1.5);
        const y = H - bh - 6;

        // Bar fill — vertical gradient red → amber tip
        const grd = ctx.createLinearGradient(0, y + bh, 0, y);
        grd.addColorStop(0,   `rgba(255, 60, 90, ${0.85})`);
        grd.addColorStop(0.6, `rgba(255, 120, 90, ${0.92})`);
        grd.addColorStop(1,   `rgba(255, 220, 200, ${0.95})`);
        ctx.fillStyle = grd;
        ctx.shadowColor = 'rgba(255, 90, 122, 0.7)';
        ctx.shadowBlur = 6;
        ctx.fillRect(x, y, barW, bh);
        // Bright cap line at top of each bar
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 4;
        ctx.fillRect(x, y, barW, 1.5);
        ctx.shadowBlur = 0;
      }

      // ===== WAVEFORM RIBBON across bottom-middle ======================
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 180, 0.6)';
      ctx.lineWidth = 1.3;
      ctx.shadowColor = 'rgba(255, 120, 100, 0.6)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const wfY = H * 0.85;
      const energyForWave = e?.energy ?? 0.3;
      for (let x = 0; x <= barAreaW; x += 2) {
        const ph = (x / 40) + tSec * 4;
        const amp = (3 + energyForWave * 12);
        const y = wfY + Math.sin(ph) * amp * Math.sin(x / 22);
        if (x === 0) ctx.moveTo(x + 8, y);
        else         ctx.lineTo(x + 8, y);
      }
      ctx.stroke();
      ctx.restore();

      // ===== DUAL ENERGY RING — right side core ========================
      const ringCx = W * 0.83, ringCy = H / 2;
      const energy = e?.energy ?? (Math.abs(Math.sin(tSec * 1.2)) * 0.45);
      const ringR  = H * 0.30 + energy * 8;

      // Outer ring — full circle, soft fill
      ctx.save();
      ctx.beginPath();
      ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 180, 180, ${0.42 + energy * 0.4})`;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(255, 90, 122, 0.7)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();

      // Inner ring — rotating arc segment for "scan" feel
      ctx.save();
      ctx.translate(ringCx, ringCy);
      ctx.rotate(tSec * 1.8);
      ctx.beginPath();
      ctx.arc(0, 0, ringR - 6, 0, Math.PI * 1.2);
      ctx.strokeStyle = `rgba(255, 220, 200, ${0.65 + energy * 0.3})`;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#ffb0a0';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // Core pulse dot
      ctx.beginPath();
      ctx.arc(ringCx, ringCy, 2.6 + energy * 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#ff5a7a';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Tick marks around the ring (every 30°)
      ctx.save();
      ctx.translate(ringCx, ringCy);
      ctx.strokeStyle = 'rgba(255, 180, 180, 0.42)';
      ctx.lineWidth = 1;
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        const r1 = ringR + 3;
        const r2 = ringR + 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.restore();

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
