'use client';
import React, { useEffect, useRef } from 'react';

// ============================================================
// MEDHĀ — Living Ghost Orb (canvas 2D)
// Ported from the user-supplied HTML code. Renders full-screen
// with humanoid body, flowing ribbons, hair, and a quiet face.
// ============================================================

type Props = {
  hue?: { rComp: number; gComp: number; bComp: number }; // base body colour
  intensity?: number; // 0..1 — sleeping vs awake brightness
  className?: string;
};

export default function MedhaCanvasOrb({ hue, intensity = 1, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let w = canvas.width = innerWidth;
    let h = canvas.height = innerHeight;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';

    const onResize = () => {
      w = canvas.width = innerWidth;
      h = canvas.height = innerHeight;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
    };
    window.addEventListener('resize', onResize, { passive: true });

    let baseScale = Math.max(w, h) * 0.30 / 520;

    const smoothNoise = (t: number, seed: number, frequency = 0.001, amplitude = 1) =>
      Math.sin(t * frequency + seed) * amplitude;

    const noiseSeed1 = Math.random() * 10000;
    const noiseSeed2 = Math.random() * 10000;
    const noiseSeed3 = Math.random() * 10000;

    const ribbons: Array<{ seed: number; speed: number; width: number; alpha: number; phase: number; radius: number; rComp: number }> = [];
    for (let i = 0; i < 8; i++) {
      ribbons.push({
        seed: Math.random() * 1000,
        speed: 0.00015 + Math.random() * 0.0004,
        width: 1.2 + Math.random() * 2.4,
        alpha: 0.12 + Math.random() * 0.18,
        phase: Math.random() * Math.PI * 2,
        radius: 60 + Math.random() * 240,
        rComp: 200 + Math.floor(Math.random() * 55),
      });
    }

    const hairs: Array<{ phase: number; length: number; alpha: number; side: number }> = [];
    for (let i = 0; i < 80; i++) {
      hairs.push({
        phase: Math.random() * Math.PI * 2,
        length: 120 + Math.random() * 220,
        alpha: 0.03 + Math.random() * 0.07,
        side: i % 2 === 0 ? -1 : 1,
      });
    }

    const draw = (t: number) => {
      // Refresh scale and dimensions if window changed
      baseScale = Math.max(w, h) * 0.30 / 520;

      ctx.fillStyle = 'rgba(2,0,1,0.06)';
      ctx.fillRect(0, 0, w, h);

      const drift1X = smoothNoise(t, noiseSeed1, 0.0003, w * 0.25);
      const drift2X = smoothNoise(t, noiseSeed2, 0.0001, w * 0.15);
      const drift3X = smoothNoise(t, noiseSeed3, 0.00005, w * 0.1);
      const drift1Y = smoothNoise(t, noiseSeed1 + 1000, 0.00025, h * 0.25);
      const drift2Y = smoothNoise(t, noiseSeed2 + 1000, 0.00012, h * 0.15);
      const drift3Y = smoothNoise(t, noiseSeed3 + 1000, 0.00006, h * 0.1);

      const orbX = w * 0.5 + drift1X + drift2X + drift3X;
      const orbY = h * 0.5 + drift1Y + drift2Y + drift3Y;
      const floatPulse = Math.sin(t * 0.0008) * 20;

      ctx.save();
      ctx.translate(orbX, orbY + floatPulse);
      ctx.scale(baseScale, baseScale);

      // Aura glow
      const aura = ctx.createRadialGradient(0, 0, 20, 0, 0, 260);
      aura.addColorStop(0, `rgba(220,40,40,${0.25 * intensity})`);
      aura.addColorStop(0.4, `rgba(180,20,20,${0.15 * intensity})`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.ellipse(0, 0, 180, 260, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ribbons
      ctx.globalCompositeOperation = 'screen';
      ctx.shadowBlur = 0;
      for (const r of ribbons) {
        ctx.beginPath();
        for (let i = 0; i < 260; i++) {
          const p = i / 260;
          const a = p * Math.PI * 2.4 + t * r.speed + r.phase;
          const vert = (p - 0.5) * 620;
          const col = 1 - Math.pow(Math.abs(p - 0.5) * 2, 1.6);
          const dis = Math.sin(a * 2.2 + r.seed) * r.radius * 0.18;
          const x = Math.cos(a) * (r.radius * col) + dis * 0.2;
          const y = vert + Math.sin(a * 1.4) * 40;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = r.width;
        ctx.strokeStyle = `rgba(${r.rComp},20,20,${r.alpha * intensity})`;
        ctx.stroke();
      }

      // Body
      const body = ctx.createLinearGradient(0, -260, 0, 320);
      body.addColorStop(0, `rgba(180,50,50,${0.08 * intensity})`);
      body.addColorStop(0.4, `rgba(200,60,60,${0.15 * intensity})`);
      body.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(0, -270);
      ctx.quadraticCurveTo(-110, -230, -100, -80);
      ctx.quadraticCurveTo(-92, -10, -68, 70);
      ctx.quadraticCurveTo(-55, 170, -45, 250);
      ctx.quadraticCurveTo(-120, 430, 0, 560);
      ctx.quadraticCurveTo(120, 430, 45, 250);
      ctx.quadraticCurveTo(55, 170, 68, 70);
      ctx.quadraticCurveTo(92, -10, 100, -80);
      ctx.quadraticCurveTo(110, -230, 0, -270);
      ctx.closePath();
      ctx.fill();

      // Hair
      ctx.globalCompositeOperation = 'lighter';
      for (const h2 of hairs) {
        ctx.beginPath();
        for (let i = 0; i < 36; i++) {
          const p = i / 36;
          const x = h2.side * 26 + Math.sin(p * 4 + t * 0.001 + h2.phase) * 20 + h2.side * p * 55;
          const y = -220 + p * h2.length;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(230,80,80,${h2.alpha * intensity})`;
        ctx.stroke();
      }

      // Face
      ctx.globalCompositeOperation = 'source-over';
      const face = ctx.createRadialGradient(0, -185, 2, 0, -185, 42);
      face.addColorStop(0, `rgba(150,50,50,${0.25 * intensity})`);
      face.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.ellipse(0, -185, 32, 46, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = `rgba(255,80,80,${0.35 * intensity})`;
      ctx.beginPath();
      ctx.ellipse(-10, -188, 2, 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(10, -188, 2, 1, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    ctx.fillStyle = '#020001';
    ctx.fillRect(0, 0, w, h);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [intensity]);

  return <canvas ref={canvasRef} className={className ?? 'mlv-canvas-orb'} />;
}
