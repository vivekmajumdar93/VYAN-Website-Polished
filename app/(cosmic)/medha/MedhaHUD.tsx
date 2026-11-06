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

// ── CosmicPortal: fixed full-screen canvas, geometry lerps on orientation change ──
// Canvas is set ONCE to max(screen.width, screen.height) — never resized.
// curGeo / tgtGeo interpolate over 800 ms (ease-in-out cubic) on every resize.
// texDots positions also lerp, so the rocky texture migrates with the ring shape.
function CosmicPortal({ phase, modeKey }: { phase: Phase; modeKey: CognitiveModeKey }) {
  const ref      = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const modeRef  = useRef(modeKey);
  phaseRef.current = phase;
  modeRef.current  = modeKey;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const TWO_PI = Math.PI * 2;
    const ctx    = c.getContext('2d')!;

    // Set canvas ONCE to max screen dimension — portrait or landscape rotation
    // cannot exceed this, so we never need to resize (and never flash blank).
    const dpr    = Math.min(window.devicePixelRatio || 1, 2);
    const maxDim = Math.round(Math.max(
      screen.width  || window.innerWidth,
      screen.height || window.innerHeight
    ) * dpr);
    c.width = c.height = maxDim;
    const LD = maxDim / dpr; // logical max dimension

    // ── geometry ────────────────────────────────────────────────────────────
    type Geo = {
      cx: number; cy: number;
      rxi: number; ryi: number; ringW: number;
      rx_mid: number; ry_mid: number;
      rx_out: number; ry_out: number;
      ORB_Y: number; ORB_R: number;
      LOTUS_Y: number; LOTUS_S: number;
      RIPPLE_Y: number;
    };
    type Dot = { x: number; y: number; r: number; c: string };

    const computeGeo = (): Geo => {
      const vW = window.innerWidth, vH = window.innerHeight;
      const land   = vW > vH * 1.1;
      const cx     = vW / 2;
      const cy     = land ? vH * 0.50 : vH * 0.44;
      const rxi    = land ? vW * 0.40 : Math.min(vW * 0.42, vH * 0.32);
      const ryi    = land ? vH * 0.37 : rxi * 0.98;
      const ringW  = Math.min(rxi, ryi) * 0.36;
      const rx_mid = rxi + ringW * 0.5;
      const ry_mid = ryi + ringW * 0.5;
      const rx_out = rxi + ringW;
      const ry_out = ryi + ringW;
      const ORB_R  = Math.min(rxi, ryi) * 0.092;
      const ORB_Y  = cy - ry_out;
      const LOTUS_S = Math.min(rxi, ryi) * 0.082;
      const LOTUS_Y = cy + ry_out + LOTUS_S * 0.8;
      const RIPPLE_Y = vH * 0.91;
      return { cx, cy, rxi, ryi, ringW, rx_mid, ry_mid, rx_out, ry_out, ORB_Y, ORB_R, LOTUS_Y, LOTUS_S, RIPPLE_Y };
    };

    // seeded pseudo-random for reproducible dot layouts
    const mkRng = (seed: number) => { let s = seed; return () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return (s>>>0)/0xffffffff; }; };

    const computeDots = (g: Geo, seed = 42): Dot[] => {
      const rng = mkRng(seed);
      return Array.from({ length: 460 }, () => {
        const ang   = rng() * TWO_PI;
        const frac  = rng();
        const outer = frac > 0.6;
        return {
          x: g.cx + (g.rxi + frac * g.ringW) * Math.cos(ang),
          y: g.cy + (g.ryi + frac * g.ringW) * Math.sin(ang),
          r: 0.5 + rng() * 1.9,
          c: outer
            ? `rgba(${80+rng()*60|0},${15+rng()*18|0},${90+rng()*80|0},${(0.28+rng()*0.38).toFixed(2)})`
            : `rgba(${95+rng()*85|0},${35+rng()*28|0},${8 +rng()*14|0},${(0.22+rng()*0.32).toFixed(2)})`,
        };
      });
    };

    // ── transition state ────────────────────────────────────────────────────
    const TRANS_DUR = 820;
    const eio = (x: number) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2;

    let curGeo  = computeGeo();
    let tgtGeo  = { ...curGeo };
    let curDots = computeDots(curGeo, 42);
    let tgtDots = computeDots(tgtGeo, 99);
    let transStart = -1;

    const lerpGeo = (a: Geo, b: Geo, p: number): Geo => {
      const L = (x: number, y: number) => x + (y - x) * p;
      return {
        cx: L(a.cx,b.cx), cy: L(a.cy,b.cy),
        rxi: L(a.rxi,b.rxi), ryi: L(a.ryi,b.ryi), ringW: L(a.ringW,b.ringW),
        rx_mid: L(a.rx_mid,b.rx_mid), ry_mid: L(a.ry_mid,b.ry_mid),
        rx_out: L(a.rx_out,b.rx_out), ry_out: L(a.ry_out,b.ry_out),
        ORB_Y: L(a.ORB_Y,b.ORB_Y), ORB_R: L(a.ORB_R,b.ORB_R),
        LOTUS_Y: L(a.LOTUS_Y,b.LOTUS_Y), LOTUS_S: L(a.LOTUS_S,b.LOTUS_S),
        RIPPLE_Y: L(a.RIPPLE_Y,b.RIPPLE_Y),
      };
    };

    const onResize = () => {
      const now = performance.now();
      // snapshot mid-flight position so transition starts from wherever we are
      if (transStart >= 0) {
        const p = eio(Math.min((now - transStart) / TRANS_DUR, 1));
        curGeo  = lerpGeo(curGeo, tgtGeo, p);
        const L = (a: number, b: number) => a + (b - a) * p;
        curDots = curDots.map((d, i) => ({ ...d, x: L(d.x, tgtDots[i].x), y: L(d.y, tgtDots[i].y) }));
      }
      tgtGeo  = computeGeo();
      tgtDots = computeDots(tgtGeo, 99);
      transStart = now;
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 60));

    // ── draw loop ───────────────────────────────────────────────────────────
    let raf: number, t = 0;

    const draw = () => {
      t++;

      // interpolated geometry this frame
      let g    = curGeo;
      let dots = curDots;
      if (transStart >= 0) {
        const raw = Math.min((performance.now() - transStart) / TRANS_DUR, 1);
        const p   = eio(raw);
        const L   = (a: number, b: number) => a + (b - a) * p;
        g    = lerpGeo(curGeo, tgtGeo, p);
        dots = curDots.map((d, i) => ({ ...d, x: L(d.x, tgtDots[i].x), y: L(d.y, tgtDots[i].y) }));
        if (raw >= 1) { curGeo = tgtGeo; curDots = tgtDots; transStart = -1; }
      }

      const { cx, cy, rxi, ryi, ringW, rx_mid, ry_mid, rx_out, ry_out, ORB_Y, ORB_R, LOTUS_Y, LOTUS_S, RIPPLE_Y } = g;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, LD, LD);

      const ph = phaseRef.current;
      const [mr, mg, mb] = MC[modeRef.current];

      let glow = 1.05, coronaInt = 0.92, fireInt = 0.98, voidBright = 0.0, spkMul = 1.0;
      switch (ph) {
        case 'idle':       glow = 1.05; coronaInt = 0.92; fireInt = 0.98; break;
        case 'absorbing':  glow = 1.9;  coronaInt = 1.1;  fireInt = 1.5;  spkMul = 4.5; break;
        case 'processing': glow = 1.3;  coronaInt = 1.0;  fireInt = 1.1;  voidBright = 0.65; spkMul = 2.2; break;
        case 'emerging':   glow = 1.5;  coronaInt = 1.05; fireInt = 1.2;  voidBright = 0.90; spkMul = 1.5; break;
        case 'responding': glow = 1.1;  coronaInt = 0.85; fireInt = 0.85; voidBright = 0.18; break;
        case 'error':      glow = 0.55; coronaInt = 0.35; fireInt = 0.38; break;
      }

      const breath     = 2.6 * Math.sin(t * 0.016);
      const fireBreath = 0.75 + 0.25 * Math.sin(t * 0.028);
      const rxi_b = rxi + breath * 0.7;
      const ryi_b = ryi + breath * 0.7 * (ryi / rxi);

      const eP = (erx: number, ery: number, ccw = false) =>
        ctx.ellipse(cx, cy, erx, ery, 0, 0, TWO_PI, ccw);

      // ── 0. Dark base + blue side nebula ───────────────────────────────────
      ctx.fillStyle = 'rgba(2,0,14,1)';
      ctx.fillRect(0, 0, LD, LD);
      {
        const bf = (ox: number) => {
          const bg = ctx.createRadialGradient(ox, cy, 0, ox, cy, rx_out * 1.3);
          bg.addColorStop(0,   `rgba(0,80,210,${(0.14*glow).toFixed(2)})`);
          bg.addColorStop(0.5, `rgba(0,100,255,${(0.07*glow).toFixed(2)})`);
          bg.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = bg; ctx.fillRect(0, 0, LD, LD);
        };
        bf(cx - rx_out * 0.95); bf(cx + rx_out * 0.95);
        const gm = ctx.createLinearGradient(0, LD * 0.70, 0, LD);
        gm.addColorStop(0, 'rgba(0,0,0,0)');
        gm.addColorStop(1, `rgba(0,25,90,${(0.16*glow).toFixed(2)})`);
        ctx.fillStyle = gm; ctx.fillRect(0, 0, LD, LD);
      }

      // ── 1. Corona radial glow + rotating wisps ────────────────────────────
      {
        const cg = ctx.createRadialGradient(cx, cy, Math.min(rx_out,ry_out)*0.88, cx, cy, Math.max(rx_out,ry_out)*1.80);
        cg.addColorStop(0,    `rgba(165,0,255,${(0.72*coronaInt*glow).toFixed(2)})`);
        cg.addColorStop(0.28, `rgba(100,0,220,${(0.44*coronaInt*glow).toFixed(2)})`);
        cg.addColorStop(0.60, `rgba(50,0,140,${(0.18*coronaInt*glow).toFixed(2)})`);
        cg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(rx_out,ry_out)*1.80, 0, TWO_PI);
        ctx.fillStyle = cg; ctx.fill();
      }
      {
        const wa = t * 0.006;
        for (let k = 0; k < 4; k++) {
          const a = wa + k * Math.PI / 2;
          const wx = cx + rx_out * 0.52 * Math.cos(a);
          const wy = cy + ry_out * 0.52 * Math.sin(a);
          const wr = Math.min(rx_out, ry_out) * 0.78;
          const wg = ctx.createRadialGradient(wx, wy, 0, wx, wy, wr);
          wg.addColorStop(0, `rgba(230,0,210,${(0.11*glow).toFixed(2)})`);
          wg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TWO_PI);
          ctx.fillStyle = wg; ctx.fill();
        }
      }

      // ── 2. Rocky ring body ────────────────────────────────────────────────
      ctx.save();
      ctx.lineWidth   = ringW + breath * 0.3;
      ctx.strokeStyle = '#050118';
      ctx.beginPath(); eP(rx_mid, ry_mid); ctx.stroke();
      ctx.restore();

      // Ring body gradient (clipped to annulus)
      ctx.save();
      ctx.beginPath(); eP(rx_out+2, ry_out+2); eP(rxi_b-2, ryi_b-2, true);
      ctx.clip();
      const rg = ctx.createRadialGradient(cx,cy,Math.min(rxi_b,ryi_b), cx,cy,Math.max(rx_out,ry_out));
      rg.addColorStop(0,    'rgba(95,38,8,0.96)');
      rg.addColorStop(0.18, 'rgba(50,20,8,0.98)');
      rg.addColorStop(0.44, 'rgba(16,6,24,0.98)');
      rg.addColorStop(0.75, 'rgba(14,5,40,0.94)');
      rg.addColorStop(1,    'rgba(32,8,68,0.82)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, LD, LD);
      ctx.restore();

      // Texture dots (clipped, positions lerped)
      ctx.save();
      ctx.beginPath(); eP(rx_out+1, ry_out+1); eP(rxi_b-1, ryi_b-1, true);
      ctx.clip();
      for (const d of dots) {
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TWO_PI);
        ctx.fillStyle = d.c; ctx.fill();
      }
      ctx.restore();

      // ── Energy streamers (3) ─────────────────────────────────────────────
      for (let s = 0; s < 3; s++) {
        const phOff = (s / 3) * TWO_PI + t * 0.004;
        const amp   = ringW * 0.26;
        ctx.beginPath();
        for (let i = 0; i <= 160; i++) {
          const a = (i / 160) * TWO_PI;
          const w = amp * Math.sin(a * 4 + phOff);
          const x = (rx_mid + w) * Math.cos(a);
          const y = (ry_mid + w * (ry_mid / rx_mid)) * Math.sin(a);
          i === 0 ? ctx.moveTo(cx+x, cy+y) : ctx.lineTo(cx+x, cy+y);
        }
        ctx.closePath();
        ctx.lineWidth   = 0.95;
        ctx.strokeStyle = `rgba(255,185,80,${(0.16+0.11*Math.sin(t*0.011+s*1.3))*glow}.toFixed(2)})`;
        ctx.strokeStyle = `rgba(255,185,80,${((0.16+0.11*Math.sin(t*0.011+s*1.3))*glow).toFixed(2)})`;
        ctx.stroke();
      }

      // ── 3. Inner fire glow + hard edge ────────────────────────────────────
      {
        const fg = ctx.createRadialGradient(cx,cy,Math.min(rxi_b,ryi_b)*0.86, cx,cy,Math.min(rx_mid,ry_mid)*1.06);
        fg.addColorStop(0,    'rgba(255,220,0,0)');
        fg.addColorStop(0.10, `rgba(255,200,0,${(0.70*fireInt*fireBreath*glow).toFixed(2)})`);
        fg.addColorStop(0.38, `rgba(255,120,0,${(0.80*fireInt*fireBreath*glow).toFixed(2)})`);
        fg.addColorStop(0.72, `rgba(255,40,0,${(0.30*fireInt*glow).toFixed(2)})`);
        fg.addColorStop(1,    'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.ellipse(cx,cy,Math.min(rx_mid,ry_mid)*1.06,Math.min(rx_mid,ry_mid)*1.06*(ryi/rxi),0,0,TWO_PI);
        ctx.fillStyle = fg; ctx.fill();
      }
      ctx.save();
      ctx.lineWidth   = 2.6 + 1.6 * Math.sin(t * 0.022);
      ctx.strokeStyle = `rgba(255,188,0,${(0.95*fireInt*glow).toFixed(2)})`;
      ctx.shadowColor = 'rgba(255,145,0,0.95)'; ctx.shadowBlur = 26;
      ctx.beginPath(); eP(rxi_b, ryi_b); ctx.stroke();
      ctx.restore();

      // Purple outer edge
      ctx.save();
      ctx.lineWidth   = 2.4 + 1.4 * Math.sin(t * 0.019 + 1.2);
      ctx.strokeStyle = `rgba(210,60,255,${(0.92*coronaInt*glow).toFixed(2)})`;
      ctx.shadowColor = 'rgba(185,0,255,0.92)'; ctx.shadowBlur = 32;
      ctx.beginPath(); eP(rx_out, ry_out); ctx.stroke();
      ctx.restore();

      // ── 4. Inner void ─────────────────────────────────────────────────────
      {
        const vg = ctx.createRadialGradient(cx,cy,0, cx,cy,Math.min(rxi_b,ryi_b));
        vg.addColorStop(0,    'rgba(0,0,0,0.99)');
        vg.addColorStop(0.55, 'rgba(2,0,10,0.98)');
        vg.addColorStop(0.85, 'rgba(8,2,22,0.96)');
        vg.addColorStop(1,    'rgba(18,4,38,0.92)');
        ctx.beginPath(); eP(rxi_b, ryi_b);
        ctx.fillStyle = vg; ctx.fill();
      }

      // ── 5. Void interior ──────────────────────────────────────────────────
      {
        const shim = 0.025 + 0.025 * Math.sin(t * 0.018);
        const sg = ctx.createRadialGradient(cx,cy,0, cx,cy,Math.min(rxi_b,ryi_b)*0.60);
        sg.addColorStop(0,   `rgba(${mr},${mg},${mb},${(shim*0.28).toFixed(3)})`);
        sg.addColorStop(0.6, `rgba(${mr},${mg},${mb},${(shim*0.08).toFixed(3)})`);
        sg.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.ellipse(cx,cy,Math.min(rxi_b,ryi_b)*0.60,Math.min(rxi_b,ryi_b)*0.60*(ryi/rxi),0,0,TWO_PI);
        ctx.fillStyle = sg; ctx.fill();

        for (let i = 0; i < 7; i++) {
          const tr  = Math.min(rxi_b,ryi_b) * (i+1) / 8 * 0.95;
          const rot = t * 0.003 * (1+i*0.3) * (i%2===0?1:-1);
          ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); ctx.translate(-cx,-cy);
          ctx.lineWidth   = 0.4;
          ctx.strokeStyle = `rgba(${mr},${mg},${mb},${(0.013*glow).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(cx,cy,tr,0,TWO_PI); ctx.stroke();
          ctx.restore();
        }

        if (voidBright > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.07);
          const cg2 = ctx.createRadialGradient(cx,cy,0, cx,cy,Math.min(rxi_b,ryi_b)*0.44);
          cg2.addColorStop(0,    `rgba(255,235,185,${(0.95*voidBright*pulse).toFixed(3)})`);
          cg2.addColorStop(0.3,  `rgba(255,165,80,${(0.55*voidBright*pulse).toFixed(3)})`);
          cg2.addColorStop(0.65, `rgba(140,55,255,${(0.22*voidBright*pulse).toFixed(3)})`);
          cg2.addColorStop(1,    'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.ellipse(cx,cy,Math.min(rxi_b,ryi_b)*0.44,Math.min(rxi_b,ryi_b)*0.44*(ryi/rxi),0,0,TWO_PI);
          ctx.fillStyle = cg2; ctx.fill();
        }
      }

      // ── 6. Fire sparks ────────────────────────────────────────────────────
      {
        const spkCount = 28 + Math.floor(spkMul * 10);
        for (let i = 0; i < spkCount; i++) {
          const a    = (i/spkCount)*TWO_PI + t*0.003*(i%2===0?1:-1.3);
          const flick = 0.82 + 0.18*Math.sin(t*0.11+i*0.73);
          const dist  = rxi_b + 2 + 10*Math.random()*spkMul*flick;
          const sx = cx + dist*Math.cos(a);
          const sy = cy + dist*(ryi_b/rxi_b)*Math.sin(a);
          const al = Math.min((0.3+0.7*flick)*Math.min(spkMul,1.5)*fireInt*glow, 1);
          ctx.beginPath(); ctx.arc(sx,sy,0.9+Math.random()*0.6,0,TWO_PI);
          ctx.fillStyle = `rgba(255,${120+Math.random()*120|0},0,${al.toFixed(2)})`; ctx.fill();
        }
      }

      // ── 7. Crystal orb at top ─────────────────────────────────────────────
      {
        const ox = cx, oy = ORB_Y, OR = ORB_R;

        // Halo
        const og = ctx.createRadialGradient(ox,oy,0, ox,oy,OR*2.6);
        og.addColorStop(0,   `rgba(255,210,180,${(0.55*glow).toFixed(2)})`);
        og.addColorStop(0.4, `rgba(255,140,80,${(0.28*glow).toFixed(2)})`);
        og.addColorStop(0.8, `rgba(165,0,255,${(0.12*glow).toFixed(2)})`);
        og.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(ox,oy,OR*2.6,0,TWO_PI); ctx.fillStyle=og; ctx.fill();

        // Concentric arcs above (5, upper semicircle)
        for (let i = 0; i < 5; i++) {
          const arcR  = OR*(1.9+i*0.95);
          const alpha = Math.max(0.55-i*0.09,0.08)*glow;
          ctx.save();
          ctx.lineWidth   = Math.max(0.9-i*0.1,0.4);
          ctx.strokeStyle = `rgba(255,185,80,${alpha.toFixed(2)})`;
          ctx.shadowColor = 'rgba(255,160,50,0.6)'; ctx.shadowBlur = 7;
          ctx.beginPath(); ctx.arc(ox,oy,arcR,Math.PI,0,false); ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(ox-arcR,oy,1.4,0,TWO_PI); ctx.fillStyle=`rgba(255,185,80,${(alpha*1.4).toFixed(2)})`; ctx.fill();
          ctx.beginPath(); ctx.arc(ox+arcR,oy,1.4,0,TWO_PI); ctx.fillStyle=`rgba(255,185,80,${(alpha*1.4).toFixed(2)})`; ctx.fill();
          ctx.restore();
        }
        ctx.beginPath(); ctx.arc(ox, oy-OR*(1.9+4*0.95)-5, 2.6, 0, TWO_PI);
        ctx.fillStyle=`rgba(255,205,100,${(0.92*glow).toFixed(2)})`; ctx.fill();

        // Stem
        ctx.save();
        const sA = 0.48+0.28*Math.sin(t*0.015);
        ctx.lineWidth=1.2; ctx.strokeStyle=`rgba(255,185,80,${sA.toFixed(2)})`;
        ctx.shadowColor='rgba(255,140,0,0.7)'; ctx.shadowBlur=8;
        ctx.beginPath(); ctx.moveTo(ox,oy+OR); ctx.lineTo(ox,oy+OR*2.5); ctx.stroke();
        ctx.shadowBlur=0;
        ctx.beginPath(); ctx.arc(ox,oy+OR*2.9,2.2,0,TWO_PI);
        ctx.fillStyle=`rgba(255,205,80,${sA.toFixed(2)})`; ctx.fill();
        ctx.restore();

        // Orb body
        const ig = ctx.createRadialGradient(ox-OR*0.3,oy-OR*0.3,0, ox,oy,OR);
        ig.addColorStop(0,   'rgba(240,220,255,0.90)');
        ig.addColorStop(0.26,'rgba(180,140,255,0.72)');
        ig.addColorStop(0.56,'rgba(80,20,180,0.76)');
        ig.addColorStop(0.80,'rgba(20,0,80,0.82)');
        ig.addColorStop(1,   'rgba(0,0,22,0.90)');
        ctx.beginPath(); ctx.arc(ox,oy,OR,0,TWO_PI); ctx.fillStyle=ig; ctx.fill();

        // Rim
        ctx.save();
        ctx.lineWidth=1.1; ctx.strokeStyle=`rgba(200,160,255,${(0.70*glow).toFixed(2)})`;
        ctx.shadowColor='rgba(165,0,255,0.80)'; ctx.shadowBlur=12;
        ctx.beginPath(); ctx.arc(ox,oy,OR,0,TWO_PI); ctx.stroke();
        ctx.restore();

        // Specular
        const sh = ctx.createRadialGradient(ox-OR*0.28,oy-OR*0.28,0, ox-OR*0.28,oy-OR*0.28,OR*0.44);
        sh.addColorStop(0,'rgba(255,255,255,0.78)'); sh.addColorStop(1,'rgba(255,255,255,0)');
        ctx.beginPath(); ctx.arc(ox,oy,OR,0,TWO_PI); ctx.fillStyle=sh; ctx.fill();
      }

      // ── 8. Lotus + crystal drops + water ripples ──────────────────────────
      {
        const lx = cx, ly = LOTUS_Y, LS = LOTUS_S;

        // Lotus halo
        const lhg = ctx.createRadialGradient(lx,ly,0, lx,ly,LS*3.8);
        lhg.addColorStop(0,  `rgba(255,195,60,${(0.68*glow).toFixed(2)})`);
        lhg.addColorStop(0.4,`rgba(255,120,20,${(0.32*glow).toFixed(2)})`);
        lhg.addColorStop(1,  'rgba(0,0,0,0)');
        ctx.fillStyle=lhg; ctx.beginPath(); ctx.arc(lx,ly,LS*3.8,0,TWO_PI); ctx.fill();

        // Petals (7)
        const petals = [-0.56,-0.34,-0.15,0,0.15,0.34,0.56];
        const pAlpha = [0.68,0.78,0.84,0.90,0.84,0.78,0.68];
        ctx.save(); ctx.shadowColor='rgba(255,160,0,0.60)'; ctx.shadowBlur=10;
        for (let i = 0; i < 7; i++) {
          ctx.save(); ctx.translate(lx,ly); ctx.rotate(petals[i]-Math.PI/2);
          ctx.beginPath(); ctx.ellipse(0,-LS*0.95,LS*0.26,LS*0.92,0,0,TWO_PI);
          ctx.fillStyle=`rgba(255,185,0,${(pAlpha[i]*glow).toFixed(2)})`; ctx.fill();
          ctx.restore();
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(lx,ly,LS*0.22,0,TWO_PI);
        ctx.fillStyle=`rgba(255,235,160,${(0.96*glow).toFixed(2)})`; ctx.fill();

        // Stem
        ctx.save(); ctx.lineWidth=1.0;
        ctx.strokeStyle=`rgba(255,185,80,${(0.42*glow).toFixed(2)})`;
        ctx.beginPath(); ctx.moveTo(lx,ly+LS*0.5); ctx.lineTo(lx,ly+LS*1.4); ctx.stroke();
        ctx.restore();

        // Crystal drop chain (4 beads)
        const sizes=[LS*0.17,LS*0.12,LS*0.085,LS*0.060];
        const gaps=[LS*0.60,LS*0.46,LS*0.36];
        let dy = ly + LS * 1.4;
        for (let d = 0; d < 4; d++) {
          dy += d===0 ? LS*0.26 : gaps[d-1];
          const dg = ctx.createRadialGradient(lx-sizes[d]*0.3,dy-sizes[d]*0.3,0, lx,dy,sizes[d]);
          dg.addColorStop(0,  'rgba(240,210,255,0.86)');
          dg.addColorStop(0.5,'rgba(180,100,255,0.60)');
          dg.addColorStop(1,  'rgba(55,0,120,0.80)');
          ctx.beginPath(); ctx.arc(lx,dy,sizes[d],0,TWO_PI);
          ctx.fillStyle=dg; ctx.fill();
          ctx.lineWidth=0.8; ctx.strokeStyle=`rgba(200,150,255,${(0.60*glow).toFixed(2)})`;
          ctx.stroke();
        }

        // Water ripples
        for (let r = 0; r < 5; r++) {
          const ph2 = ((t*0.016 + r*0.38) % 1 + 1) % 1;
          const maxRX = Math.min(rx_out*0.52, window.innerWidth*0.28) * (0.28+r*0.17);
          const al = (0.55-ph2*0.55)*0.65*glow;
          if (al <= 0.01) continue;
          ctx.save(); ctx.lineWidth=1.1;
          ctx.strokeStyle=`rgba(255,185,80,${al.toFixed(2)})`;
          ctx.shadowColor='rgba(255,160,0,0.4)'; ctx.shadowBlur=5;
          ctx.beginPath(); ctx.ellipse(lx,RIPPLE_Y,maxRX,maxRX*0.20,0,0,TWO_PI);
          ctx.stroke(); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(lx,RIPPLE_Y,2.6,0,TWO_PI);
        ctx.fillStyle=`rgba(255,205,80,${(0.68*glow).toFixed(2)})`; ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // position: fixed — no layout space consumed, sits behind everything at z-index 1
  return <canvas ref={ref} style={{ position: 'fixed', top: 0, left: 0, zIndex: 1, pointerEvents: 'none', display: 'block' }} />;
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
  // innerR no longer needed — CosmicPortal self-sizes responsively

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

          {/* ── CosmicPortal: position:fixed background canvas (z:1) ── */}
          <CosmicPortal phase={phase} modeKey={mode} />

          {/* ── Void text overlay — position:fixed, tracks ring center ── */}
          <AnimatePresence>
            {(phase === 'idle' || phase === 'emerging' || phase === 'responding') && (streamText || messages.length > 0) && (
              <motion.div
                key={phase === 'idle' ? 'idle-resp' : phase === 'emerging' ? 'stream' : 'resp'}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: phase === 'idle' ? 0.82 : 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.1 }}
                transition={{ duration: phase === 'idle' ? 1.6 : 0.9, ease: [0.08, 0.95, 0.3, 1.0] }}
                style={{
                  position: 'fixed',
                  top: '42svh', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 'min(44vw, 300px)',
                  maxHeight: '28svh',
                  overflow: 'hidden',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  zIndex: 15,
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

          {/* ── Processing / error label — position:fixed ──────────────── */}
          <div style={{ position: 'fixed', top: '53svh', left: '50%', transform: 'translateX(-50%)', zIndex: 15 }}>
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

          {/* ── Layout spacer: reserves height for the ring in portrait ── */}
          <div ref={portalRef} style={{ flex: '0 0 68svh', minHeight: 0, width: '100%' }} />

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
            {messages.map((m, i) => {
              // suppress the first auto-greeting — it shows in the void instead
              if (i === 0 && m.role === 'assistant' && messages.length === 1) return null;
              return <ChatBubble key={m.id} msg={m} modeKey={mode} fresh={i === freshIdx} />;
            })}
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
