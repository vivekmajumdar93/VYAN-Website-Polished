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
const PING_CF_LEAD = 0.5;   // video-seconds before end to start crossfade
const PING_CF_MS   = 500;   // crossfade duration (ms)

const IDLE_RATE    = 0.45;
const ACTIVE_RATE  = 1.0;
const IDLE_TIMEOUT = 2000;  // ms without pointer → back to idle

// Cinematic dissolve — fires ONLY on state transitions (idle↔left/right)
const FADE_OUT_MS  = 900;
const FADE_HOLD_MS = 250;
const FADE_IN_MS   = 1400;

// ── mix-blend-mode:screen on the ANCHOR composites the whole group against
// the real page, making black pixels transparent on any surface.
const VIDEO_FILTER = 'brightness(1.4) saturate(1.5) contrast(1.08)';

// ── Cursor-follow: Navika slowly drifts toward the pointer ────────────────────
// LERP = fraction of remaining distance closed per frame (~60fps).
// 0.038 → feels like floating in water; ~1.3s to close 95% of the gap.
const FOLLOW_LERP = 0.038;

// Panel-corner parking positions (clear of ACOUSTIC + BACK buttons on the left)
const CORNER_LEFT_X  = 16;
const CORNER_LEFT_Y  = 80;   // below SoundConsole (top:22+24px) and BACK btn (~60px)
const CORNER_RIGHT_Y = 16;

export default function NavikaOrbVideo({
  size = 88,
  forwardSrc  = DEFAULT_FORWARD,
  reversedSrc = DEFAULT_REVERSED,
}: NavikaOrbVideoProps) {
  const anchorRef  = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const aRef       = useRef<HTMLVideoElement>(null);
  const bRef       = useRef<HTMLVideoElement>(null);

  // Panel corner state + ref (ref so rAF closure always has the latest value)
  const [panelCorner, setPanelCorner] = useState<'left' | 'right' | null>(null);
  const panelCornerRef = useRef<'left' | 'right' | null>(null);

  // Cursor position, updated on every pointermove (null = not yet known)
  const pointerX = useRef<number | null>(null);
  const pointerY = useRef<number | null>(null);

  // Video state machine
  const orbState  = useRef<OrbState>('idle');
  const active    = useRef<'a' | 'b'>('a');
  const cBusy     = useRef(false);
  const cPending  = useRef<(() => void) | null>(null);
  const pingBusy  = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Panel-state listener ───────────────────────────────────────────────────
  useEffect(() => {
    function onPanelState(e: Event) {
      const detail = (e as CustomEvent).detail;
      const corner: 'left' | 'right' | null = detail?.open
        ? (detail.corner ?? 'right')
        : null;
      setPanelCorner(corner);
      panelCornerRef.current = corner;
    }
    window.addEventListener('vyan:panel-state', onPanelState);
    return () => window.removeEventListener('vyan:panel-state', onPanelState);
  }, []);

  // ── rAF cursor-follow loop ─────────────────────────────────────────────────
  // Drives anchor.style.transform directly — no React re-renders, 60fps smooth.
  useEffect(() => {
    const anchor = anchorRef.current!;
    // Start at top-center
    let cx = (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 - size / 2;
    let cy = 16;
    let rafId: number;

    function getTarget() {
      const corner = panelCornerRef.current;
      if (corner === 'left') {
        return { x: CORNER_LEFT_X, y: CORNER_LEFT_Y };
      }
      if (corner === 'right') {
        return { x: window.innerWidth - size - 16, y: CORNER_RIGHT_Y };
      }
      // No panel: follow cursor, clamped inside viewport
      const px = pointerX.current ?? window.innerWidth / 2;
      const py = pointerY.current ?? cy;
      return {
        x: Math.max(8, Math.min(window.innerWidth  - size - 8, px - size / 2)),
        y: Math.max(8, Math.min(window.innerHeight - size - 8, py - size / 2)),
      };
    }

    function tick() {
      const { x: tx, y: ty } = getTarget();
      cx += (tx - cx) * FOLLOW_LERP;
      cy += (ty - cy) * FOLLOW_LERP;
      anchor.style.transform = `translate(${cx}px, ${cy}px)`;
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  // ── Video logic + pointer tracking ────────────────────────────────────────
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
      // Update cursor position for the rAF follow loop
      pointerX.current = e.clientX;
      pointerY.current = e.clientY;
      // Update directional video state
      resetIdleTimer();
      if (e.clientX < window.innerWidth / 2) goLeft();
      else goRight();
    }
    window.addEventListener('pointermove', onPointer);
    window.addEventListener('pointerdown', onPointer);

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

  const videoStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: VIDEO_FILTER,
  };

  return (
    // Anchor: top:0 left:0 — rAF drives translate(x,y) for all movement.
    // mix-blend-mode:screen on the anchor: entire rendered group screen-blended
    // against the real page so black video pixels are always transparent.
    <div
      ref={anchorRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 250,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        // transform set imperatively by rAF — no CSS transition needed
      }}
    >
      <div
        ref={wrapperRef}
        className="navika-orb-float"
        style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      >
        <video ref={aRef} src={forwardSrc}  muted playsInline preload="auto" style={videoStyle} />
        <video ref={bRef} src={reversedSrc} muted playsInline preload="auto" style={videoStyle} />
      </div>
    </div>
  );
}
