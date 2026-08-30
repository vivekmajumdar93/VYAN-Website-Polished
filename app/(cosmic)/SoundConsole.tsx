'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── VYAN Sound Console ───────────────────────────────────────────────────────
// Glass panel that controls window.__vyan.audio (AudioReactive / ambient.mp3).
// Soundscape presets apply EQ curves via applyConsole(). Visualizer reads the
// real AnalyserNode — no synthetic audio generated here.
// ─────────────────────────────────────────────────────────────────────────────

const GOLD = '#c99235';
const BAR_N = 65;

type PresetSettings = {
  volume?: number;
  bass?: number;
  treble?: number;
  lowpassHz?: number;
  reverb?: boolean;
  pulseSync?: boolean;
};

type Preset = {
  id: string;
  name: string;
  subtitle: string;
  settings: PresetSettings;
  barProfile(i: number, t: number): number;
};

const PRESETS: Preset[] = [
  {
    id: 'void_silence',
    name: 'Void Silence',
    subtitle: 'Śūnya Maṇḍala',
    settings: { volume: 0.22, bass: -4, treble: -6, lowpassHz: 900, reverb: true },
    barProfile: (i, t) => 0.06 + Math.abs(Math.sin(t * 0.3 + i * 0.8)) * 0.04,
  },
  {
    id: 'neural_drift',
    name: 'Neural Drift',
    subtitle: 'Binaural Resonance',
    settings: { volume: 0.72, bass: 5, treble: -2, lowpassHz: 6000, reverb: true },
    barProfile: (i, t) => 0.18 + Math.abs(Math.sin(t * 1.2 + i * 0.5)) * 0.15 + (i < 20 ? 0.15 : 0),
  },
  {
    id: 'crystal',
    name: 'Crystal Resonance',
    subtitle: 'Sparśa Field',
    settings: { volume: 0.75, bass: -2, treble: 8, lowpassHz: 20000, reverb: false },
    barProfile: (i, t) => (i > 30 ? 0.35 : 0.1) + Math.abs(Math.sin(t * 2 + i * 0.9)) * 0.12,
  },
  {
    id: 'vortex',
    name: 'Vortex Descent',
    subtitle: 'Āvartana',
    settings: { volume: 0.88, bass: 4, treble: 4, lowpassHz: 20000, reverb: false },
    barProfile: (i, t) => 0.4 + Math.abs(Math.sin(t * 3.5 + i * 0.4)) * 0.3,
  },
  {
    id: 'cathedral',
    name: 'Cathedral Bloom',
    subtitle: 'Kathedral Śūnya',
    settings: { volume: 0.70, bass: 3, treble: 0, lowpassHz: 12000, reverb: true },
    barProfile: (i, t) => 0.25 + Math.abs(Math.sin(t * 0.8 + i * 0.6)) * 0.18 + Math.abs(Math.sin(t * 0.3 + i * 0.2)) * 0.08,
  },
  {
    id: 'solar_ignition',
    name: 'Solar Ignition',
    subtitle: 'Sūrya Dīkṣā',
    settings: { volume: 0.85, bass: 8, treble: 2, lowpassHz: 20000, reverb: false, pulseSync: true },
    barProfile: (i, t) => 0.45 + Math.abs(Math.sin(t * 4 + i * 0.35)) * 0.35 + (i < 15 ? 0.2 : 0),
  },
  {
    id: 'deep_current',
    name: 'Deep Current',
    subtitle: 'Gambhīra Dhārā',
    settings: { volume: 0.65, bass: 10, treble: -5, lowpassHz: 3000, reverb: true },
    barProfile: (i, t) => (i < 25 ? 0.45 : 0.08) + Math.abs(Math.sin(t * 0.6 + i * 0.7)) * 0.15,
  },
  {
    id: 'pranic_pulse',
    name: 'Prāṇic Pulse',
    subtitle: 'Prāṇa Spanda',
    settings: { volume: 0.60, bass: 3, treble: 1, lowpassHz: 8000, reverb: true },
    barProfile: (i, t) => 0.2 + Math.abs(Math.sin(t * 1.5 + i * 0.5)) * 0.1 + Math.abs(Math.sin(t * 3 + i * 1.2)) * 0.08,
  },
];

