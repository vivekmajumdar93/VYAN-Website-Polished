'use client';
import { useEffect, useState } from 'react';

function getEngine() {
  if (typeof window === 'undefined') return null;
  return (window as any).__vyan?.audio ?? null;
}

export default function AcousticConsoleWrapper() {
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.78);

  useEffect(() => {
    const poll = () => {
      const e = getEngine();
      if (e) { setMuted(!!e.muted); setVolume(e.volume ?? 0.78); }
      else setTimeout(poll, 300);
    };
    poll();
  }, []);

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

  return (
    <div style={{
      position: 'fixed',
      top: 18,
      left: 18,
      zIndex: 9400,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 10px 6px 8px',
      borderRadius: 24,
      border: '1px solid rgba(255,255,255,0.10)',
      background: 'rgba(10,8,6,0.55)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>

      {/* Mute toggle */}
      <button
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
        style={{
          width: 28,
          height: 28,
          border: 'none',
          background: 'transparent',
          color: muted ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.75)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'color 0.2s',
          padding: 0,
        }}
      >
        {muted ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        )}
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={e => onVolume(parseFloat(e.target.value))}
        aria-label="Volume"
        className="vyan-vol"
        style={{
          width: 72,
          height: 2,
          WebkitAppearance: 'none',
          appearance: 'none',
          background: `linear-gradient(to right, rgba(255,255,255,${muted ? 0.18 : 0.65}) ${volume * 100}%, rgba(255,255,255,0.12) ${volume * 100}%)`,
          borderRadius: 1,
          outline: 'none',
          cursor: 'pointer',
          opacity: muted ? 0.4 : 1,
          transition: 'opacity 0.2s',
        } as React.CSSProperties}
      />

      <style>{`
        .vyan-vol::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.80);
          cursor: pointer;
        }
        .vyan-vol::-moz-range-thumb {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.80);
          border: none;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
