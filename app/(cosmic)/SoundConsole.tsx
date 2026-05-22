'use client';

import React, { useEffect, useRef, useState } from 'react';
import './soundconsole.css';

// ============================================================
// VYAN — Acoustic Console (unified, modern, futuristic).
// One single console contains: power toggle, master amplitude,
// atmospheric resonance, transmission active indicator. Replaces
// the old "SOUND OFF" + Acoustic Logic panel duplication.
// ============================================================

const KEY_ON = 'vyan.sound.on';
const KEY_VOL = 'vyan.sound.vol';
const KEY_RES = 'vyan.sound.res';

export default function SoundConsole() {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(0.5);
  const [resonance, setResonance] = useState(0.35);
  const [tx, setTx] = useState(false);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const o = localStorage.getItem(KEY_ON);
      const v = localStorage.getItem(KEY_VOL);
      const r = localStorage.getItem(KEY_RES);
      if (o) setOn(o === '1');
      if (v) setVol(Math.max(0, Math.min(1, parseFloat(v))));
      if (r) setResonance(Math.max(0, Math.min(1, parseFloat(r))));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY_ON, on ? '1' : '0'); window.dispatchEvent(new CustomEvent('vyan:sound', { detail: { on, vol, resonance } })); } catch {} }, [on, vol, resonance]);
  useEffect(() => { try { localStorage.setItem(KEY_VOL, String(vol)); } catch {} }, [vol]);
  useEffect(() => { try { localStorage.setItem(KEY_RES, String(resonance)); } catch {} }, [resonance]);

  // Simulated transmission indicator (flickers when on + vol)
  useEffect(() => {
    if (!on) { setTx(false); return; }
    const id = setInterval(() => setTx(Math.random() > 0.4), 1100);
    return () => clearInterval(id);
  }, [on]);

  // Click-outside-close
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!consoleRef.current) return;
      if (!consoleRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc, { capture: true });
    return () => document.removeEventListener('pointerdown', onDoc, { capture: true } as any);
  }, [open]);

  return (
    <div className={`vac-root ${open ? 'is-open' : ''} ${on ? 'is-on' : ''}`} ref={consoleRef}>
      {/* Trigger badge (top-left, always visible). Replaces the old SOUND OFF button. */}
      <button type="button" className="vac-trigger" onClick={() => setOpen(v => !v)} aria-label="Acoustic Console">
        <span className="vac-trigger__wave">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="vac-trigger__bar" style={{ ['--i' as any]: i }} />
          ))}
        </span>
        <span className="vac-trigger__label">acoustic</span>
        <span className={`vac-trigger__dot ${on ? 'is-on' : ''}`} />
      </button>

      {/* The console panel */}
      <div className="vac-panel" role="dialog" aria-label="Acoustic Console">
        <header className="vac-panel__head">
          <div className="vac-panel__title">
            <span className="vac-panel__glyph">✵</span>
            <span>Acoustic Console</span>
          </div>
          <button className="vac-panel__close" onClick={() => setOpen(false)} aria-label="close">✕</button>
        </header>

        {/* Power */}
        <section className="vac-row vac-row--power">
          <div className="vac-row__label">
            <span className="vac-row__k">Resonant Field</span>
            <span className="vac-row__sub">{on ? 'engaged' : 'dormant'}</span>
          </div>
          <button type="button" className={`vac-power ${on ? 'is-on' : ''}`} onClick={() => setOn(v => !v)} aria-pressed={on}>
            <span className="vac-power__core" />
            <span className="vac-power__ring" />
            <span className="vac-power__lbl">{on ? 'On' : 'Off'}</span>
          </button>
        </section>

        {/* Master amplitude */}
        <section className="vac-row">
          <div className="vac-row__label">
            <span className="vac-row__k">Master Amplitude</span>
            <span className="vac-row__v">{Math.round(vol * 100)}</span>
          </div>
          <div className="vac-slider">
            <input type="range" min={0} max={1} step={0.01} value={vol}
                   onChange={(e) => setVol(parseFloat(e.target.value))}
                   disabled={!on} aria-label="Master amplitude" />
            <div className="vac-slider__fill" style={{ width: `${vol * 100}%` }} />
          </div>
        </section>

        {/* Atmospheric resonance */}
        <section className="vac-row">
          <div className="vac-row__label">
            <span className="vac-row__k">Atmospheric Resonance</span>
            <span className="vac-row__v">{Math.round(resonance * 100)}</span>
          </div>
          <div className="vac-slider">
            <input type="range" min={0} max={1} step={0.01} value={resonance}
                   onChange={(e) => setResonance(parseFloat(e.target.value))}
                   disabled={!on} aria-label="Atmospheric resonance" />
            <div className="vac-slider__fill" style={{ width: `${resonance * 100}%` }} />
          </div>
        </section>

        {/* Transmission */}
        <section className="vac-row vac-row--tx">
          <div className="vac-row__label">
            <span className="vac-row__k">Transmission</span>
            <span className="vac-row__sub">{on ? (tx ? 'streaming' : 'idle') : 'silent'}</span>
          </div>
          <div className="vac-tx-vis">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className={`vac-tx-bar ${tx ? 'is-pulse' : ''}`} style={{ ['--i' as any]: i, ['--amp' as any]: on ? vol : 0 }} />
            ))}
          </div>
        </section>

        <footer className="vac-panel__foot">
          <span>Web Audio API · zero external streams</span>
        </footer>
      </div>
    </div>
  );
}
