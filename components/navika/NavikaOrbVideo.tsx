'use client';

import { useEffect, useRef, useState } from 'react';

type OrbState = 'idle' | 'left' | 'right';

interface NavikaOrbVideoProps {
  size?: number;
  forwardSrc?: string;
  reversedSrc?: string;
}

const DEFAULT_FORWARD  = '/videos/navika-orb-forward.mp4';
const DEFAULT_REVERSED = '/videos/navika-orb-reversed.mp4';

const PING_CF_LEAD = 0.5;
const PING_CF_MS   = 500;
const IDLE_RATE    = 0.45;
const ACTIVE_RATE  = 1.0;
const IDLE_TIMEOUT = 2000;
const FADE_OUT_MS  = 900;
const FADE_HOLD_MS = 250;
const FADE_IN_MS   = 1400;

const VIDEO_FILTER = 'brightness(1.4) saturate(1.5) contrast(1.08)';

// ── Position behaviour ────────────────────────────────────────────────────────
// Home = top-center. When the user interacts, Navika *leans* slightly toward
// the cursor — she never goes to the cursor itself, only drifts a fraction of
// the distance. After IDLE_TIMEOUT of no activity she drifts back home.
const HOME_Y       = 16;    // px from top when at home
const LEAN_FACTOR  = 0.12;  // 12 % of the cursor-to-home vector
const MAX_LEAN_X   = 110;   // max horizontal drift from home center (px)
const MAX_LEAN_Y   = 65;    // max vertical drift from home (px)
const FOLLOW_LERP  = 0.038; // how fast she moves (lower = dreamier)

// Panel-corner parking (clear of SoundConsole + BACK button on the left side)
const CORNER_LEFT_X  = 16;
const CORNER_LEFT_Y  = 80;
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

  // Panel corner — null means "at home"
  const panelCornerRef = useRef<'left' | 'right' | null>(null);
  const [_panelCorner, setPanelCorner] = useState<'left' | 'right' | null>(null);

  // Cursor tracking (null until first pointer event)
  const pointerX = useRef<number | null>(null);
  const pointerY = useRef<number | null>(null);

  // true = return to home; false = lean toward cursor
  // Starts true (home), cleared on pointer activity, set true again on idle
  const posIdle = useRef(true);

  // Video state machine
  const orbState = useRef<OrbState>('idle');
  const active   = useRef<'a' | 'b'>('a');
  const cBusy    = useRef(false);
  const cPending = useRef<(() => void) | null>(null);
  const pingBusy = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Panel-state listener ──────────────────────────────────────────────────
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

  // ── rAF position loop ─────────────────────────────────────────────────────
  useEffect(() => {
    const anchor = anchorRef.current!;
    let cx = (typeof window !== 'undefined' ? window.innerWidth : 800) / 2 - size / 2;
    let cy = HOME_Y;
    let rafId: number;

    function getTarget() {
      const corner = panelCornerRef.current;
      // On mobile (< 768px), never corner-park — stay at top-center only
      const isMob = window.innerWidth < 768;
      if (!isMob) {
        if (corner === 'left')  return { x: CORNER_LEFT_X,                   y: CORNER_LEFT_Y };
        if (corner === 'right') return { x: window.innerWidth - size - 16,   y: CORNER_RIGHT_Y };
      }

      const homeX = window.innerWidth / 2 - size / 2;

      // Idle, no pointer yet, or inside Vistara (camera provides parallax) → stay home
      if (posIdle.current || pointerX.current === null ||
          window.location.pathname.startsWith('/vistara')) {
        return { x: homeX, y: HOME_Y };
      }

      // Active → lean subtly toward the cursor, never go there
      const homeCenterX = window.innerWidth / 2;
      const homeCenterY = HOME_Y + size / 2;
      const dx = pointerX.current - homeCenterX;
      const dy = pointerY.current! - homeCenterY;
      const leanX = Math.max(-MAX_LEAN_X, Math.min(MAX_LEAN_X, dx * LEAN_FACTOR));
      const leanY = Math.max(-MAX_LEAN_Y, Math.min(MAX_LEAN_Y, dy * LEAN_FACTOR));
      return { x: homeX + leanX, y: HOME_Y + leanY };
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

  // ── Video logic + pointer tracking ───────────────────────────────────────
  useEffect(() => {
    const a = aRef.current!;
    const b = bRef.current!;
    const w = wrapperRef.current!;

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
      setTimeout(() => { outgoing.pause(); pingBusy.current = false; }, PING_CF_MS + 50);
    }

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
      // Return position to home when video goes idle
      posIdle.current = true;
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
      pointerX.current = e.clientX;
      pointerY.current = e.clientY;
      posIdle.current = false; // user is active → lean toward cursor
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
    mixBlendMode: 'screen',
  };

  return (
    <div
      ref={anchorRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 250,
        pointerEvents: 'none',
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
