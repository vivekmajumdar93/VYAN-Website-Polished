'use client';

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { COGNITIVE_MODES, CognitiveModeKey, getMode } from '@/lib/medha/cognitive';
import { chatStream, type ChatMessage } from '@/lib/medha/MedhaClient';
import { renderMarkdown, isForbiddenQuery, SANDHI_REDIRECT_MARKDOWN } from '@/lib/medha/markdown';
import {
  getChat, upsertChat, getCurrentChatId, setCurrentChatId, newChatId,
  type StoredMsg,
} from '@/lib/medha/storage';
import { incrementQuota, quotaRemaining } from '@/lib/quota/quota';
import MedhaConsentSlab, {
  hasLocalConsent, hasLocalDenial, clearLocalConsent,
  type ConsentSnapshot,
} from './MedhaConsentSlab';
import './medha.css';

// ── Phase state machine ────────────────────────────────────────────────────────
type Phase = 'idle' | 'absorbing' | 'processing' | 'emerging' | 'responding' | 'error';

// ── Mode colors (rgb components for canvas) ───────────────────────────────────
const MC: Record<CognitiveModeKey, [number, number, number, number, number, number]> = {
  prajna:   [255, 74,  74,  255, 138, 90 ],
  dhyana:   [34,  224, 212, 154, 85,  255],
  akshaya:  [58,  144, 255, 34,  224, 164],
  java:     [255, 184, 77,  255, 42,  74 ],
  sanchara: [255, 102, 136, 58,  212, 255],
};
function rgba(r: number, g: number, b: number, a: number) {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// ── VoidBackground: full-viewport nebula + star field ─────────────────────────
function VoidBackground({ modeKey }: { modeKey: CognitiveModeKey }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(modeKey);
  modeRef.current = modeKey;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;

    type Star = { x: number; y: number; r: number; ph: number; spd: number; layer: number };
    type Blob = { x: number; y: number; br: number; dx: number; dy: number; ch: number; ph: number };

    const stars: Star[] = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.4,
      ph: Math.random() * Math.PI * 2,
      spd: 0.0008 + Math.random() * 0.0028,
      layer: Math.floor(Math.random() * 3),
    }));

    // 4 nebula blobs — positions as fractions of viewport
    const blobs: Blob[] = [
      { x: 0.28, y: 0.22, br: 0.32, dx:  0.000055, dy:  0.000040, ch: 0, ph: 0.0 },
      { x: 0.72, y: 0.58, br: 0.28, dx: -0.000048, dy:  0.000060, ch: 1, ph: 1.8 },
      { x: 0.50, y: 0.78, br: 0.24, dx:  0.000038, dy: -0.000070, ch: 0, ph: 3.5 },
      { x: 0.18, y: 0.65, br: 0.26, dx:  0.000068, dy:  0.000030, ch: 1, ph: 5.0 },
    ];

    let W = 0, H = 0;
    const resize = () => {
      W = c.width  = window.innerWidth;
      H = c.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let raf: number, t = 0;
    const draw = () => {
      t++;
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);

      const [r1, g1, b1, r2, g2, b2] = MC[modeRef.current];

      // Nebula blobs
      for (const bl of blobs) {
        bl.x += bl.dx; bl.y += bl.dy;
        if (bl.x < -0.1) bl.x = 1.1; if (bl.x > 1.1) bl.x = -0.1;
        if (bl.y < -0.1) bl.y = 1.1; if (bl.y > 1.1) bl.y = -0.1;
        const bx = bl.x * W, by = bl.y * H;
        const bR = bl.br * Math.min(W, H);
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.004 + bl.ph);
        const [br, bg, bb] = bl.ch === 0 ? [r1, g1, b1] : [r2, g2, b2];
        const bg2 = ctx.createRadialGradient(bx, by, 0, bx, by, bR);
        bg2.addColorStop(0, rgba(br, bg, bb, 0.045 * pulse));
        bg2.addColorStop(0.5, rgba(br, bg, bb, 0.018 * pulse));
        bg2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(bx, by, bR, 0, Math.PI * 2);
        ctx.fillStyle = bg2; ctx.fill();
      }

      // Stars
      for (const s of stars) {
        const twinkle = 0.4 + 0.6 * Math.sin(t * s.spd * 60 + s.ph);
        const baseOp = s.layer === 0 ? 0.06 : s.layer === 1 ? 0.10 : 0.16;
        const op = baseOp * twinkle;
        const sx = s.x * W, sy = s.y * H;
        if (s.layer === 2) {
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 2.5);
          sg.addColorStop(0, `rgba(255,255,255,${(op * 0.3).toFixed(3)})`);
          sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.beginPath(); ctx.arc(sx, sy, s.r * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = sg; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${op.toFixed(3)})`; ctx.fill();
      }

      // Centre vignette (draws depth toward portal)
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, Math.min(W, H) * 0.55);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}
    />
  );
}

// ── CosmicPortal: textured asteroid ring + crystal orb + lotus ────────────────
function CosmicPortal({
  phase, modeKey, innerR = 150,
}: { phase: Phase; modeKey: CognitiveModeKey; innerR?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const modeRef  = useRef(modeKey);
  phaseRef.current = phase;
  modeRef.current  = modeKey;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const TWO_PI = Math.PI * 2;
    const pad = 115;
    const S = innerR * 2 + pad * 2;
    c.width = S; c.height = S;
    const cx = S / 2, cy = S / 2;

    // Ring geometry (thick, rocky)
    const RING_WIDTH = innerR * 0.52;
    const RING_MID   = innerR + RING_WIDTH * 0.5;
    const RING_OUTER = innerR + RING_WIDTH;

    // Orb (top of ring) and Lotus (bottom of ring)
    const ORB_Y   = cy - RING_MID;
    const ORB_R   = innerR * 0.11;
    const LOTUS_Y = cy + RING_MID;
    const LOTUS_S = innerR * 0.105;

    // Pre-compute texture dots for rocky ring surface
    type TexDot = { x: number; y: number; r: number; c: string };
    const texDots: TexDot[] = [];
    for (let i = 0; i < 340; i++) {
      const angle  = Math.random() * TWO_PI;
      const radius = innerR + 2 + Math.random() * (RING_WIDTH - 4);
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const dotR = 0.5 + Math.random() * 1.9;
      const a = 0.07 + Math.random() * 0.24;
      const warm = Math.random() > 0.4;
      const cr = warm ? 50 + Math.floor(Math.random() * 55) : 15 + Math.floor(Math.random() * 25);
      const cg = warm ? 10 + Math.floor(Math.random() * 18) : 4;
      const cb = warm ? Math.floor(Math.random() * 14) : 28 + Math.floor(Math.random() * 55);
      texDots.push({ x, y, r: dotR, c: `rgba(${cr},${cg},${cb},${a.toFixed(2)})` });
    }

    // Fire sparks travelling the inner edge
    type Spark = { a: number; spd: number; br: number; sz: number };
    const sparks: Spark[] = Array.from({ length: 54 }, (_, i) => ({
      a: (i / 54) * TWO_PI,
      spd: 0.0016 + Math.random() * 0.0026,
      br: 0.3 + Math.random() * 0.7,
      sz: 0.8 + Math.random() * 1.9,
    }));

    // Void particles (flow inward during active phases)
    type VP = { r: number; a: number; spd: number; br: number; sz: number };
    const voidPs: VP[] = Array.from({ length: 32 }, () => ({
      r: innerR * (0.1 + Math.random() * 0.85),
      a: Math.random() * TWO_PI,
      spd: 0.0018 + Math.random() * 0.0038,
      br: 0.2 + Math.random() * 0.5,
      sz: 0.5 + Math.random() * 1.1,
    }));

    let raf: number, t = 0;

    const draw = () => {
      t++;
      ctx.clearRect(0, 0, S, S);
      const ph = phaseRef.current;
      const [mr, mg, mb] = MC[modeRef.current]; // mode color → void interior only

      // Phase modifiers
      let glow = 1.0, coronaInt = 0.6, fireInt = 0.75, voidBright = 0.0, spkMul = 1.0;
      switch (ph) {
        case 'idle':       glow = 0.72; coronaInt = 0.45; fireInt = 0.55; break;
        case 'absorbing':  glow = 1.9;  coronaInt = 1.1;  fireInt = 1.5;  spkMul = 4.2; break;
        case 'processing': glow = 1.2;  coronaInt = 0.78; fireInt = 0.90; voidBright = 0.65; spkMul = 2.0; break;
        case 'emerging':   glow = 1.4;  coronaInt = 0.90; fireInt = 1.05; voidBright = 0.90; spkMul = 1.5; break;
        case 'responding': glow = 1.0;  fireInt = 0.70;   voidBright = 0.18; break;
        case 'error':      glow = 0.48; coronaInt = 0.28; fireInt = 0.30; break;
      }

      const breath = 2.8 * Math.sin(t * 0.016);
      const R = innerR + breath;
      const fireBreath = 0.75 + 0.25 * Math.sin(t * 0.028);

      // ── 1. Outer purple / magenta corona ────────────────────────────────
      {
        const cg = ctx.createRadialGradient(cx, cy, RING_OUTER * 0.85, cx, cy, RING_OUTER * 1.62);
        cg.addColorStop(0,   `rgba(165,0,255,${(0.68 * coronaInt * glow).toFixed(3)})`);
        cg.addColorStop(0.3, `rgba(105,0,215,${(0.42 * coronaInt * glow).toFixed(3)})`);
        cg.addColorStop(0.65,`rgba(55,0,145,${(0.18 * coronaInt * glow).toFixed(3)})`);
        cg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, RING_OUTER * 1.62, 0, TWO_PI);
        ctx.fillStyle = cg; ctx.fill();
      }
      // Rotating magenta wisps
      {
        const wa = t * 0.007;
        for (let k = 0; k < 3; k++) {
          const wx = cx + RING_OUTER * 0.4 * Math.cos(wa + k * TWO_PI / 3);
          const wy = cy + RING_OUTER * 0.4 * Math.sin(wa + k * TWO_PI / 3);
          const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, RING_OUTER * 0.68);
          wg.addColorStop(0, `rgba(230,0,185,${(0.12 * glow).toFixed(3)})`);
          wg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(wx, wy, RING_OUTER * 0.68, 0, TWO_PI);
          ctx.fillStyle = wg; ctx.fill();
        }
      }

      // ── 2. Rocky ring body (thick dark stroke) ───────────────────────────
      ctx.save();
      ctx.lineWidth = RING_WIDTH + breath * 0.25;
      ctx.strokeStyle = '#030110';
      ctx.beginPath(); ctx.arc(cx, cy, RING_MID, 0, TWO_PI); ctx.stroke();
      ctx.restore();

      // Ring body gradient overlay (clipped to annulus)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, RING_OUTER + 2, 0, TWO_PI, false);
      ctx.arc(cx, cy, R - 2, 0, TWO_PI, true);
      ctx.clip();
      const rg = ctx.createRadialGradient(cx, cy, R, cx, cy, RING_OUTER);
      rg.addColorStop(0,    'rgba(32,10,0,0.72)');
      rg.addColorStop(0.22, 'rgba(12,4,2,0.82)');
      rg.addColorStop(0.55, 'rgba(5,2,12,0.86)');
      rg.addColorStop(0.85, 'rgba(8,2,24,0.76)');
      rg.addColorStop(1,    'rgba(20,5,42,0.60)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, S, S);
      ctx.restore();

      // Texture dots on ring (also clipped)
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, RING_OUTER + 1, 0, TWO_PI, false);
      ctx.arc(cx, cy, R - 1, 0, TWO_PI, true);
      ctx.clip();
      for (const td of texDots) {
        ctx.beginPath(); ctx.arc(td.x, td.y, td.r, 0, TWO_PI);
        ctx.fillStyle = td.c; ctx.fill();
      }
      ctx.restore();

      // ── 3. Inner fire glow (orange/gold on ring inner face) ──────────────
      {
        const fg = ctx.createRadialGradient(cx, cy, R * 0.90, cx, cy, RING_OUTER * 0.68);
        fg.addColorStop(0,    'rgba(255,220,0,0)');
        fg.addColorStop(0.08, `rgba(255,205,0,${(0.72 * fireInt * fireBreath * glow).toFixed(3)})`);
        fg.addColorStop(0.3,  `rgba(255,130,0,${(0.82 * fireInt * fireBreath * glow).toFixed(3)})`);
        fg.addColorStop(0.65, `rgba(255,45,0,${(0.36 * fireInt * glow).toFixed(3)})`);
        fg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, RING_OUTER * 0.68, 0, TWO_PI);
        ctx.fillStyle = fg; ctx.fill();
      }
      // Fire edge hard line
      {
        ctx.save();
        ctx.lineWidth = 2.5 + 1.5 * Math.sin(t * 0.022);
        ctx.strokeStyle = `rgba(255,185,0,${(0.95 * fireInt * glow).toFixed(3)})`;
        ctx.shadowColor = 'rgba(255,140,0,0.9)'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI); ctx.stroke();
        ctx.restore();
      }

      // ── 4. Inner void (black) ────────────────────────────────────────────
      {
        const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        vg.addColorStop(0,    'rgba(0,0,0,0.99)');
        vg.addColorStop(0.5,  'rgba(2,0,8,0.98)');
        vg.addColorStop(0.80, 'rgba(8,2,20,0.96)');
        vg.addColorStop(1,    'rgba(18,4,38,0.92)');
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, TWO_PI);
        ctx.fillStyle = vg; ctx.fill();
      }

      // ── 5. Void interior: mode shimmer + tunnel rings + processing glow ───
      {
        const shim = 0.025 + 0.025 * Math.sin(t * 0.018);
        const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.60);
        sg.addColorStop(0,   `rgba(${mr},${mg},${mb},${(shim * 0.28).toFixed(3)})`);
        sg.addColorStop(0.6, `rgba(${mr},${mg},${mb},${(shim * 0.08).toFixed(3)})`);
        sg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.60, 0, TWO_PI);
        ctx.fillStyle = sg; ctx.fill();

        for (let i = 0; i < 7; i++) {
          const frac = (i + 1) / 8;
          const tr  = R * frac * 0.95;
          const rot = t * 0.003 * (1 + i * 0.3) * (i % 2 === 0 ? 1 : -1);
          ctx.save();
          ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
          ctx.lineWidth = 0.4;
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},${(0.013 * glow).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(cx, cy, tr, 0, TWO_PI); ctx.stroke();
          ctx.restore();
        }

        if (voidBright > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.07);
          const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.44);
          cg.addColorStop(0,    `rgba(255,235,185,${(0.95 * voidBright * pulse).toFixed(3)})`);
          cg.addColorStop(0.3,  `rgba(255,165,80,${(0.55 * voidBright * pulse).toFixed(3)})`);
          cg.addColorStop(0.65, `rgba(140,55,255,${(0.22 * voidBright * pulse).toFixed(3)})`);
          cg.addColorStop(1,    'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(cx, cy, R * 0.44, 0, TWO_PI);
          ctx.fillStyle = cg; ctx.fill();
        }

        if (ph === 'absorbing' || ph === 'processing' || ph === 'emerging') {
          const pSpdMul = ph === 'absorbing' ? 4.2 : ph === 'emerging' ? 0.5 : 1.0;
          for (const vp of voidPs) {
            vp.r *= (1 - vp.spd * pSpdMul);
            if (vp.r < 2) { vp.r = R * 0.95; vp.a = Math.random() * TWO_PI; }
            const vx = cx + vp.r * Math.cos(vp.a);
            const vy = cy + vp.r * Math.sin(vp.a);
            const op = vp.br * (vp.r / (R * 0.95)) * 0.45;
            ctx.beginPath(); ctx.arc(vx, vy, vp.sz, 0, TWO_PI);
            ctx.fillStyle = `rgba(255,160,60,${op.toFixed(3)})`; ctx.fill();
          }
        }
      }

      // ── 6. Fire sparks on inner ring edge ────────────────────────────────
      {
        for (const sp of sparks) {
          sp.a += sp.spd * spkMul;
          const sx = cx + R * Math.cos(sp.a);
          const sy = cy + R * Math.sin(sp.a);
          const twinkle = 0.4 + 0.6 * Math.sin(t * 0.05 + sp.a * 3);
          const op = sp.br * twinkle * Math.min(glow, 1.5) * fireInt * 0.9;
          const hue = 100 + Math.floor(sp.br * 100);
          ctx.beginPath(); ctx.arc(sx, sy, sp.sz * (spkMul > 1.5 ? 2.1 : 1.3), 0, TWO_PI);
          ctx.fillStyle = `rgba(255,${hue},0,${op.toFixed(3)})`;
          ctx.shadowColor = 'rgba(255,140,0,0.4)'; ctx.shadowBlur = 7;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // ── 7. Crystal orb at top of ring ────────────────────────────────────
      {
        const orbPulse = 0.88 + 0.12 * Math.sin(t * 0.028);
        const ox = cx, oy = ORB_Y;

        const hg = ctx.createRadialGradient(ox, oy, 0, ox, oy, ORB_R * 4.5);
        hg.addColorStop(0,    `rgba(255,235,120,${(0.75 * orbPulse * glow).toFixed(3)})`);
        hg.addColorStop(0.3,  `rgba(220,160,255,${(0.42 * orbPulse * glow).toFixed(3)})`);
        hg.addColorStop(0.65, `rgba(140,0,255,${(0.15 * glow).toFixed(3)})`);
        hg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(ox, oy, ORB_R * 4.5, 0, TWO_PI);
        ctx.fillStyle = hg; ctx.fill();

        // Concentric golden arcs above orb
        for (let i = 0; i < 4; i++) {
          const cr = ORB_R * (1.7 + i * 1.0);
          const alpha = (0.52 - i * 0.10) * orbPulse * glow;
          const sweep = t * 0.011 * (1 + i * 0.3);
          ctx.save();
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = `rgba(255,195,80,${alpha.toFixed(3)})`;
          ctx.shadowColor = 'rgba(255,180,0,0.4)'; ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.arc(ox, oy, cr, Math.PI + sweep, TWO_PI * 2 + sweep);
          ctx.stroke(); ctx.restore();
        }
        ctx.shadowBlur = 0;

        // Stem orb → ring
        ctx.save();
        const stemG = ctx.createLinearGradient(ox, oy + ORB_R, ox, cy - R);
        stemG.addColorStop(0, 'rgba(255,200,100,0.5)');
        stemG.addColorStop(1, 'rgba(255,180,0,0.12)');
        ctx.lineWidth = 1.2; ctx.strokeStyle = stemG;
        ctx.beginPath(); ctx.moveTo(ox, oy + ORB_R); ctx.lineTo(ox, cy - R + 2); ctx.stroke();
        ctx.restore();

        // Orb glass body
        const og = ctx.createRadialGradient(ox - ORB_R * 0.32, oy - ORB_R * 0.32, 0, ox, oy, ORB_R);
        og.addColorStop(0,    'rgba(255,255,255,0.97)');
        og.addColorStop(0.28, 'rgba(230,210,255,0.88)');
        og.addColorStop(0.65, 'rgba(170,80,255,0.72)');
        og.addColorStop(1,    'rgba(80,0,180,0.90)');
        ctx.beginPath(); ctx.arc(ox, oy, ORB_R, 0, TWO_PI);
        ctx.fillStyle = og;
        ctx.shadowColor = 'rgba(200,180,255,0.9)'; ctx.shadowBlur = 20;
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // ── 8. Golden lotus at bottom of ring ────────────────────────────────
      {
        const lotusPulse = 0.80 + 0.20 * Math.sin(t * 0.021 + Math.PI);
        const ls = LOTUS_S;
        const lx = cx, ly = LOTUS_Y;

        const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, ls * 3.5);
        lg.addColorStop(0,   `rgba(255,200,80,${(0.72 * lotusPulse * glow).toFixed(3)})`);
        lg.addColorStop(0.4, `rgba(255,140,20,${(0.30 * lotusPulse * glow).toFixed(3)})`);
        lg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(lx, ly, ls * 3.5, 0, TWO_PI);
        ctx.fillStyle = lg; ctx.fill();

        ctx.save();
        const sG = ctx.createLinearGradient(lx, cy + R, lx, ly - ls);
        sG.addColorStop(0, 'rgba(255,180,0,0.14)');
        sG.addColorStop(1, 'rgba(255,200,80,0.44)');
        ctx.lineWidth = 1.2; ctx.strokeStyle = sG;
        ctx.beginPath(); ctx.moveTo(lx, cy + R - 2); ctx.lineTo(lx, ly - ls * 0.8); ctx.stroke();
        ctx.restore();

        ctx.save(); ctx.translate(lx, ly);
        for (let p = 0; p < 7; p++) {
          const pa = (p / 7) * TWO_PI - Math.PI / 2;
          const px = Math.cos(pa) * ls * 0.65;
          const py = Math.sin(pa) * ls * 0.65;
          const pg = ctx.createRadialGradient(px * 0.3, py * 0.3, 0, px, py, ls * 0.95);
          pg.addColorStop(0,   `rgba(255,248,185,${(0.92 * lotusPulse).toFixed(3)})`);
          pg.addColorStop(0.5, `rgba(255,172,55,${(0.70 * lotusPulse).toFixed(3)})`);
          pg.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.ellipse(px, py, ls * 0.42, ls * 0.68, pa, 0, TWO_PI);
          ctx.fillStyle = pg; ctx.fill();
        }
        const coreG = ctx.createRadialGradient(0, 0, 0, 0, 0, ls * 0.38);
        coreG.addColorStop(0, `rgba(255,255,220,${lotusPulse.toFixed(3)})`);
        coreG.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.beginPath(); ctx.arc(0, 0, ls * 0.38, 0, TWO_PI);
        ctx.fillStyle = coreG; ctx.fill(); ctx.restore();

        // Bead chain
        const beads = [ls * 2.2, ls * 3.2, ls * 4.0];
        let prevBY = ly + ls * 0.5;
        for (let i = 0; i < beads.length; i++) {
          const bY = ly + beads[i];
          const bR = ls * (0.19 - i * 0.038);
          ctx.save(); ctx.lineWidth = 0.7;
          ctx.strokeStyle = 'rgba(255,195,80,0.26)';
          ctx.beginPath(); ctx.moveTo(lx, prevBY); ctx.lineTo(lx, bY - bR); ctx.stroke(); ctx.restore();
          prevBY = bY + bR;
          const bg = ctx.createRadialGradient(lx - bR * 0.3, bY - bR * 0.3, 0, lx, bY, bR);
          bg.addColorStop(0,   'rgba(255,255,220,0.92)');
          bg.addColorStop(0.5, 'rgba(255,205,100,0.75)');
          bg.addColorStop(1,   'rgba(255,160,50,0.28)');
          ctx.beginPath(); ctx.arc(lx, bY, bR, 0, TWO_PI);
          ctx.fillStyle = bg; ctx.fill();
        }

        // Water ripples
        const rippleY = ly + beads[2] + ls * 1.4;
        for (let i = 0; i < 4; i++) {
          const rw = ls * (1.3 + i * 0.85) * (0.9 + 0.1 * Math.sin(t * 0.014 + i * 0.9));
          const alpha = (0.30 - i * 0.055) * glow;
          ctx.save(); ctx.lineWidth = 0.8;
          ctx.strokeStyle = `rgba(255,180,55,${alpha.toFixed(3)})`;
          ctx.beginPath(); ctx.ellipse(lx, rippleY, rw, rw * 0.28, 0, 0, TWO_PI);
          ctx.stroke(); ctx.restore();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [innerR]);

  const pad = 115;
  const S = innerR * 2 + pad * 2;
  const cssSize = Math.min(S, 420);
  return (
    <canvas
      ref={ref}
      style={{
        display: 'block',
        width: cssSize,
        height: cssSize,
        maxWidth: '95vw',
        maxHeight: '95vw',
      }}
    />
  );
}

// ── PortalOrb: pulsing orb with orbiting satellites ───────────────────────────
function PortalOrb({ modeKey }: { modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];

  return (
    <div style={{ position: 'relative', width: 44, height: 44, margin: '0 auto' }}>
      {/* Breathing glow ring */}
      <motion.div
        animate={{ scale: [1, 1.5, 1], opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          border: `1px solid ${rgba(r1, g1, b1, 0.5)}`,
          pointerEvents: 'none',
        }}
      />
      {/* Satellite A */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -10, borderRadius: '50%' }}
      >
        <div style={{
          position: 'absolute', top: -3, left: '50%', transform: 'translateX(-50%)',
          width: 4, height: 4, borderRadius: '50%',
          background: rgba(r1, g1, b1, 0.95),
          boxShadow: `0 0 7px ${rgba(r1, g1, b1, 0.9)}`,
        }} />
      </motion.div>
      {/* Satellite B */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
        style={{ position: 'absolute', inset: -10, borderRadius: '50%' }}
      >
        <div style={{
          position: 'absolute', bottom: -3, left: '50%', transform: 'translateX(-50%)',
          width: 3, height: 3, borderRadius: '50%',
          background: rgba(r1, g1, b1, 0.7),
          boxShadow: `0 0 5px ${rgba(r1, g1, b1, 0.7)}`,
        }} />
      </motion.div>
      {/* Core orb */}
      <motion.div
        animate={{
          y: [0, -6, 0],
          boxShadow: [
            `0 0 10px ${rgba(r1,g1,b1,0.65)}, 0 0 22px ${rgba(r1,g1,b1,0.28)}`,
            `0 0 20px ${rgba(r1,g1,b1,1.0)}, 0 0 40px ${rgba(r1,g1,b1,0.55)}`,
            `0 0 10px ${rgba(r1,g1,b1,0.65)}, 0 0 22px ${rgba(r1,g1,b1,0.28)}`,
          ],
        }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: 12, left: 12,
          width: 20, height: 20, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95), ${rgba(r1,g1,b1,0.9)})`,
        }}
      />
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({
  msg, modeKey, fresh = false,
}: { msg: StoredMsg; modeKey: CognitiveModeKey; fresh?: boolean }) {
  const isU = msg.role === 'user';
  const [r1, g1, b1] = MC[modeKey];

  return (
    <motion.div
      initial={fresh ? { opacity: 0, scale: isU ? 1 : 0.06, y: isU ? 10 : 0 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={fresh
        ? isU
          ? { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
          : { duration: 1.1, ease: [0.08, 0.95, 0.3, 1.0] }
        : { duration: 0 }
      }
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: isU ? 'flex-end' : 'flex-start',
        marginBottom: 10,
        transformOrigin: isU ? 'bottom right' : 'top center',
      }}
    >
      {!isU && (
        <span style={{
          fontSize: 9, letterSpacing: '0.22em', color: rgba(r1, g1, b1, 0.5),
          marginBottom: 4, textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
        }}>
          MEDHĀ
        </span>
      )}
      <motion.div
        animate={!isU ? {
          boxShadow: [
            `0 0 6px ${rgba(r1,g1,b1,0.07)}`,
            `0 0 16px ${rgba(r1,g1,b1,0.20)}`,
            `0 0 6px ${rgba(r1,g1,b1,0.07)}`,
          ],
        } : {}}
        transition={!isU ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 } : {}}
        style={{
          maxWidth: 'min(72vw, 320px)',
          padding: isU ? '9px 13px' : '11px 14px',
          background: isU ? 'rgba(255,255,255,0.05)' : rgba(r1, g1, b1, 0.07),
          border: isU ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${rgba(r1, g1, b1, 0.18)}`,
          borderRadius: isU ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
          fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
          color: isU ? 'rgba(255,255,255,0.78)' : 'rgba(255,230,210,0.90)',
          fontFamily: 'var(--font-vyan)',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          textShadow: isU ? 'none' : `0 0 12px ${rgba(r1,g1,b1,0.35)}, 0 0 28px ${rgba(r1,g1,b1,0.15)}`,
        }}
      >
        {msg.role === 'assistant'
          ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} className="medha-md" />
          : msg.content
        }
      </motion.div>
    </motion.div>
  );
}

// ── StreamBubble ──────────────────────────────────────────────────────────────
function StreamBubble({ text, modeKey }: { text: string; modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.06 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.95, ease: [0.08, 0.95, 0.3, 1.0] }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        marginBottom: 10, transformOrigin: 'top center',
      }}
    >
      <span style={{
        fontSize: 9, letterSpacing: '0.22em', color: rgba(r1, g1, b1, 0.5),
        marginBottom: 4, textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
      }}>
        MEDHĀ
      </span>
      <motion.div
        animate={{
          boxShadow: [
            `0 0 8px ${rgba(r1,g1,b1,0.1)}`,
            `0 0 20px ${rgba(r1,g1,b1,0.28)}`,
            `0 0 8px ${rgba(r1,g1,b1,0.1)}`,
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          maxWidth: 'min(72vw, 320px)',
          padding: '11px 14px',
          background: rgba(r1, g1, b1, 0.07),
          border: `1px solid ${rgba(r1, g1, b1, 0.18)}`,
          borderRadius: '3px 14px 14px 14px',
          fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
          color: 'rgba(255,230,210,0.90)',
          fontFamily: 'var(--font-vyan)',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          textShadow: `0 0 12px ${rgba(r1,g1,b1,0.35)}, 0 0 28px ${rgba(r1,g1,b1,0.15)}`,
          minHeight: 40,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '…') }} className="medha-md" />
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          style={{
            display: 'inline-block', width: 1, height: '1em',
            background: rgba(r1, g1, b1, 0.8), marginLeft: 2, verticalAlign: 'text-bottom',
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// ── InputBar ──────────────────────────────────────────────────────────────────
interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  modeKey: CognitiveModeKey;
  onModeChange: (k: CognitiveModeKey) => void;
  quotaLeft: number;
}

function InputBar({ value, onChange, onSubmit, disabled, modeKey, onModeChange, quotaLeft }: InputBarProps) {
  const [r1, g1, b1] = MC[modeKey];

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      padding: '10px 14px 14px',
      background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 100%)',
    }}>
      {/* Animated mode pills */}
      <div style={{
        display: 'flex', gap: 5, justifyContent: 'center',
        marginBottom: 8, overflowX: 'auto', paddingBottom: 2,
      }}>
        {COGNITIVE_MODES.map(m => {
          const [mr, mg, mb] = MC[m.key];
          const active = m.key === modeKey;
          return (
            <motion.button
              key={m.key}
              onClick={() => onModeChange(m.key)}
              animate={active ? {
                boxShadow: [
                  `0 0 5px ${rgba(mr,mg,mb,0.18)}`,
                  `0 0 14px ${rgba(mr,mg,mb,0.52)}`,
                  `0 0 5px ${rgba(mr,mg,mb,0.18)}`,
                ],
              } : { boxShadow: '0 0 0px transparent' }}
              transition={active ? { duration: 2.0, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
              style={{
                padding: '3px 10px', borderRadius: 20,
                border: active ? `1px solid ${rgba(mr,mg,mb,0.6)}` : '1px solid rgba(255,255,255,0.1)',
                background: active ? rgba(mr,mg,mb,0.15) : 'transparent',
                color: active ? rgba(mr,mg,mb,0.95) : 'rgba(255,255,255,0.3)',
                fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: 'var(--font-vyan)', cursor: 'pointer',
                transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                flexShrink: 0, whiteSpace: 'nowrap',
              }}
            >
              {m.name}
            </motion.button>
          );
        })}
      </div>

      {/* Input row with scanning line */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes mc-border-pulse {
            0%,100% { box-shadow:0 0 10px rgba(${r1},${g1},${b1},0.08); border-color:rgba(${r1},${g1},${b1},0.20); }
            50%      { box-shadow:0 0 26px rgba(${r1},${g1},${b1},0.26); border-color:rgba(${r1},${g1},${b1},0.46); }
          }
          @keyframes mc-scan {
            0%        { left:-80%; opacity:0; }
            10%       { opacity:1; }
            70%,100%  { left:120%; opacity:0; }
          }
          .mc-input-pill { animation: mc-border-pulse 2.6s ease-in-out infinite; }
          .mc-scan-line  { animation: mc-scan 5s ease-in-out infinite; animation-delay:1.5s; }
        `}</style>
        <div
          className="mc-input-pill"
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 8,
            background: 'rgba(10,6,20,0.72)',
            border: `1px solid ${rgba(r1,g1,b1,0.20)}`,
            borderRadius: 20,
            padding: '8px 10px 8px 14px',
            backdropFilter: 'blur(14px)',
          }}
        >
          {/* Scanning glint */}
          <div
            className="mc-scan-line"
            style={{
              position: 'absolute', top: 0, bottom: 0, width: '30%',
              background: `linear-gradient(to right, transparent 0%, ${rgba(r1,g1,b1,0.08)} 50%, transparent 100%)`,
              pointerEvents: 'none', zIndex: 1,
            }}
          />
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKey}
            disabled={disabled}
            placeholder={disabled ? 'MEDHĀ is weaving…' : 'Enter the void…'}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'rgba(255,230,200,0.88)', fontSize: 13.5,
              fontFamily: 'var(--font-vyan)', resize: 'none', lineHeight: '1.5',
              letterSpacing: '0.02em', maxHeight: 100, overflowY: 'auto',
              position: 'relative', zIndex: 2,
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = '0';
              el.style.height = Math.min(el.scrollHeight, 100) + 'px';
            }}
          />
          <button
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              border: `1px solid ${rgba(r1,g1,b1, disabled || !value.trim() ? 0.18 : 0.55)}`,
              background: disabled || !value.trim() ? 'transparent' : rgba(r1,g1,b1,0.18),
              color: disabled || !value.trim() ? rgba(r1,g1,b1,0.25) : rgba(r1,g1,b1,0.95),
              cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', position: 'relative', zIndex: 2,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {quotaLeft <= 3 && quotaLeft > 0 && (
        <p style={{
          textAlign: 'center', fontSize: 9.5, color: rgba(r1,g1,b1,0.4),
          letterSpacing: '0.14em', margin: '6px 0 0', fontFamily: 'var(--font-vyan)',
        }}>
          {quotaLeft} query{quotaLeft === 1 ? '' : 's'} remaining
        </p>
      )}
    </div>
  );
}

