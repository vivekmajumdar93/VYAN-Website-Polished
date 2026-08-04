'use client';

import { useEffect, useRef } from 'react';

interface NavikaOrbVideoProps {
  /** Diameter in px. Every placement passes its own — see integration notes below. */
  size: number;
  className?: string;
  style?: React.CSSProperties;
  forwardSrc?: string;
  reversedSrc?: string;
}

const DEFAULT_FORWARD = '/videos/navika-orb-forward.mp4';
const DEFAULT_REVERSED = '/videos/navika-orb-reversed.mp4';

/**
 * Site-wide replacement for the static Navika orb graphic.
 *
 * Playback: two clips (forward + a frame-exact reversed twin) alternate on
 * `ended` so it reads as one continuous forward/backward loop with no
 * native-reverse stutter and no visible seam — the reversed clip's first
 * frame is the forward clip's last frame.
 *
 * Look: source video sits on black. Since the entire VYAN void is pure
 * black, `mix-blend-mode: screen` drops the black background out
 * perfectly with zero alpha-channel encoding — and screen blend itself
 * brightens, which combined with the filter boost below is what makes
 * this read as vibrant rather than a dim video rectangle. If any
 * placement sits on a non-black surface (a glass panel, a lighter
 * gradient), swap that instance to a pre-authored alpha-channel export
 * (ProRes 4444 / WebM VP9 with alpha) instead — screen blend will show a
 * black halo there.
 */
export default function NavikaOrbVideo({
  size,
  className,
  style,
  forwardSrc = DEFAULT_FORWARD,
  reversedSrc = DEFAULT_REVERSED,
}: NavikaOrbVideoProps) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    a.style.opacity = '1';
    b.style.opacity = '0';
    a.currentTime = 0;
    a.play().catch(() => {});

    function onAEnded() {
      b!.currentTime = 0;
      b!.play().catch(() => {});
      a!.style.opacity = '0';
      b!.style.opacity = '1';
    }
    function onBEnded() {
      a!.currentTime = 0;
      a!.play().catch(() => {});
      b!.style.opacity = '0';
      a!.style.opacity = '1';
    }

    a.addEventListener('ended', onAEnded);
    b.addEventListener('ended', onBEnded);
    return () => {
      a.removeEventListener('ended', onAEnded);
      b.removeEventListener('ended', onBEnded);
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
      className={className}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0, // never let a flex parent squeeze it into overlap
        pointerEvents: 'none',
        filter: 'brightness(1.4) saturate(1.5) contrast(1.08) drop-shadow(0 0 ' +
          Math.round(size * 0.12) +
          'px rgba(160,110,255,0.55))',
        ...style,
      }}
    >
      <video ref={aRef} src={forwardSrc} muted playsInline preload="auto" style={videoStyle} />
      <video ref={bRef} src={reversedSrc} muted playsInline preload="auto" style={videoStyle} />
    </div>
  );
}
