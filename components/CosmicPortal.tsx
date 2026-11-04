'use client';
import { useEffect, useRef } from 'react';

export type PortalState =
  | 'dormant' | 'listening' | 'thinking' | 'responding'
  | 'voice-listening' | 'voice-active' | 'switching'
  | 'absorbing' | 'processing' | 'emerging';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 255, g: 184, b: 74 };
}

const INTENSITY: Record<PortalState, number> = {
  dormant: 0.26, listening: 0.46, thinking: 0.55,
  responding: 0.70, 'voice-listening': 0.34, 'voice-active': 0.78,
  switching: 0.88, absorbing: 0.96, processing: 1.0, emerging: 0.88,
};
const SPIN: Record<PortalState, number> = {
  dormant: 0.28, listening: 0.46, thinking: 1.1,
  responding: 0.85, 'voice-listening': 0.38, 'voice-active': 1.4,
  switching: 1.9, absorbing: 3.4, processing: 4.4, emerging: 2.4,
};

export function CosmicPortal({
  state,
  facultyColor,
}: {
  state: PortalState;
  facultyColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const tRef = useRef(0);
  const stateRef = useRef(state);
  const colorRef = useRef(facultyColor);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { colorRef.current = facultyColor; }, [facultyColor]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      tRef.current += 0.016;
      const t = tRef.current;
      const st = stateRef.current;
      const col = hexToRgb(colorRef.current);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.5;
      const cy = H * 0.44;
      const R = Math.min(W, H) * 0.21;
      const inten = INTENSITY[st] ?? 0.28;
      const spd = SPIN[st] ?? 0.28;

      // Outer halo
      const og = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 2.0);
      og.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${(inten * 0.16).toFixed(3)})`);
      og.addColorStop(0.4, `rgba(104,40,184,${(inten * 0.08).toFixed(3)})`);
      og.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 2.0, 0, Math.PI * 2);
      ctx.fillStyle = og;
      ctx.fill();

      // Outer ring — 60 segmented arcs, forward rotation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * spd);
      for (let i = 0; i < 60; i++) {
        const p = 0.6 + 0.4 * Math.sin(t * 2.2 + (i / 60) * Math.PI * 6);
        const a = inten * (0.52 + 0.48 * p);
        ctx.beginPath();
        ctx.arc(0, 0, R, (i / 60) * Math.PI * 2, ((i + 0.82) / 60) * Math.PI * 2);
        ctx.lineWidth = 1.6 + p * 2.2;
        ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${a.toFixed(3)})`;
        ctx.stroke();
      }
      ctx.restore();

      // Mid ring — counter-rotation, violet
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-t * spd * 0.55);
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.74, (i / 20) * Math.PI * 2, ((i + 0.65) / 20) * Math.PI * 2);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = `rgba(104,40,184,${(inten * 0.52).toFixed(3)})`;
        ctx.stroke();
      }
      ctx.restore();

      // Electric micro-ring — slow forward
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * spd * 0.28);
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.88, (i / 12) * Math.PI * 2, ((i + 0.5) / 12) * Math.PI * 2);
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = `rgba(22,139,255,${(inten * 0.36).toFixed(3)})`;
        ctx.stroke();
      }
      ctx.restore();

      // Central void — dark interior
      const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.68);
      vg.addColorStop(0, 'rgba(3,4,7,0.98)');
      vg.addColorStop(0.72, 'rgba(8,4,22,0.95)');
      vg.addColorStop(1, 'rgba(3,4,7,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.68, 0, Math.PI * 2);
      ctx.fillStyle = vg;
      ctx.fill();

      // Active vortex lines inside void
      if (st === 'processing' || st === 'absorbing' || st === 'emerging' || st === 'thinking') {
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2 + t * 2.8;
          const len = R * 0.52 * inten * (0.5 + 0.5 * Math.sin(t * 3 + i));
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
          ctx.strokeStyle = `rgba(22,139,255,${(inten * 0.38).toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        ctx.restore();
        // Central pulse dot
        const pr = R * 0.14 * (0.7 + 0.3 * Math.sin(t * 6));
        const pg = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
        pg.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${(inten * 0.65).toFixed(3)})`);
        pg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, pr, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();
      }

      // Dormant / listening gentle breath
      if (st === 'dormant' || st === 'listening') {
        const br = R * 0.09 * (0.5 + 0.5 * Math.sin(t * 0.9));
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, br);
        bg.addColorStop(0, `rgba(${col.r},${col.g},${col.b},0.12)`);
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, br, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []); // runs once; state/color via refs

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 6,
        pointerEvents: 'none',
      }}
    />
  );
}
