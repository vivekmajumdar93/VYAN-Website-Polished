'use client';
import { useEffect, useState } from 'react';

function getEngine() {
  if (typeof window === 'undefined') return null;
  return (window as any).__vyan?.audio ?? null;
}

export default function AcousticConsoleWrapper() {
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const poll = () => {
      const e = getEngine();
      if (e) setMuted(!!e.muted);
      else setTimeout(poll, 300);
    };
    poll();
  }, []);

  const toggle = () => {
    const e = getEngine();
    if (!e) return;
    e.toggleMute();
    setMuted(!!e.muted);
  };

  return (
    <button
      onClick={toggle}
      aria-label={muted ? 'Unmute' : 'Mute'}
      style={{
        position: 'fixed',
        top: 18,
        left: 18,
        zIndex: 9400,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(10,8,6,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        color: muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.75)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.2s, border-color 0.2s',
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
  );
}
