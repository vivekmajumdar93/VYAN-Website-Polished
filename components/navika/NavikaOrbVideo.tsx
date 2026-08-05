'use client';

import { useEffect, useRef, useState } from 'react';

type OrbState = 'idle' | 'left' | 'right';

interface NavikaOrbVideoProps {
  size?: number;
  /** A = forward clip (left-looking) */
  forwardSrc?: string;
  /** B = reversed clip (right-looking) */
  reversedSrc?: string;
}

const DEFAULT_FORWARD  = '/videos/navika-orb-forward.mp4';
const DEFAULT_REVERSED = '/videos/navika-orb-reversed.mp4';

// Idle ping-pong: seamless crossfade between A and B (wrapper stays fully visible)
const PING_CF_LEAD = 0.3;   // video-seconds before end to start crossfade
const PING_CF_MS   = 180;   // crossfade duration (ms)

const IDLE_RATE    = 0.45;
const ACTIVE_RATE  = 1.0;
const IDLE_TIMEOUT = 2000;  // ms without pointer → back to idle

// Cinematic dissolve — fires ONLY on state transitions (idle↔left/right)
const FADE_OUT_MS  = 450;
const FADE_HOLD_MS = 80;
const FADE_IN_MS   = 600;

// ── mix-blend-mode:screen lives on the ANCHOR, not the videos ─────────────────
// The anchor is the compositing-group root. Its entire rendered content (black
// video background + glowing orb pixels) gets screen-blended against the real
// page. Black → shows page through. Works on any surface: panels, void, glass.
// Putting screen on the videos instead fails because the first video composites
// against a transparent group backdrop (source-over), not the real page, so
// black remains opaque inside the group before the group is drawn normally.
const VIDEO_FILTER = 'brightness(1.4) saturate(1.5) contrast(1.08)';

