'use client';
import React, { useEffect, useRef } from 'react';

// ============================================================
// MEDHĀ — The Crystalline Wraith (canvas 2D)
// ----------------------------------------------------------------
// REBUILD: density-based humanoid silhouette with HORIZONTAL
// wind-shear bands that drift across her form. Particles re-sample
// from a mask shape every frame, are coloured in the amethyst →
// pearl → cyan-mint palette, and emit a faint horizontal blur trail.
//
// Look: a figure made of fragmented dust, sliced into wind-shear
// strata that drift to the right at varying speeds — like a being
// dissolving and re-forming in a slow cosmic wind. Matches GIF A
// ("Crystalline Wraith") in the user's reference, while honouring
// the existing VYAN amethyst-pearl-cyan palette.
// ============================================================

type Props = {
  intensity?: number; // 0..1 — sleeping vs awake brightness
  className?: string;
};

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  band: number;        // which horizontal band this particle belongs to
  size: number;
  hue: number;         // 0=amethyst, 1=pearl, 2=cyan-mint
  shimmer: number;
};

export default function MedhaCanvasOrb({ intensity = 1, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const intensityRef = useRef(intensity);
  useEffect(() => { intensityRef.current = intensity; }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = innerWidth;
    let h = innerHeight;
    const setSize = () => {
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();
    const onResize = () => setSize();
    window.addEventListener('resize', onResize, { passive: true });

    // -----------------------------------------------------------
    // Wraith silhouette — anchor points for the body density mask.
    // Computed in normalised "wraith space" (cx, cy at centre).
    // We sample inside this silhouette every frame to spawn particles.
    // -----------------------------------------------------------
    const wraith = {
      // Body proportions tuned for an ~ 520-700 px tall figure.
      headRy: 0.058,
      headRx: 0.045,
      neck: 0.10,
      shoulderW: 0.20,
      torsoH: 0.32,
      hipW: 0.15,
      bottomTaper: 0.46,  // where the body dissolves into wisps
    };

    // Determine whether a point (nx, ny) — normalised so figure is
    // ~vertical, cy at 0.50 — is inside the wraith silhouette.
    // Returns 0 (outside) or a density value 0..1 (inside, edge-soft).
    function insideWraith(nx: number, ny: number): number {
      // Head (ellipse) ~ y = 0.30
      const hx = nx;
      const hy = ny - 0.30;
      const headD = (hx * hx) / (wraith.headRx * wraith.headRx) + (hy * hy) / (wraith.headRy * wraith.headRy);
      if (headD < 1) return 1 - Math.max(0, headD - 0.6) * 2;

      // Torso: triangle taper from shoulders to hips, soft edges.
      if (ny >= 0.36 && ny < 0.68) {
        const t = (ny - 0.36) / 0.32; // 0..1 down the torso
        const halfW = wraith.shoulderW * (1 - 0.3 * t);
        const localX = Math.abs(nx) / halfW;
        if (localX < 1) return 1 - localX * 0.4;
      }
      // Hips → wisp dissolving downward
      if (ny >= 0.68 && ny < 0.92) {
        const t = (ny - 0.68) / 0.24;
        const halfW = (wraith.hipW * (1 - t * 0.85));
        const localX = Math.abs(nx) / Math.max(0.01, halfW);
        if (localX < 1) return Math.max(0, (1 - t) * (1 - localX * 0.6));
      }
      return 0;
    }

    // Wind-shear bands — horizontal strata that drift at different speeds.
    // Bands subtly modulate particle behaviour for the "sliced wraith" look.
    const BAND_COUNT = 11;
    const bandDrift = new Array(BAND_COUNT).fill(0).map((_, i) => 0.15 + (i / BAND_COUNT) * 0.55 + Math.random() * 0.25);
    const bandPhase = new Array(BAND_COUNT).fill(0).map(() => Math.random() * Math.PI * 2);

    const palette = [
      { r: 198, g: 168, b: 255 },  // amethyst
      { r: 244, g: 240, b: 255 },  // pearl
      { r: 130, g: 230, b: 220 },  // cyan-mint
    ];

    const particles: Particle[] = [];
    const TARGET = 1100;  // ~1100 particles when fully awake
    let lastT = performance.now();

    // -----------------------------------------------------------
    // Particle spawn — rejection-sample inside the wraith silhouette.
    // The figure is anchored at cx (slightly right of centre) with the
    // crown at y ~ 0.18 and the dissolving feet at y ~ 0.92.
    // -----------------------------------------------------------
    function spawn(): Particle {
      const cy = h * 0.50;
      // Figure scaled to fill ~ 0.78 of viewport height.
      const figureH = h * 0.78;
      const figureW = figureH * 0.55;
      const cx = w * 0.55;

      let nx = 0, ny = 0, dens = 0, tries = 0;
      while (tries < 24) {
        nx = (Math.random() - 0.5) * 1.0;   // -0.5..0.5 (matches halfwidth)
        ny = Math.random();                  // 0..1
        dens = insideWraith(nx, ny);
        if (dens > 0 && Math.random() < dens) break;
        tries++;
      }
      const x = cx + nx * figureW;
      // Map ny so the figure sits centered on the canvas (head at top, feet near bottom)
      const y = (cy - figureH / 2) + ny * figureH;

      const band = Math.floor(((y / h) * BAND_COUNT)) | 0;
      const drift = bandDrift[Math.max(0, Math.min(BAND_COUNT - 1, band))];

      return {
        x, y,
        vx: drift * 0.45 + (Math.random() - 0.5) * 0.18,        // wind-shear bias to the right
        vy: (Math.random() - 0.5) * 0.05,
        life: 0,
        maxLife: 80 + Math.random() * 240,
        band,
        size: 0.6 + Math.random() * 1.6,
        hue: Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2,
        shimmer: Math.random() * Math.PI * 2,
      };
    }

    // -----------------------------------------------------------
    // Frame loop
    // -----------------------------------------------------------
    const draw = (t: number) => {
      const dt = Math.min(50, t - lastT);
      lastT = t;
      const intens = intensityRef.current;
      const target = Math.floor(TARGET * intens);

      // Background: pure void with the faintest amethyst halo.
      // We use destination-in compositing for trail fading.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(2, 1, 8, 0.16)';      // trail fade
      ctx.fillRect(0, 0, w, h);

      // Spawn up to target
      while (particles.length < target) particles.push(spawn());

      // Update wind-shear band phases (drift in time).
      for (let i = 0; i < BAND_COUNT; i++) bandPhase[i] += dt * 0.0006 * bandDrift[i];

      // Render in additive mode for the soft luminance pile-up.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        // Wind-shear: per-band horizontal drift + tiny vertical sway
        const bandWave = Math.sin(bandPhase[p.band] + p.shimmer) * 0.4;
        p.x += (p.vx + bandWave) * dt * 0.08;
        p.y += p.vy * dt * 0.08;
        p.shimmer += dt * 0.012;
        p.life += dt;

        // Recycle when off-screen right or expired
        if (p.x > w + 8 || p.life > p.maxLife || p.y < -8 || p.y > h + 8) {
          particles[i] = spawn();
          continue;
        }

        // Color + opacity
        const col = palette[p.hue];
        const lifeT = p.life / p.maxLife;
        const fade = Math.sin(lifeT * Math.PI) * 0.86 * intens;
        const flicker = 0.85 + Math.sin(p.shimmer * 3.1) * 0.15;
        const a = Math.max(0, Math.min(1, fade * flicker));
        const r = p.size * (0.9 + Math.sin(p.shimmer) * 0.18);

        // Core dot
        ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Wind-shear streak — horizontal smear trailing behind the particle
        // (the signature look of the Crystalline Wraith GIF).
        if (p.size > 1.0 && a > 0.15) {
          const streak = ctx.createLinearGradient(p.x - 14, p.y, p.x, p.y);
          streak.addColorStop(0, `rgba(${col.r}, ${col.g}, ${col.b}, 0)`);
          streak.addColorStop(1, `rgba(${col.r}, ${col.g}, ${col.b}, ${a * 0.55})`);
          ctx.fillStyle = streak;
          ctx.fillRect(p.x - 14, p.y - 0.4, 14, 0.8);
        }
      }

      // Subtle bright bands across the figure — the "wind-shear" stratification.
      // Renders 3-4 horizontal slivers of brighter glow that drift slowly.
      ctx.globalCompositeOperation = 'lighter';
      for (let b = 0; b < 4; b++) {
        const yBand = h * 0.30 + h * 0.55 * (b / 3) + Math.sin(t * 0.0004 + b) * 8;
        const grad = ctx.createLinearGradient(0, yBand - 1.2, 0, yBand + 1.2);
        grad.addColorStop(0,   'rgba(212, 168, 255, 0)');
        grad.addColorStop(0.5, 'rgba(244, 240, 255, 0.12)');
        grad.addColorStop(1,   'rgba(212, 168, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(w * 0.38, yBand - 1.2, w * 0.34, 2.4);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className={className ?? 'mlv-canvas-orb'} />;
}