function getEngine() {
  if (typeof window === 'undefined') return null;
  return (window as any).__vyan?.audio ?? null;
}

export default function SoundConsole() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.78);
  const [presetIdx, setPresetIdx] = useState(0);
  const [view, setView] = useState<'main' | 'library'>('main');

  const vizRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const progressDotRef = useRef<HTMLDivElement>(null);
  const targetsRef = useRef(new Float32Array(BAR_N).fill(0.08));
  const currentRef = useRef(new Float32Array(BAR_N).fill(0.08));
  const freqBufRef = useRef<Uint8Array | null>(null);

  const applyPreset = useCallback((idx: number) => {
    const preset = PRESETS[idx];
    setPresetIdx(idx);
    const e = getEngine();
    if (!e) return;
    e.applyConsole({ ...preset.settings });
    if (!muted && typeof preset.settings.volume === 'number') {
      setVolume(preset.settings.volume);
    }
  }, [muted]);

  // Sync muted/volume from engine once available
  useEffect(() => {
    const poll = () => {
      const e = getEngine();
      if (e) { setMuted(!!e.muted); setVolume(e.volume ?? 0.78); }
      else setTimeout(poll, 300);
    };
    poll();
  }, []);

  // External toggle via vyan:sound-toggle event
  useEffect(() => {
    const h = () => setOpen(o => !o);
    window.addEventListener('vyan:sound-toggle', h);
    return () => window.removeEventListener('vyan:sound-toggle', h);
  }, []);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  // Animation loop — runs while panel is open
  useEffect(() => {
    if (!open) return;
    const vizCanvas = vizRef.current;
    const barsCanvas = barsRef.current;
    if (!vizCanvas || !barsCanvas) return;
    const vc = vizCanvas.getContext('2d');
    const bc = barsCanvas.getContext('2d');
    if (!vc || !bc) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      for (const c of [vizCanvas, barsCanvas]) {
        const r = c.getBoundingClientRect();
        c.width = r.width * dpr;
        c.height = r.height * dpr;
        c.getContext('2d')!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const targets = targetsRef.current;
    const current = currentRef.current;

    const draw = () => {
      const engine = getEngine();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const analyser = (engine as any)?.analyser as AnalyserNode | undefined;
      const t = performance.now() / 1000;
      const preset = PRESETS[presetIdx];
      const energy: number = engine?.energy ?? 0.15;

      // ── Circular visualizer ──────────────────────────────────────────────
      const W = vizCanvas.getBoundingClientRect().width;
      const H = vizCanvas.getBoundingClientRect().height;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) / 2 - 2;

      vc.clearRect(0, 0, W, H);
      vc.save();
      vc.beginPath();
      vc.arc(cx, cy, R, 0, Math.PI * 2);
      vc.clip();

      // Dark fill
      vc.fillStyle = 'rgba(8,5,2,0.88)';
      vc.fillRect(0, 0, W, H);

      // Ambient glow
      const g1 = vc.createRadialGradient(cx, cy, 0, cx, cy, R);
      g1.addColorStop(0, `rgba(201,146,53,${0.10 + energy * 0.18})`);
      g1.addColorStop(0.5, 'rgba(201,146,53,0.03)');
      g1.addColorStop(1, 'transparent');
      vc.fillStyle = g1;
      vc.fillRect(0, 0, W, H);

      // Golden sine waves (5 layers)
      for (let w = 0; w < 5; w++) {
        const phase = (w / 5) * Math.PI * 2;
        const amp = (12 + energy * 22) * (0.55 + w * 0.12);
        const freq = 2.4 + w * 0.38;
        const alpha = 0.12 + (5 - w) * 0.07;
        vc.beginPath();
        vc.strokeStyle = `rgba(201,146,53,${alpha})`;
        vc.lineWidth = 0.7 + (5 - w) * 0.18;
        for (let x = 0; x <= W; x += 1.5) {
          const nx = (x / W) * Math.PI * 2 * freq;
          const y = cy + Math.sin(nx + t * (0.38 + w * 0.14) + phase) * amp;
          if (x === 0) vc.moveTo(x, y); else vc.lineTo(x, y);
        }
        vc.shadowColor = GOLD; vc.shadowBlur = 4;
        vc.stroke();
        vc.shadowBlur = 0;
      }

      // Central sun
      const g2 = vc.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42);
      g2.addColorStop(0, `rgba(255,220,120,${0.25 + energy * 0.28})`);
      g2.addColorStop(0.4, `rgba(201,146,53,${0.10 + energy * 0.10})`);
      g2.addColorStop(1, 'transparent');
      vc.fillStyle = g2;
      vc.fillRect(0, 0, W, H);

      vc.restore(); // end clip

      // Rim
      vc.beginPath();
      vc.arc(cx, cy, R, 0, Math.PI * 2);
      vc.strokeStyle = `rgba(201,146,53,${0.22 + energy * 0.2})`;
      vc.lineWidth = 1;
      vc.stroke();

      // Orbiting dot
      const dotAng = t * 0.75;
      vc.beginPath();
      vc.arc(cx + Math.cos(dotAng) * R, cy + Math.sin(dotAng) * R, 2.5, 0, Math.PI * 2);
      vc.fillStyle = GOLD;
      vc.shadowColor = GOLD; vc.shadowBlur = 8;
      vc.fill(); vc.shadowBlur = 0;

      // ── Frequency bars ──────────────────────────────────────────────────
      const BW = barsCanvas.getBoundingClientRect().width;
      const BH = barsCanvas.getBoundingClientRect().height;
      bc.clearRect(0, 0, BW, BH);

      if (analyser && !muted) {
        // Read real FFT data
        if (!freqBufRef.current || freqBufRef.current.length !== analyser.frequencyBinCount) {
          freqBufRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freqBufRef.current);
        const bins = freqBufRef.current.length;
        for (let i = 0; i < BAR_N; i++) {
          const binIdx = Math.floor((i / BAR_N) * bins * 0.72);
          targets[i] = freqBufRef.current[binIdx] / 255;
        }
      } else {
        // Synthetic fallback from preset profile
        for (let i = 0; i < BAR_N; i++) {
          targets[i] = Math.min(1, Math.max(0.04, preset.barProfile(i, t)));
        }
      }

      // Smooth lerp
      for (let i = 0; i < BAR_N; i++) {
        current[i] += (targets[i] - current[i]) * 0.14;
      }

      const gap = 1.8;
      const barW = (BW - gap * (BAR_N - 1)) / BAR_N;
      for (let i = 0; i < BAR_N; i++) {
        const h = Math.max(2, current[i] * BH * 0.90);
        const x = i * (barW + gap);
        const y = BH - h;
        const grad = bc.createLinearGradient(0, y, 0, BH);
        grad.addColorStop(0, `rgba(201,146,53,${0.88 + current[i] * 0.12})`);
        grad.addColorStop(0.5, 'rgba(180,110,28,0.65)');
        grad.addColorStop(1, 'rgba(90,44,8,0.28)');
        bc.fillStyle = grad;
        bc.fillRect(x, y, barW, h);
        bc.fillStyle = `rgba(255,220,120,${Math.min(1, current[i] * 2.2)})`;
        bc.fillRect(x, y, barW, 1.5);
      }

      // ── Progress bar (loop position) ─────────────────────────────────────
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const audioEl = (engine as any)?.audio as HTMLAudioElement | undefined;
      if (progressFillRef.current && progressDotRef.current && audioEl?.duration) {
        const pct = (audioEl.currentTime / audioEl.duration) * 100;
        progressFillRef.current.style.width = `${pct}%`;
        progressDotRef.current.style.left = `${pct}%`;
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [open, presetIdx, muted]);

  const prev = () => applyPreset((presetIdx - 1 + PRESETS.length) % PRESETS.length);
  const next = () => applyPreset((presetIdx + 1) % PRESETS.length);

  const toggleMute = () => {
    const e = getEngine();
    if (!e) return;
    e.toggleMute();
    setMuted(!!e.muted);
  };

  const onVolume = (v: number) => {
    setVolume(v);
    const e = getEngine();
    if (e) e.setVolume(v);
  };

  const preset = PRESETS[presetIdx];

  return (
    <>
      <style>{CSS}</style>

      {/* Trigger pill — top left */}
      <button className="sc-trigger" onClick={() => setOpen(o => !o)} aria-label="Sound console">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {muted
            ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
            : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></>
          }
        </svg>
        <span>acoustic</span>
      </button>

      {open && (
        <div className="sc-panel">

          {/* Left sidebar */}
          <div className="sc-sidebar">
            <button className={`sc-icon ${view === 'main' ? 'sc-icon--active' : ''}`} onClick={() => setView('main')} title="Now playing">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>
            </button>
            <button className={`sc-icon ${view === 'library' ? 'sc-icon--active' : ''}`} onClick={() => setView('library')} title="Sound modes">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button className="sc-icon" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                {muted
                  ? <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                  : <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                }
              </svg>
            </button>
            <button className="sc-icon" onClick={() => setOpen(false)} title="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Main view */}
          {view === 'main' && (
            <div className="sc-body">

              {/* Viz + track info */}
              <div className="sc-top-row">
                <canvas ref={vizRef} className="sc-viz-circle" />
                <div className="sc-track">
                  <div className="sc-track-name">{preset.name}</div>
                  <div className="sc-track-sub">{preset.subtitle}</div>
                  <div className="sc-track-meta">ambient · loop · {PRESETS.length} modes</div>
                </div>
              </div>

              {/* Frequency bars */}
              <div className="sc-bars-wrap">
                <canvas ref={barsRef} className="sc-bars" />
              </div>

              {/* Progress */}
              <div className="sc-progress-rail">
                <div className="sc-progress-fill" ref={progressFillRef} />
                <div className="sc-progress-dot" ref={progressDotRef} />
              </div>

              {/* Transport + volume */}
              <div className="sc-controls">
                <button className="sc-btn" onClick={prev} title="Previous mode">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
                </button>
                <button className="sc-play" onClick={toggleMute} title={muted ? 'Play' : 'Pause'}>
                  {muted
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  }
                </button>
                <button className="sc-btn" onClick={next} title="Next mode">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                </button>
                <div className="sc-vol">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.45 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
                  <input className="sc-vol-slider" type="range" min={0} max={1} step={0.01} value={volume}
                    onChange={e => onVolume(parseFloat(e.target.value))} />
                </div>
              </div>

            </div>
          )}

          {/* Library view */}
          {view === 'library' && (
            <div className="sc-library">
              <div className="sc-lib-heading">Sound Modes</div>
              {PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  className={`sc-lib-row ${i === presetIdx ? 'sc-lib-row--active' : ''}`}
                  onClick={() => { applyPreset(i); setView('main'); }}
                >
                  <span className="sc-lib-name">{p.name}</span>
                  <span className="sc-lib-sub">{p.subtitle}</span>
                </button>
              ))}
            </div>
          )}

        </div>
      )}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
.sc-trigger {
  position: fixed;
  top: 18px; left: 18px;
  z-index: 9300;
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px;
  border-radius: 24px;
  border: 1px solid rgba(201,146,53,.22);
  background: rgba(16,12,8,.60);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: rgba(201,146,53,.85);
  font-size: 11px;
  letter-spacing: .08em;
  font-family: inherit;
  cursor: pointer;
  transition: background .2s, border-color .2s;
}
.sc-trigger:hover {
  background: rgba(30,20,8,.82);
  border-color: rgba(201,146,53,.46);
}

.sc-panel {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9200;
  width: clamp(420px, 60vw, 600px);
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.06);
  background: rgba(16,12,8,.13);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow:
    0 48px 120px rgba(0,0,0,.85),
    0 24px 48px rgba(0,0,0,.60),
    0 8px 16px rgba(0,0,0,.40),
    0 0 0 .5px rgba(200,148,52,.08),
    inset 0 1px 0 rgba(255,255,255,.07),
    inset 0 -1px 0 rgba(0,0,0,.50),
    inset 1px 0 0 rgba(255,255,255,.03);
  display: flex;
  overflow: hidden;
}

