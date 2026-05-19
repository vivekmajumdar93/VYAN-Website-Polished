'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';

// Loader behavior (per spec):
//   • transparent logo emerges from darkness
//   • breathes twice
//   • fades into darkness BEFORE /vyoma renders
//
// While the loader is on screen, Next.js prefetches /vyoma in the background
// (via router.prefetch), so the transition is instant — supports the
// "cascading preload" requirement for Phase 1 → Phase 2.
export default function LoaderClient() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Begin prefetching the gateway the moment the loader mounts.
    try { router.prefetch('/vyoma'); } catch {}

    const tl = gsap.timeline({
      onComplete: () => router.replace('/vyoma')
    });

    tl.fromTo(
      logoRef.current,
      { opacity: 0, scale: 0.94, filter: 'blur(14px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9, ease: 'sine.out' }
    )
      .fromTo(
        tagRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' },
        '-=0.35'
      )
      // Breath 1
      .to(logoRef.current, {
        scale: 1.07,
        filter: 'drop-shadow(0 0 60px rgba(140,110,255,0.85)) drop-shadow(0 0 120px rgba(80,40,220,0.55))',
        duration: 0.85,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1
      })
      // Breath 2
      .to(logoRef.current, {
        scale: 1.085,
        filter: 'drop-shadow(0 0 70px rgba(160,130,255,0.95)) drop-shadow(0 0 140px rgba(90,50,230,0.65))',
        duration: 0.85,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: 1
      })
      // Fade into the darkness
      .to(wrapRef.current, {
        opacity: 0,
        duration: 1.0,
        ease: 'power2.inOut'
      })
      .to({}, { duration: 0.15 }); // brief breath of black before route push

    return () => {
      tl.kill();
    };
  }, [router]);

  return (
    <div ref={wrapRef} className="vyan-loader">
      <div className="vyan-loader__inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={logoRef}
          className="vyan-loader__logo"
          src="/logo.png"
          alt="VYAN Technologies"
          draggable={false}
        />
        <div ref={tagRef} className="vyan-loader__tag">
          <div className="vyan-loader__brand">VYAN Labs</div>
          <div className="vyan-loader__sub">A Boutique Studio for Cognitive Solutions</div>
        </div>
      </div>
    </div>
  );
}