export default function NavikaOrbVideo({
  size = 88,
  forwardSrc  = DEFAULT_FORWARD,
  reversedSrc = DEFAULT_REVERSED,
}: NavikaOrbVideoProps) {
  // ── Position: anchor (fixed) manages left/right; wrapper manages float anim ──
  const anchorRef  = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const aRef       = useRef<HTMLVideoElement>(null);
  const bRef       = useRef<HTMLVideoElement>(null);

  // null = center; 'left' = top-left corner; 'right' = top-right corner
  const [panelCorner, setPanelCorner] = useState<'left' | 'right' | null>(null);

  // Video state machine
  const orbState  = useRef<OrbState>('idle');
  const active    = useRef<'a' | 'b'>('a');
  const cBusy     = useRef(false);
  const cPending  = useRef<(() => void) | null>(null);
  const pingBusy  = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Panel-state listener ──────────────────────────────────────────────────────
  // Panels dispatch { open: bool, corner?: 'left'|'right' }.
  // corner = which corner Navika should occupy (opposite of where the panel is).
  // Default corner when not specified: 'right'.
  useEffect(() => {
    function onPanelState(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.open) {
        setPanelCorner(detail.corner ?? 'right');
      } else {
        setPanelCorner(null);
      }
    }
    window.addEventListener('vyan:panel-state', onPanelState);
    return () => window.removeEventListener('vyan:panel-state', onPanelState);
  }, []);

  // ── Video logic ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const a = aRef.current!;
    const b = bRef.current!;
    const w = wrapperRef.current!;

    // Idle ping-pong: seamless crossfade — wrapper stays at full opacity
    function pingFade(incoming: HTMLVideoElement, outgoing: HTMLVideoElement, next: 'a' | 'b') {
      if (pingBusy.current) return;
      pingBusy.current = true;
      incoming.currentTime = 0;
      incoming.play().catch(() => {});
      incoming.style.transition = `opacity ${PING_CF_MS}ms ease`;
      outgoing.style.transition  = `opacity ${PING_CF_MS}ms ease`;
      incoming.style.opacity = '1';
      outgoing.style.opacity  = '0';
      active.current = next;
      setTimeout(() => {
        outgoing.pause();
        pingBusy.current = false;
      }, PING_CF_MS + 50);
    }

    // Cinematic dissolve: fades the whole orb out/in around a state switch
    function cinematicSwitch(switchFn: () => void) {
      if (cBusy.current) { cPending.current = switchFn; return; }
      _doFade(switchFn);
    }
    function _doFade(switchFn: () => void) {
      cBusy.current = true;
      w.style.transition = `opacity ${FADE_OUT_MS}ms ease-in`;
      w.style.opacity = '0';
      setTimeout(() => {
        const fn = cPending.current ?? switchFn;
        cPending.current = null;
        fn();
        w.style.transition = `opacity ${FADE_IN_MS}ms ease-out`;
        w.style.opacity = '1';
        setTimeout(() => {
          cBusy.current = false;
          const pending = cPending.current;
          if (pending) { cPending.current = null; _doFade(pending); }
        }, FADE_IN_MS + 50);
      }, FADE_OUT_MS + FADE_HOLD_MS);
    }

    // Raw switches (run while orb is invisible)
    function rawShowA(loop: boolean, rate: number) {
      b.pause(); b.style.opacity = '0'; b.loop = false;
      a.loop = loop; a.playbackRate = rate; b.playbackRate = rate;
      a.currentTime = 0; a.style.opacity = '1';
      a.play().catch(() => {}); active.current = 'a';
    }
    function rawShowB(loop: boolean, rate: number) {
      a.pause(); a.style.opacity = '0'; a.loop = false;
      b.loop = loop; b.playbackRate = rate; a.playbackRate = rate;
      b.currentTime = 0; b.style.opacity = '1';
      b.play().catch(() => {}); active.current = 'b';
    }

    // State transitions
    // A = forward = left-looking; B = reversed = right-looking
    function goLeft() {
      if (orbState.current === 'left' && !cBusy.current) return;
      orbState.current = 'left';
      cinematicSwitch(() => rawShowA(true, ACTIVE_RATE));
    }
    function goRight() {
      if (orbState.current === 'right' && !cBusy.current) return;
      orbState.current = 'right';
      cinematicSwitch(() => rawShowB(true, ACTIVE_RATE));
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

    function onPointer(e: PointerEvent) {
      resetIdleTimer();
      if (e.clientX < window.innerWidth / 2) goLeft();
      else goRight();
    }
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('pointerdown', onPointer);

    // Idle ping-pong timeupdate
    function onATime() {
      if (active.current !== 'a' || orbState.current !== 'idle') return;
      if (pingBusy.current || cBusy.current) return;
      if (!isFinite(a.duration) || a.duration < 0.5) return;
      const r = a.duration - a.currentTime;
      if (r > 0 && r < PING_CF_LEAD) pingFade(b, a, 'b');
    }
    function onBTime() {
      if (active.current !== 'b' || orbState.current !== 'idle') return;
      if (pingBusy.current || cBusy.current) return;
      if (!isFinite(b.duration) || b.duration < 0.5) return;
      const r = b.duration - b.currentTime;
      if (r > 0 && r < PING_CF_LEAD) pingFade(a, b, 'a');
    }
    a.addEventListener('timeupdate', onATime);
    b.addEventListener('timeupdate', onBTime);

    // Init: idle, A playing slowly
    a.style.opacity = '1'; b.style.opacity = '0';
    a.playbackRate = IDLE_RATE; b.playbackRate = IDLE_RATE;
    a.loop = false; b.loop = false;
    active.current = 'a'; orbState.current = 'idle';
    a.play().catch(() => {});

    return () => {
      a.removeEventListener('timeupdate', onATime);
      b.removeEventListener('timeupdate', onBTime);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onPointer);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Anchor position: center (null), top-left ('left'), or top-right ('right')
  let anchorTranslate: string;
  if (panelCorner === 'left') {
    anchorTranslate = 'translateX(16px)';
  } else if (panelCorner === 'right') {
    anchorTranslate = `translateX(calc(100vw - ${size + 16}px))`;
  } else {
    anchorTranslate = `translateX(calc(50vw - ${size / 2}px))`;
  }

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    // No mix-blend-mode here — it goes on the anchor so the entire
    // rendered group (including opaque black video pixels) is screen-blended
    // against the real page, making black transparent on any surface.
    filter: VIDEO_FILTER,
  };

  return (
    // Anchor: fixed position + slide between corners
    // mix-blend-mode:screen here composites the whole anchor group against the page:
    // black pixels in the rendered video → show whatever is behind Navika.
    <div
      ref={anchorRef}
      style={{
        position: 'fixed',
        top: 16,
        left: 0,
        zIndex: 250,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        transform: anchorTranslate,
        transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Wrapper: handles float bob animation + cinematic opacity fade */}
      <div
        ref={wrapperRef}
        className="navika-orb-float"
        style={{
          position: 'relative',
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <video ref={aRef} src={forwardSrc}  muted playsInline preload="auto" style={videoStyle} />
        <video ref={bRef} src={reversedSrc} muted playsInline preload="auto" style={videoStyle} />
      </div>
    </div>
  );
}