/* Sidebar */
.sc-sidebar {
  width: 50px;
  border-right: 1px solid rgba(255,255,255,.05);
  display: flex; flex-direction: column; align-items: center;
  gap: 4px; padding: 16px 0; flex-shrink: 0;
}
.sc-icon {
  width: 36px; height: 36px;
  border-radius: 8px; border: none;
  background: transparent;
  color: rgba(201,146,53,.40);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background .18s, color .18s;
}
.sc-icon:hover { background: rgba(201,146,53,.08); color: rgba(201,146,53,.9); }
.sc-icon--active { background: rgba(201,146,53,.12); color: #c99235; }

/* Main body */
.sc-body {
  flex: 1; display: flex; flex-direction: column;
  padding: 16px 18px 14px; gap: 11px; min-width: 0;
}
.sc-top-row {
  display: flex; align-items: center; gap: 16px;
}
.sc-viz-circle {
  width: 96px; height: 96px;
  border-radius: 50%; flex-shrink: 0; display: block;
}
.sc-track { flex: 1; min-width: 0; }
.sc-track-name {
  font-size: 15px; font-weight: 600;
  color: rgba(255,240,200,.92);
  letter-spacing: .01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sc-track-sub {
  font-size: 11px; color: rgba(201,146,53,.70);
  margin-top: 2px; letter-spacing: .05em;
}
.sc-track-meta {
  font-size: 10px; color: rgba(255,255,255,.22);
  margin-top: 5px; letter-spacing: .08em; text-transform: uppercase;
}

/* Bars */
.sc-bars-wrap { width: 100%; height: 52px; }
.sc-bars { width: 100%; height: 100%; display: block; }

/* Progress */
.sc-progress-rail {
  position: relative; height: 2px;
  background: rgba(255,255,255,.08); border-radius: 1px;
}
.sc-progress-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, rgba(201,146,53,.45), #c99235);
  border-radius: 1px; width: 0%;
}
.sc-progress-dot {
  position: absolute; top: 50%;
  transform: translate(-50%, -50%);
  width: 8px; height: 8px; border-radius: 50%;
  background: #c99235;
  box-shadow: 0 0 6px rgba(201,146,53,.8);
  left: 0%;
}

/* Controls */
.sc-controls {
  display: flex; align-items: center; gap: 8px;
}
.sc-btn {
  width: 32px; height: 32px; border: none;
  background: transparent; color: rgba(201,146,53,.55);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; border-radius: 6px;
  transition: color .18s, background .18s;
}
.sc-btn:hover { color: #c99235; background: rgba(201,146,53,.08); }
.sc-play {
  width: 40px; height: 40px; border-radius: 50%;
  border: 1px solid rgba(201,146,53,.35);
  background: rgba(201,146,53,.10); color: #c99235;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background .18s, border-color .18s;
}
.sc-play:hover { background: rgba(201,146,53,.20); border-color: rgba(201,146,53,.60); }
.sc-vol {
  display: flex; align-items: center; gap: 6px; flex: 1;
  color: rgba(201,146,53,.45);
}
.sc-vol-slider {
  flex: 1; -webkit-appearance: none;
  height: 2px; background: rgba(255,255,255,.10);
  border-radius: 1px; outline: none; cursor: pointer;
}
.sc-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px; height: 10px; border-radius: 50%;
  background: #c99235; cursor: pointer;
  box-shadow: 0 0 5px rgba(201,146,53,.6);
}

/* Library */
.sc-library {
  flex: 1; padding: 16px 18px;
  display: flex; flex-direction: column; gap: 4px;
  overflow-y: auto; overscroll-behavior: contain;
}
.sc-lib-heading {
  font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(201,146,53,.5); margin-bottom: 6px;
}
.sc-lib-row {
  display: flex; align-items: baseline; gap: 10px;
  padding: 8px 10px; border-radius: 8px;
  border: 1px solid transparent; background: transparent;
  cursor: pointer; text-align: left;
  transition: background .14s, border-color .14s;
}
.sc-lib-row:hover { background: rgba(201,146,53,.07); }
.sc-lib-row--active {
  background: rgba(201,146,53,.10);
  border-color: rgba(201,146,53,.25);
}
.sc-lib-name { font-size: 13px; color: rgba(255,240,200,.85); font-weight: 500; }
.sc-lib-sub { font-size: 11px; color: rgba(201,146,53,.55); }
`;
