'use client';
import React, { useEffect, useRef } from 'react';

// ============================================================
// VYAN Concierge — Bright Neural Field (canvas 2D)
// Ported from the user-supplied HTML code, scaled to fit the
// floating concierge orb container.
// ============================================================

type Props = { size?: number };

export default function ConciergePlexusCanvas({ size = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    let w = size;
    let h = size;
    let cx = w * 0.5;
    let cy = h * 0.5;
    const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.5);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale the radii to fit the orb container.
    const SCALE = size / 320;
    const layers: Array<{
      radius: number; amp: number; density: number; speed: number;
      phase: number; alpha: number; thickness: number; twist: number;
    }> = [];
    for (let i = 0; i < 52; i++) {
      layers.push({
        radius: (40 + Math.random() * 70) * SCALE,
        amp: (18 + Math.random() * 28) * SCALE,
        density: 1.5 + Math.random() * 3.2,
        speed: 0.00028 + Math.random() * 0.00055,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.04 + Math.random() * 0.04,
        thickness: (0.45 + Math.random() * 0.9) * Math.max(0.5, SCALE),
        twist: 0.8 + Math.random() * 1.6,
      });
    }

    let last = performance.now();

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);
      let dt = now - last;
      if (dt > 32) dt = 32;
      last = now;

      // Clean fade
      ctx.fillStyle = 'rgba(1,2,8,0.10)';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      const driftX = Math.sin(now * 0.00008) * 6 + Math.cos(now * 0.00012) * 4;
      const driftY = Math.cos(now * 0.00005) * 4;
      ctx.translate(cx + driftX, cy + driftY);
      ctx.globalCompositeOperation = 'lighter';

      layers.forEach((l, index) => {
        ctx.beginPath();
        const rot = now * l.speed + l.phase;
        for (let i = 0; i <= 220; i++) {
          const p = i / 220;
          const a = p * Math.PI * 2;
          const wave1 = Math.sin(a * l.density + rot) * l.amp;
          const wave2 = Math.cos(a * (l.density * 0.7) - rot * 1.2) * (l.amp * 0.4);
          const radius = l.radius + wave1 + wave2;
          const spiral = Math.sin(rot + a * l.twist) * 15 * SCALE;
          const x = Math.cos(a) * radius + Math.cos(a * 2.4 + rot) * spiral;
          const y = Math.sin(a) * radius * 0.42 + Math.sin(a * 1.8 - rot) * spiral * 0.5;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const blue = 190 + Math.sin(now * 0.0008 + index) * 45;
        const cyan = 120 + Math.sin(now * 0.0012 + index) * 50;
        ctx.strokeStyle = `rgba(0, ${cyan}, ${blue}, ${l.alpha})`;
        ctx.lineWidth = l.thickness;
        ctx.stroke();
      });

      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  return <canvas ref={canvasRef} className="concierge-plexus-canvas" aria-hidden="true" />;
}
