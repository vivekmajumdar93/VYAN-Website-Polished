'use client';

import { useEffect, useRef } from 'react';

type OrbState = 'idle' | 'left' | 'right';

interface NavikaOrbVideoProps {
  size: number;
  className?: string;
  style?: React.CSSProperties;
  /** A = forward clip (right-looking) */
  forwardSrc?: string;
  /** B = reversed clip (left-looking) */
  reversedSrc?: string;
}

const DEFAULT_FORWARD  = '/videos/navika-orb-forward.mp4';
const DEFAULT_REVERSED = '/videos/navika-orb-reversed.mp4';

// Idle ping-pong: how many video-seconds before clip end to begin the fade
const IDLE_FADE_LEAD = 0.55;

// Slow-motion rate for idle breathe; normal speed for directional
const IDLE_RATE    = 0.45;
const ACTIVE_RATE  = 1.0;

// After N ms of no pointer activity → drift back to idle
const IDLE_TIMEOUT = 2000;

// Cinematic fade timings (ms)
const FADE_OUT_MS  = 450;
const FADE_HOLD_MS = 80;   // black hold between out and in
const FADE_IN_MS   = 600;

export default function NavikaOrbVideo({
  size,
  className,
  style,
  forwardSrc  = DEFAULT_FORWARD,
  reversedSrc = DEFAULT_REVERSED,
}: NavikaOrbVideoProps) {
  const aRef       = useRef<HTMLVideoElement>(null);
  const bRef       = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const orbState   = useRef<OrbState>('idle');
  const active     = useRef<'a' | 'b'>('a');
  // Cinematic engine
  const cBusy      = useRef(false);
  const cPending   = useRef<(() => void) | null>(null);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const a = aRef.current!;
    const b = bRef.current!;
    const w = wrapperRef.current!;

    // ── Cinematic fade engine ─────────────────────────────────────────
    // Fades the whole orb to black, runs switchFn while invisible,
    // then fades back in. Latest queued switchFn always wins.
    function cinematicSwitch(switchFn: () => void) {
      if (cBusy.current) {
        cPending.current = switchFn; // overwrite with latest intent
        return;
      }
      _doFade(switchFn);
    }

    function _doFade(switchFn: () => void) {
      cBusy.current = true;
      w.style.transition = `opacity ${FADE_OUT_MS}ms ease-in`;
      w.style.opacity = '0';

      setTimeout(() => {
        // Apply the latest intent (may have changed during fade-out)
        const fn = cPending.current ?? switchFn;
        cPending.current = null;
        fn();

        w.style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
        w.style.opacity = '1';

        setTimeout(() => {
          cBusy.current = false;
          const pending = cPending.current;
          if (pending) {
            cPending.current = null;
            _doFade(pending);
          }
        }, FADE_IN_MS + 50);
      }, FADE_OUT_MS + FADE_HOLD_MS);
    }

    // ── Raw video switches (run while orb is invisible) ───────────────
    function rawShowA(loop: boolean, rate: number) {
      b.pause();
      b.style.opacity = '0';
      b.loop = false;
      a.loop = loop;
      a.playbackRate = rate;
      b.playbackRate = rate;
      a.currentTime = 0;
      a.style.opacity = '1';
      a.play().catch(() => {});
      active.current = 'a';
    }

    function rawShowB(loop: boolean, rate: number) {
      a.pause();
      a.style.opacity = '0';
      a.loop = false;
      b.loop = loop;
      b.playbackRate = rate;
      a.playbackRate = rate;
      b.currentTime = 0;
      b.style.opacity = '1';
      b.play().catch(() => {});
      active.current = 'b';
    }

    // ── State transitions ─────────────────────────────────────────────
    function goLeft() {
      if (orbState.current === 'left' && !cBusy.current) return;
      orbState.current = 'left';
      cinematicSwitch(() => rawShowB(true, ACTIVE_RATE));
    }

    function goRight() {
      if (orbState.current === 'right' && !cBusy.current) return;
      orbState.current = 'right';
      cinematicSwitch(() => rawShowA(true, ACTIVE_RATE));
    }

    function goIdle() {
      if (orbState.current === 'idle') return;
      const wasOnB = active.current === 'b';
      orbState.current = 'idle';
      cinematicSwitch(() => {
        if (wasOnB) rawShowB(false, IDLE_RATE);
        else rawShowA(false, IDLE_RATE);
      });
    }

    function resetIdleTimer() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(goIdle, IDLE_TIMEOUT);
    }

    // ── Global pointer tracking ───────────────────────────────────────
    function onPointer(e: PointerEvent) {
      resetIdleTimer();
      if (e.clientX < window.innerWidth / 2) goLeft();
      else goRight();
    }

    window.addEventListener('pointermove', onPointer);
    window.addEventListener('pointerdown', onPointer);

    // ── Idle ping-pong (timeupdate) ───────────────────────────────────
    // Near the end of each idle clip, cinematically dissolve to the other.
    function onATime() {
      if (active.current !== 'a' || orbState.current !== 'idle' || cBusy.current) return;
      const r = a.duration - a.currentTime;
      if (r > 0 && r < IDLE_FADE_LEAD) {
        a.pause(); // freeze so clip doesn't end before we switch
        cinematicSwitch(() => {
          if (orbState.current === 'idle') rawShowB(false, IDLE_RATE);
        });
      }
    }

    function onBTime() {
      if (active.current !== 'b' || orbState.current !== 'idle' || cBusy.current) return;
      const r = b.duration - b.currentTime;
      if (r > 0 && r < IDLE_FADE_LEAD) {
        b.pause();
        cinematicSwitch(() => {
          if (orbState.current === 'idle') rawShowA(false, IDLE_RATE);
        });
      }
    }

    a.addEventListener('timeupdate', onATime);
    b.addEventListener('timeupdate', onBTime);

    // ── Init: idle, A playing slowly ──────────────────────────────────
    a.style.opacity = '1';
    b.style.opacity = '0';
    a.playbackRate = IDLE_RATE;
    b.playbackRate = IDLE_RATE;
    a.loop = false;
    b.loop = false;
    active.current = 'a';
    orbState.current = 'idle';
    a.play().catch(() => {});

    return () => {
      a.removeEventListener('timeupdate', onATime);
      b.removeEventListener('timeupdate', onBTime);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    mixBlendMode: 'screen',
  };

  return (
    <div
      ref={wrapperRef}
      className={`navika-orb-float${className ? ` ${className}` : ''}`}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
        pointerEvents: 'none',
        filter: 'brightness(1.4) saturate(1.5) contrast(1.08)',
        ...style,
      }}
    >
      <video ref={aRef} src={forwardSrc}  muted playsInline preload="auto" style={videoStyle} />
      <video ref={bRef} src={reversedSrc} muted playsInline preload="auto" style={videoStyle} />
    </div>
  );
}
