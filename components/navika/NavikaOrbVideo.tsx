'use client';

import { useEffect, useRef } from 'react';

interface NavikaOrbVideoProps {
  size: number;
  className?: string;
  style?: React.CSSProperties;
  forwardSrc?: string;
  reversedSrc?: string;
  /** 1.0 = normal speed. Lower = slower/more fluid, Higher = faster cycle. */
  playbackRate?: number;
}

const DEFAULT_FORWARD  = '/videos/navika-orb-forward.mp4';
const DEFAULT_REVERSED = '/videos/navika-orb-reversed.mp4';

// How many seconds before a clip ends to begin the crossfade to the next clip.
// Keeps the seam invisible even if there's a tiny decode delay on the incoming video.
const CROSSFADE_LEAD = 0.12;
const CROSSFADE_MS   = 120;

export default function NavikaOrbVideo({
  size,
  className,
  style,
  forwardSrc  = DEFAULT_FORWARD,
  reversedSrc = DEFAULT_REVERSED,
  playbackRate = 1.0,
}: NavikaOrbVideoProps) {
  const aRef   = useRef<HTMLVideoElement>(null);
  const bRef   = useRef<HTMLVideoElement>(null);
  // which video is currently "active" (fully visible)
  const active = useRef<'a' | 'b'>('a');

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    // Apply playback rate
    a.playbackRate = playbackRate;
    b.playbackRate = playbackRate;

    // Start state: A visible, B ready at frame 0
    a.style.opacity = '1';
    b.style.opacity = '0';
    b.currentTime   = 0;
    active.current  = 'a';
    a.play().catch(() => {});

    let switching = false;

    function switchTo(incoming: HTMLVideoElement, outgoing: HTMLVideoElement, next: 'a' | 'b') {
      if (switching) return;
      switching = true;
      incoming.currentTime = 0;
      incoming.play().catch(() => {});
      // Crossfade: bring incoming up while outgoing fades out
      incoming.style.transition = `opacity ${CROSSFADE_MS}ms ease`;
      outgoing.style.transition = `opacity ${CROSSFADE_MS}ms ease`;
      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';
      active.current = next;
      setTimeout(() => { switching = false; }, CROSSFADE_MS + 50);
    }

    function onATimeUpdate() {
      if (active.current !== 'a') return;
      const remaining = a!.duration - a!.currentTime;
      if (remaining > 0 && remaining < CROSSFADE_LEAD) {
        switchTo(b!, a!, 'b');
      }
    }
    function onBTimeUpdate() {
      if (active.current !== 'b') return;
      const remaining = b!.duration - b!.currentTime;
      if (remaining > 0 && remaining < CROSSFADE_LEAD) {
        switchTo(a!, b!, 'a');
      }
    }

    a.addEventListener('timeupdate', onATimeUpdate);
    b.addEventListener('timeupdate', onBTimeUpdate);
    return () => {
      a.removeEventListener('timeupdate', onATimeUpdate);
      b.removeEventListener('timeupdate', onBTimeUpdate);
    };
  }, [playbackRate]);

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
      className={className}
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
