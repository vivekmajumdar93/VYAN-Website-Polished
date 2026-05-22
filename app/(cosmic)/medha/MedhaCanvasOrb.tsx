'use client';
import React, { useEffect, useRef } from 'react';

// ============================================================
// MEDHĀ — Conscious Buddha Head (canvas 2D)
// ----------------------------------------------------------------
// SECOND REBUILD per user feedback: a serene humanoid head shaped
// like a Buddha, made of fragmented dust particles drifting in
// horizontal wind-shear bands. ~Half the previous size, with a
// cinematic float across the canvas — never static.
//
// Wrapper element provides the float animation (CSS).
// Inner canvas renders the head silhouette via density mask.
// ============================================================

type Props = {
  intensity?: number;
  className?: string;
};

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  band: number;
  size: number;
  hue: number;
  shimmer: number;
};

export default function MedhaCanvasOrb({ intensity = 1, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const intensityRef = useRef(intensity);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0, H = 0;
    const setSize = () => {
      // Inner canvas is half the viewport so the head reads small + intimate
      // — the wrapper provides the floating motion across the screen.
      W = Math.min(640, Math.floor(innerWidth * 0.42));
      H = Math.min(720, Math.floor(innerHeight * 0.62));
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();
    const onResize = () => setSize();
    window.addEventListener('resize', onResize, { passive: true });

    // -----------------------------------------------------------
    // BUDDHA-HEAD SILHOUETTE MASK
    // Working in normalised coords (-0.5..0.5 x, 0..1 y).
    // Tuned for a recognisable head: wider cranium, uṣṇīṣa bump,
    // earlobes, gentle jaw taper, and a narrow neck.
    // -----------------------------------------------------------
    function insideHead(nx: number, ny: number): number {
      // UṢṆĪṢA — small bump above cranium at very top
      if (ny < 0.18) {
        const ux = nx;
        const uy = ny - 0.10;
        const uD = (ux * ux) / 0.0048 + (uy * uy) / 0.0040;
        if (uD < 1) return 1 - Math.max(0, uD - 0.45) * 1.2;
        return 0;
      }
      // CRANIUM — wide ovoid (wider than tall — natural head shape)
      if (ny >= 0.18 && ny < 0.58) {
        const cx = 0;
        const cy = 0.36;
        const rxC = 0.20;
        const ryC = 0.22;
        const dxC = (nx - cx) / rxC;
        const dyC = (ny - cy) / ryC;
        const cranD = dxC * dxC + dyC * dyC;
        if (cranD < 1) return 1 - Math.max(0, cranD - 0.55) * 1.2;
      }
      // JAW / CHIN — gentle taper from cranium width down to chin
      if (ny >= 0.50 && ny < 0.72) {
        const t = (ny - 0.50) / 0.22;
        const halfW = 0.18 * (1 - 0.42 * t);
        const localX = Math.abs(nx) / halfW;
        if (localX < 1) return (1 - localX * 0.6) * 0.95;
      }
      // EARLOBES — elongated drops on each side, just below cranium
      const elx = (nx - (-0.21)) / 0.040;
      const ely = (ny - 0.52) / 0.110;
      if (elx * elx + ely * ely < 1) return 0.82;
      const erx = (nx - 0.21) / 0.040;
      const ery = (ny - 0.52) / 0.110;
      if (erx * erx + ery * ery < 1) return 0.82;
      // NECK — narrow column from chin
      if (ny >= 0.70 && ny < 0.90) {
        const t = (ny - 0.70) / 0.20;
        const halfW = 0.075 * (1 - 0.25 * t);
        const localX = Math.abs(nx) / halfW;
        if (localX < 1) return 0.75 * (1 - t * 0.4);
      }
      return 0;
    }

    // 9 horizontal wind-shear bands — drift varies per band.
    const BAND_COUNT = 9;
    const bandDrift = new Array(BAND_COUNT).fill(0).map((_, i) => 0.18 + (i / BAND_COUNT) * 0.45 + Math.random() * 0.2);
    const bandPhase = new Array(BAND_COUNT).fill(0).map(() => Math.random() * Math.PI * 2);

    // Palette — switched to a CONSCIOUS-RED + ember-bone-cyan blend to match
    // the new "red" theme requested by the user (matching Shunya orb hues).
    const palette = [
      { r: 255, g: 138, b: 138 },   // ember-red
      { r: 255, g: 220, b: 180 },   // bone-warm
      { r: 240, g: 100, b: 130 },   // crimson-pink
    ];

    const particles: Particle[] = [];
    const TARGET = 1700;
    let lastT = performance.now();

    function spawn(): Particle {
      let nx = 0, ny = 0, dens = 0, tries = 0;
      while (tries < 24) {
        nx = (Math.random() - 0.5);
        ny = Math.random();
        dens = insideHead(nx, ny);
        if (dens > 0 && Math.random() < dens) break;
        tries++;
      }
      // Map to canvas pixel space — head centred horizontally, sits in upper 80%.
      const figureW = W * 0.82;
      const figureH = H * 0.92;
      const cx = W * 0.50;
      const cy = (H - figureH) / 2;
      const x = cx + nx * figureW;
      const y = cy + ny * figureH;

      const band = Math.floor((y / H) * BAND_COUNT) | 0;
      const drift = bandDrift[Math.max(0, Math.min(BAND_COUNT - 1, band))];

      return {
        x, y,
        vx: drift * 0.35 + (Math.random() - 0.5) * 0.14,
        vy: (Math.random() - 0.5) * 0.04,
        life: 0,
        maxLife: 80 + Math.random() * 220,
        band,
        size: 0.6 + Math.random() * 1.5,
        hue: Math.random() < 0.55 ? 0 : Math.random() < 0.55 ? 1 : 2,
        shimmer: Math.random() * Math.PI * 2,
      };
    }

    const draw = (t: number) => {
      const dt = Math.min(50, t - lastT);
      lastT = t;
      const intens = intensityRef.current;
      const target = Math.floor(TARGET * intens);

      // Fade existing trails by SUBTRACTING alpha (canvas stays transparent
      // over the page void background — no dark box around Medhā).
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      ctx.fillRect(0, 0, W, H);

      while (particles.length < target) particles.push(spawn());
      for (let i = 0; i < BAND_COUNT; i++) bandPhase[i] += dt * 0.0006 * bandDrift[i];

      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const bandWave = Math.sin(bandPhase[p.band] + p.shimmer) * 0.36;
        p.x += (p.vx + bandWave) * dt * 0.075;
        p.y += p.vy * dt * 0.075;
        p.shimmer += dt * 0.012;
        p.life += dt;
        if (p.x > W + 8 || p.life > p.maxLife || p.y < -8 || p.y > H + 8) {
          particles[i] = spawn();
          continue;
        }
        const col = palette[p.hue];
        const lifeT = p.life / p.maxLife;
        const fade = Math.sin(lifeT * Math.PI) * 0.86 * intens;
        const flicker = 0.85 + Math.sin(p.shimmer * 3.1) * 0.15;
        const a = Math.max(0, Math.min(1, fade * flicker));
        const r = p.size * (0.9 + Math.sin(p.shimmer) * 0.18);
        ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (p.size > 1.0 && a > 0.15) {
          const streak = ctx.createLinearGradient(p.x - 12, p.y, p.x, p.y);
          streak.addColorStop(0, `rgba(${col.r}, ${col.g}, ${col.b}, 0)`);
          streak.addColorStop(1, `rgba(${col.r}, ${col.g}, ${col.b}, ${a * 0.55})`);
          ctx.fillStyle = streak;
          ctx.fillRect(p.x - 12, p.y - 0.4, 12, 0.8);
        }
      }

      // Subtle horizontal wind-shear strata across the head
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 3; b++) {
        const yBand = H * 0.25 + H * 0.45 * (b / 2) + Math.sin(t * 0.0005 + b) * 6;
        const grad = ctx.createLinearGradient(0, yBand - 1, 0, yBand + 1);
        grad.addColorStop(0,   'rgba(255, 138, 138, 0)');
        grad.addColorStop(0.5, 'rgba(255, 220, 200, 0.16)');
        grad.addColorStop(1,   'rgba(255, 138, 138, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(W * 0.25, yBand - 1, W * 0.50, 2);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Wrapper provides the cinematic float — a slow elliptical drift around
  // the screen centre. Class .mlv-orb-float is animated in medha.css.
  return (
    <div ref={wrapRef} className="mlv-orb-float-wrap" aria-hidden="true">
      <canvas ref={canvasRef} className={className ?? 'mlv-canvas-orb'} />
    </div>
  );
}