// ── Processing label ──────────────────────────────────────────────────────────
const PROCESS_LABELS = [
  'MEDHĀ is weaving consciousness…',
  'traversing the void…',
  'cognition in motion…',
  'distilling infinite signal…',
];

function ProcessingLabel({ modeKey }: { modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % PROCESS_LABELS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.p
      key={idx}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.5 }}
      style={{
        fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: rgba(r1, g1, b1, 0.55), fontFamily: 'var(--font-vyan)',
        textAlign: 'center', margin: '6px 0 0',
      }}
    >
      {PROCESS_LABELS[idx]}
    </motion.p>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

function buildGreeting(isGuest: boolean): string {
  if (isGuest) return 'Hello — I am Medhā. You have entered in guest mode. Our conversation is temporary and will not be saved after you leave. What would you like to explore?';
  return 'Hello — I am Medhā, the Cognitive Intelligence of VYAN. Your conversations here are remembered and await your return. What would you like to explore?';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MedhaHUD() {
  const router = useRouter();

  const [phase, setPhase]         = useState<Phase>('idle');
  const [mode, setMode]           = useState<CognitiveModeKey>('dhyana');
  const [chatId, setChatId]       = useState('');
  const [messages, setMessages]   = useState<StoredMsg[]>([]);
  const [input, setInput]         = useState('');
  const [streamText, setStream]   = useState('');
  const [errorMsg, setError]      = useState('');
  const [freshIdx, setFreshIdx]   = useState(-1);
  const [flyingText, setFlying]   = useState<string | null>(null);
  const [flyDeltaY, setFlyDeltaY] = useState(0);
  const [gatePhase, setGatePhase] = useState<'checking' | 'consent' | 'active'>('checking');
  const [guestMode, setGuestMode] = useState(false);
  const [quotaLeft, setQuota]     = useState(99);

  const abortRef     = useRef<AbortController | null>(null);
  const chatBotRef   = useRef<HTMLDivElement>(null);
  const portalRef    = useRef<HTMLDivElement>(null);
  const phaseRef     = useRef(phase);
  const chatIdRef    = useRef(chatId);
  const messagesRef  = useRef(messages);
  const guestModeRef = useRef(guestMode);
  phaseRef.current     = phase;
  chatIdRef.current    = chatId;
  messagesRef.current  = messages;
  guestModeRef.current = guestMode;

  // Gate init
  useEffect(() => {
    setQuota(quotaRemaining('medha'));
    if (hasLocalConsent()) {
      setGuestMode(false);
      setGatePhase('active');
    } else if (hasLocalDenial()) {
      setGuestMode(true);
      setGatePhase('active');
    } else {
      setGatePhase('consent');
    }
  }, []); // eslint-disable-line

  // Chat init when active
  useEffect(() => {
    if (gatePhase !== 'active') return;
    setQuota(quotaRemaining('medha'));
    if (guestMode) {
      const id = newChatId();
      setChatId(id);
      const greeting: StoredMsg = {
        id: uid(), role: 'assistant',
        content: buildGreeting(true),
        mode, ts: Date.now(),
      };
      setMessages([greeting]);
    } else {
      const id = getCurrentChatId() || newChatId();
      setCurrentChatId(id);
      setChatId(id);
      const stored = getChat(id);
      if (stored?.messages?.length) {
        setMessages(stored.messages);
      } else {
        const greeting: StoredMsg = {
          id: uid(), role: 'assistant',
          content: buildGreeting(false),
          mode, ts: Date.now(),
        };
        setMessages([greeting]);
        upsertChat({ id, title: 'New conversation', messages: [greeting], lastInteractionAt: Date.now(), createdAt: Date.now() });
      }
    }
  }, [gatePhase, guestMode]); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    if (chatBotRef.current) chatBotRef.current.scrollTop = chatBotRef.current.scrollHeight;
  }, [messages, streamText]);

  const onConsented = useCallback((_snap: ConsentSnapshot) => {
    setGuestMode(false);
    setGatePhase('active');
  }, []);

  const onDenied = useCallback(() => {
    setGuestMode(true);
    setGatePhase('active');
  }, []);

  const switchMode = useCallback((k: CognitiveModeKey) => setMode(k), []);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || phaseRef.current !== 'idle') return;
    if (quotaLeft <= 0) return;

    if (isForbiddenQuery(text)) {
      const sandhi: StoredMsg = { id: uid(), role: 'assistant', content: SANDHI_REDIRECT_MARKDOWN, mode, ts: Date.now() };
      setMessages(prev => { const n = [...prev, sandhi]; setFreshIdx(n.length - 1); return n; });
      setInput('');
      return;
    }

    let deltaY = -300;
    if (portalRef.current) {
      const pr = portalRef.current.getBoundingClientRect();
      deltaY = (pr.top + pr.height / 2) - (window.innerHeight - 90);
    }
    setFlyDeltaY(deltaY);
    setFlying(text);
    setInput('');
    setPhase('absorbing');
    incrementQuota('medha');
    setQuota(quotaRemaining('medha'));

    const userMsg: StoredMsg = { id: uid(), role: 'user', content: text, mode, ts: Date.now() };

    setTimeout(async () => {
      setFlying(null);
      setPhase('processing');
      setMessages(prev => { const next = [...prev, userMsg]; setFreshIdx(next.length - 1); return next; });

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const history: ChatMessage[] = [
        ...messagesRef.current.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: text },
      ];

      let isFirst = true;
      await chatStream(getMode(mode), history, {
        onChunk: (chunk) => {
          if (isFirst) { isFirst = false; setPhase('emerging'); setStream(chunk); }
          else setStream(prev => prev + chunk);
        },
        onDone: (finalText) => {
          const assistantMsg: StoredMsg = { id: uid(), role: 'assistant', content: finalText, mode, ts: Date.now() };
          setMessages(prev => {
            const next = [...prev, assistantMsg];
            setFreshIdx(next.length - 1);
            if (!guestModeRef.current) {
              upsertChat({ id: chatIdRef.current, title: text.slice(0, 55), messages: next, lastInteractionAt: Date.now(), createdAt: Date.now() });
            }
            return next;
          });
          setStream('');
          setPhase('responding');
          setTimeout(() => setPhase('idle'), 600);
        },
        onError: (err) => {
          setError(err.message);
          setStream('');
          setPhase('error');
          setTimeout(() => { setError(''); setPhase('idle'); }, 4000);
        },
      }, ctrl.signal);
    }, 650);
  }, [input, mode, messages, chatId, quotaLeft]);

  const goBack = () => router.push('/vistara');

  const [r1, g1, b1] = MC[mode];
  const innerR = typeof window !== 'undefined' ? Math.min(150, window.innerWidth * 0.35) : 150;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9200, background: '#000', overflow: 'hidden' }}>

      {/* Background — after checking */}
      {gatePhase !== 'checking' && <VoidBackground modeKey={mode} />}

      {/* Consent gate */}
      {gatePhase === 'consent' && <MedhaConsentSlab onGranted={onConsented} onDenied={onDenied} />}

      {/* Active chat interface */}
      {gatePhase === 'active' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>

          {/* ── Header ──────────────────────────────────────────────── */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0) 100%)',
          }}>
            {/* Grid / back icon */}
            <button onClick={goBack} title="Back to Vistāra" style={{
              background: 'transparent', border: 'none', padding: 8, cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="4" height="4" rx="0.5"/><rect x="10" y="3" width="4" height="4" rx="0.5"/>
                <rect x="17" y="3" width="4" height="4" rx="0.5"/><rect x="3" y="10" width="4" height="4" rx="0.5"/>
                <rect x="10" y="10" width="4" height="4" rx="0.5"/><rect x="17" y="10" width="4" height="4" rx="0.5"/>
                <rect x="3" y="17" width="4" height="4" rx="0.5"/><rect x="10" y="17" width="4" height="4" rx="0.5"/>
                <rect x="17" y="17" width="4" height="4" rx="0.5"/>
              </svg>
            </button>
            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <motion.span
                animate={{ opacity: [0.55, 0.85, 0.55] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                style={{ fontSize: 11, letterSpacing: '0.42em', color: 'rgba(255,210,160,0.90)', fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}
              >
                MEDHĀ
              </motion.span>
              <span style={{ fontSize: 7.5, letterSpacing: '0.20em', color: 'rgba(200,180,255,0.42)', fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}>
                The Consciousness of VYAN
              </span>
            </div>
            {/* Sound toggle */}
            <button
              onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('vyan:sound-toggle')); }}
              title="Toggle Sound"
              style={{
                background: 'transparent', border: 'none', padding: 8, cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              </svg>
            </button>
          </div>

          {/* ── Guest mode banner ────────────────────────────────────── */}
          {guestMode && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                position: 'absolute', top: 46, left: 0, right: 0, zIndex: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '5px 16px',
                background: 'rgba(255,160,80,0.07)',
                borderBottom: '1px solid rgba(255,160,80,0.10)',
              }}
            >
              <span style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,180,100,0.60)', fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}>
                GUEST SESSION · TEMPORARY
              </span>
              <button
                onClick={() => { clearLocalConsent(); setGuestMode(false); setGatePhase('consent'); setMessages([]); }}
                style={{
                  background: 'none', border: '1px solid rgba(255,180,100,0.28)', borderRadius: 20,
                  padding: '2px 8px', color: 'rgba(255,180,100,0.60)', fontSize: 8.5,
                  letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: 'var(--font-vyan)', cursor: 'pointer',
                }}
              >
                Consent &amp; Unlock
              </button>
            </motion.div>
          )}

          {/* ── Portal section + void text overlay ───────────────────── */}
          <div
            ref={portalRef}
            style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'max(52px, 7vh)', position: 'relative', zIndex: 5 }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <CosmicPortal phase={phase} modeKey={mode} innerR={innerR} />

              {/* Text inside the void — appears during emerging/responding */}
              <AnimatePresence>
                {(phase === 'emerging' || phase === 'responding') && (streamText || messages.length > 0) && (
                  <motion.div
                    key={phase === 'emerging' ? 'stream' : 'resp'}
                    initial={{ opacity: 0, scale: 0.25 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.1 }}
                    transition={{ duration: 0.9, ease: [0.08, 0.95, 0.3, 1.0] }}
                    style={{
                      position: 'absolute',
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '52%',
                      maxHeight: '48%',
                      overflow: 'hidden',
                      textAlign: 'center',
                      pointerEvents: 'none',
                      zIndex: 20,
                    }}
                  >
                    <div
                      className="medha-md"
                      style={{
                        fontSize: 11,
                        lineHeight: 1.65,
                        letterSpacing: '0.018em',
                        color: 'rgba(255,235,195,0.95)',
                        fontFamily: 'var(--font-vyan)',
                        textShadow: '0 0 18px rgba(255,160,0,0.55), 0 0 36px rgba(255,100,0,0.28)',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        display: '-webkit-box',
                        WebkitLineClamp: 7,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(
                          streamText ||
                          [...messages].reverse().find(m => m.role === 'assistant')?.content || ''
                        )
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ minHeight: 20, marginTop: 2 }}>
              <AnimatePresence mode="wait">
                {phase === 'processing' && <ProcessingLabel key="proc" modeKey={mode} />}
                {phase === 'error' && (
                  <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'rgba(255,100,100,0.65)', fontFamily: 'var(--font-vyan)', textAlign: 'center' }}>
                    {errorMsg || 'Signal lost — try again'}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Chat history (scrollable, below portal) ──────────────── */}
          <div
            ref={chatBotRef}
            style={{ flex: 1, width: '100%', maxWidth: 520, overflowY: 'auto', overflowX: 'hidden', padding: '8px 16px 120px', scrollbarWidth: 'none', position: 'relative', zIndex: 5 }}
            onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
            onTouchMove={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              const dy = (el as any)._touchY - e.touches[0].clientY;
              (el as any)._touchY = e.touches[0].clientY;
              el.scrollTop += dy;
            }}
          >
            <div style={{ position: 'sticky', top: 0, height: 24, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', marginBottom: -24, zIndex: 1 }} />
            {messages.map((m, i) => <ChatBubble key={m.id} msg={m} modeKey={mode} fresh={i === freshIdx} />)}
            <AnimatePresence>
              {streamText && phase !== 'emerging' && phase !== 'responding' && <StreamBubble key="stream" text={streamText} modeKey={mode} />}
            </AnimatePresence>
          </div>

          {/* ── Input bar ────────────────────────────────────────────── */}
          <InputBar value={input} onChange={setInput} onSubmit={submit} disabled={phase !== 'idle'} modeKey={mode} onModeChange={switchMode} quotaLeft={quotaLeft} />

        </div>
      )}

      {/* ── Flying text overlay (absorption) ─────────────────────── */}
      <AnimatePresence>
        {flyingText && (
          <motion.div
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 0, scale: 0.04, y: flyDeltaY }}
            transition={{ duration: 0.65, ease: [0.4, 0, 0.8, 1] }}
            style={{
              position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)',
              zIndex: 200, maxWidth: 280, padding: '9px 13px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px 14px 3px 14px',
              fontSize: 12.5, lineHeight: '1.6', color: 'rgba(255,255,255,0.78)',
              fontFamily: 'var(--font-vyan)', pointerEvents: 'none',
              textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              transformOrigin: 'center bottom',
            }}
          >
            {flyingText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
