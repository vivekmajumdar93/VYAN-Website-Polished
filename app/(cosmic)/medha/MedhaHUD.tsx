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
import MedhaConsentSlab, { hasLocalConsent, type ConsentSnapshot } from './MedhaConsentSlab';
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

// ── CosmicPortal: living ring + void tunnel ────────────────────────────────────
function CosmicPortal({
  phase, modeKey, innerR = 130,
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
    const pad = 90;
    const S = innerR * 2 + pad * 2;
    c.width = S; c.height = S;
    const cx = S / 2, cy = S / 2;

    // Outer sparks (ring edge)
    type Spark = { a: number; spd: number; br: number; sz: number };
    const sparks: Spark[] = Array.from({ length: 42 }, (_, i) => ({
      a: (i / 42) * Math.PI * 2,
      spd: 0.0022 + Math.random() * 0.0033,
      br: 0.3 + Math.random() * 0.7,
      sz: 0.9 + Math.random() * 1.8,
    }));

    // Void particles (flow toward centre)
    type VP = { r: number; a: number; spd: number; br: number; sz: number };
    const voidPs: VP[] = Array.from({ length: 44 }, () => ({
      r: innerR * (0.1 + Math.random() * 0.88),
      a: Math.random() * Math.PI * 2,
      spd: 0.0025 + Math.random() * 0.005,
      br: 0.25 + Math.random() * 0.65,
      sz: 0.5 + Math.random() * 1.2,
    }));

    let raf: number, t = 0;

    const drawUndulatingPath = (R: number, amp: number) => {
      const STEPS = 200;
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const angle = (i / STEPS) * Math.PI * 2;
        const wobble = amp * Math.sin(angle * 5 + t * 0.02);
        const r = R + wobble;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = () => {
      t++;
      ctx.clearRect(0, 0, S, S);
      const ph = phaseRef.current;
      const [r1, g1, b1, r2, g2, b2] = MC[modeRef.current];

      // Phase parameters
      let baseBreath = 0, spkMul = 1, glow = 1, innerB = 0, ringWBase = 1.5, orbSpd = 1, undAmp = 2;
      switch (ph) {
        case 'idle':
          baseBreath = 4; spkMul = 0.55; glow = 0.72; undAmp = 2.0; break;
        case 'absorbing':
          baseBreath = 12; spkMul = 4.5; glow = 1.75; undAmp = 7.0;
          innerB = 0.38 + 0.28 * Math.sin(t * 0.11); ringWBase = 2.5; orbSpd = 4.0; break;
        case 'processing':
          baseBreath = 6; spkMul = 2.6; glow = 1.18; undAmp = 4.5;
          innerB = 0.18 + 0.12 * Math.sin(t * 0.065); ringWBase = 2.0; orbSpd = 2.5; break;
        case 'emerging':
          baseBreath = 8; spkMul = 1.8; glow = 1.38; undAmp = 3.5;
          innerB = 0.55 + 0.22 * Math.sin(t * 0.05); ringWBase = 2.2; orbSpd = 1.5; break;
        case 'responding':
          baseBreath = 5; spkMul = 1.1; glow = 1.02; undAmp = 2.5; innerB = 0.1; break;
        case 'error':
          baseBreath = 3; spkMul = 0.4; glow = 0.5; undAmp = 1.0; break;
      }

      const breathe = baseBreath * Math.sin(t * 0.016);
      const R = innerR + breathe;
      const ringW = ringWBase + 1.0 * Math.sin(t * 0.03);

      // ── Outer atmospheric halo ────────────────────────────────────────────
      {
        const hg = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.65);
        hg.addColorStop(0, rgba(r1, g1, b1, 0.12 * glow));
        hg.addColorStop(0.5, rgba(r2, g2, b2, 0.055 * glow));
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.65, 0, Math.PI * 2);
        ctx.fillStyle = hg; ctx.fill();
      }

      // ── Inner void (perfect circle fill) ─────────────────────────────────
      {
        const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.98);
        vg.addColorStop(0,   'rgba(0,0,0,0.99)');
        vg.addColorStop(0.4, 'rgba(3,0,10,0.98)');
        vg.addColorStop(0.75,'rgba(8,2,22,0.96)');
        vg.addColorStop(1,   'rgba(16,3,42,0.93)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = vg; ctx.fill();
      }

      // ── Void nebula shimmer (always present, brightens with phase) ────────
      {
        const shim = 0.06 + innerB * 0.3 + 0.04 * Math.sin(t * 0.022);
        const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7);
        sg.addColorStop(0, rgba(r1, g1, b1, shim * 0.35));
        sg.addColorStop(0.5, rgba(r2, g2, b2, shim * 0.18));
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = sg; ctx.fill();
      }

      // ── Tunnel rings (always rotating inside void) ────────────────────────
      const TUNNEL_N = 10;
      for (let i = 0; i < TUNNEL_N; i++) {
        const frac = (i + 1) / (TUNNEL_N + 1);
        const tr = R * frac * 0.95;
        const rotSpd = 0.003 * (1.0 + i * 0.35) * (i % 2 === 0 ? 1 : -1) * (spkMul * 0.3 + 0.7);
        const rot = t * rotSpd;
        const alpha = (0.025 + 0.04 * frac) * glow;
        ctx.save();
        ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy);
        ctx.lineWidth = 0.5 + 0.4 * frac;
        ctx.strokeStyle = rgba(r2, g2, b2, alpha);
        ctx.beginPath(); ctx.arc(cx, cy, tr, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // ── Void particles (always flowing inward) ────────────────────────────
      {
        const pSpdMul = ph === 'absorbing' ? 3.5 : ph === 'emerging' ? 0.45 : 1.0;
        ctx.save();
        for (const vp of voidPs) {
          vp.r *= (1 - vp.spd * pSpdMul);
          if (vp.r < 2) { vp.r = R * 0.95; vp.a = Math.random() * Math.PI * 2; }
          const vx = cx + vp.r * Math.cos(vp.a);
          const vy = cy + vp.r * Math.sin(vp.a);
          const depthFade = vp.r / (R * 0.95);
          const op = vp.br * depthFade * Math.min(glow * 0.65, 1.0);
          ctx.beginPath(); ctx.arc(vx, vy, vp.sz, 0, Math.PI * 2);
          ctx.fillStyle = rgba(r2, g2, b2, op * 0.7);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Ring wide glow ────────────────────────────────────────────────────
      ctx.save();
      ctx.lineWidth = 16;
      ctx.strokeStyle = rgba(r1, g1, b1, 0.14 * glow);
      ctx.shadowColor = rgba(r2, g2, b2, 0.5 * glow);
      ctx.shadowBlur = 30;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // ── Undulating ring edge ──────────────────────────────────────────────
      {
        const ang = t * 0.008;
        const rg = ctx.createLinearGradient(
          cx + R * Math.cos(ang), cy + R * Math.sin(ang),
          cx + R * Math.cos(ang + Math.PI), cy + R * Math.sin(ang + Math.PI),
        );
        rg.addColorStop(0,   rgba(r1, g1, b1, 0.95 * glow));
        rg.addColorStop(0.3, rgba(r2, g2, b2, 0.78 * glow));
        rg.addColorStop(0.6, rgba(8, 4, 16, 0.6 * glow));
        rg.addColorStop(1,   rgba(r1, g1, b1, 0.95 * glow));
        ctx.save();
        ctx.lineWidth = ringW;
        ctx.strokeStyle = rg;
        ctx.shadowColor = rgba(r1, g1, b1, 0.7 * glow);
        ctx.shadowBlur = 10;
        drawUndulatingPath(R, undAmp);
        ctx.stroke();
        ctx.restore();
      }

      // ── Brightness sweep arc ──────────────────────────────────────────────
      {
        const sweepStart = t * 0.018;
        const sweepEnd = sweepStart + Math.PI / 3;
        const STEPS = 40;
        ctx.save();
        ctx.lineWidth = ringW * 2.8;
        ctx.strokeStyle = rgba(255, 255, 255, 0.45 * glow);
        ctx.shadowColor = rgba(r1, g1, b1, 0.9 * glow);
        ctx.shadowBlur = 18;
        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const angle = sweepStart + (sweepEnd - sweepStart) * (i / STEPS);
          const wobble = undAmp * Math.sin(angle * 5 + t * 0.02);
          const r = R + wobble;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // ── 3 Traveling energy orbs on ring ──────────────────────────────────
      {
        const NUM_ORBS = 3;
        for (let i = 0; i < NUM_ORBS; i++) {
          const orbAngle = (t * 0.013 * orbSpd + (i * Math.PI * 2) / NUM_ORBS) % (Math.PI * 2);
          const wobble = undAmp * Math.sin(orbAngle * 5 + t * 0.02);
          const oR = R + wobble;
          const ox = cx + oR * Math.cos(orbAngle);
          const oy = cy + oR * Math.sin(orbAngle);
          const pulse = 0.65 + 0.35 * Math.sin(t * 0.09 + i * 2.1);

          ctx.save();
          // Orb halo
          const hg = ctx.createRadialGradient(ox, oy, 0, ox, oy, 16);
          hg.addColorStop(0, rgba(r1, g1, b1, 0.85 * pulse * glow));
          hg.addColorStop(0.4, rgba(r2, g2, b2, 0.4 * pulse * glow));
          hg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath(); ctx.arc(ox, oy, 16, 0, Math.PI * 2);
          ctx.fillStyle = hg; ctx.fill();
          // Orb core
          ctx.beginPath(); ctx.arc(ox, oy, 3.8, 0, Math.PI * 2);
          ctx.fillStyle = rgba(255, 255, 255, 0.95 * pulse);
          ctx.shadowColor = rgba(r1, g1, b1, 1);
          ctx.shadowBlur = 12;
          ctx.fill();
          ctx.restore();
        }
      }

      // ── Outer sparks on ring ──────────────────────────────────────────────
      ctx.save();
      for (const sp of sparks) {
        sp.a += sp.spd * spkMul;
        const wobble = undAmp * 0.5 * Math.sin(sp.a * 5 + t * 0.02);
        const sr = R + wobble;
        const sx = cx + sr * Math.cos(sp.a);
        const sy = cy + sr * Math.sin(sp.a);
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.055 + sp.a * 3.1);
        const op = sp.br * twinkle * Math.min(glow, 1.3);
        const bigPhase = ph === 'absorbing' || ph === 'processing';
        ctx.beginPath();
        ctx.arc(sx, sy, sp.sz * (bigPhase ? 1.8 : 1.0), 0, Math.PI * 2);
        ctx.fillStyle = rgba(r1, g1, b1, op * 0.88);
        ctx.shadowColor = rgba(r1, g1, b1, op * 0.4);
        ctx.shadowBlur = 7;
        ctx.fill();
      }
      ctx.restore();

      // ── Subtle inner ghost ring ───────────────────────────────────────────
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = rgba(r2, g2, b2, 0.10 * glow + 0.04 * Math.sin(t * 0.028));
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.83, 0, Math.PI * 2); ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [innerR]);

  const S = innerR * 2 + 180;
  return (
    <canvas
      ref={ref}
      style={{
        display: 'block',
        width: Math.min(S, 400), height: Math.min(S, 400),
        maxWidth: '95vw', maxHeight: '95vw',
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

const GREET_NEW = 'Hello — I am Medhā, the Cognitive Intelligence of VYAN. It is a quiet honour to meet you. What would you like to explore?';

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
  const [consentDone, setConsent] = useState(false);
  const [quotaLeft, setQuota]     = useState(99);

  const abortRef    = useRef<AbortController | null>(null);
  const chatBotRef  = useRef<HTMLDivElement>(null);
  const portalRef   = useRef<HTMLDivElement>(null);
  const phaseRef    = useRef(phase);
  const chatIdRef   = useRef(chatId);
  const messagesRef = useRef(messages);
  phaseRef.current    = phase;
  chatIdRef.current   = chatId;
  messagesRef.current = messages;

  // Init
  useEffect(() => {
    const hasConsent = hasLocalConsent();
    setConsent(hasConsent);
    setQuota(quotaRemaining('medha'));
    if (!hasConsent) return;
    const id = getCurrentChatId() || newChatId();
    setCurrentChatId(id);
    setChatId(id);
    const stored = getChat(id);
    if (stored?.messages?.length) {
      setMessages(stored.messages);
    } else {
      const greeting: StoredMsg = { id: uid(), role: 'assistant', content: GREET_NEW, mode, ts: Date.now() };
      setMessages([greeting]);
      upsertChat({ id, title: 'New conversation', messages: [greeting], lastInteractionAt: Date.now(), createdAt: Date.now() });
    }
  }, [consentDone]); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    if (chatBotRef.current) chatBotRef.current.scrollTop = chatBotRef.current.scrollHeight;
  }, [messages, streamText]);

  const onConsent = useCallback((_snap: ConsentSnapshot) => {
    setConsent(true);
    setQuota(quotaRemaining('medha'));
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
            upsertChat({ id: chatIdRef.current, title: text.slice(0, 55), messages: next, lastInteractionAt: Date.now(), createdAt: Date.now() });
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

  if (quotaLeft <= 0 && !consentDone) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', fontFamily: 'var(--font-vyan)', color: 'rgba(255,200,180,0.8)', textAlign: 'center', padding: 24 }}>
        <div>
          <p style={{ fontSize: 13, letterSpacing: '0.08em', marginBottom: 16 }}>MEDHĀ quota reached. Please register to continue.</p>
          <MedhaConsentSlab onGranted={onConsent} />
        </div>
      </div>
    );
  }

  if (!consentDone) return <MedhaConsentSlab onGranted={onConsent} />;

  const [r1, g1, b1] = MC[mode];
  const innerR = typeof window !== 'undefined' ? Math.min(130, (window.innerWidth * 0.4) / 2) : 130;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>

      {/* ── Background canvas layer ──────────────────────────────── */}
      <VoidBackground modeKey={mode} />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)',
      }}>
        <button onClick={goBack} style={{
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20, padding: '5px 11px',
          color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.16em',
          fontFamily: 'var(--font-vyan)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          VISTĀRA
        </button>
        <motion.span
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 10, letterSpacing: '0.3em', color: rgba(r1, g1, b1, 0.6), fontFamily: 'var(--font-vyan)', textTransform: 'uppercase' }}
        >
          MEDHĀ
        </motion.span>
        <div style={{ width: 68 }} />
      </div>

      {/* ── Portal section ───────────────────────────────────────── */}
      <div
        ref={portalRef}
        style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 'max(60px, 8vh)', position: 'relative', zIndex: 5 }}
      >
        <PortalOrb modeKey={mode} />
        <div style={{ marginTop: 8 }}>
          <CosmicPortal phase={phase} modeKey={mode} innerR={innerR} />
        </div>
        <div style={{ minHeight: 22, marginTop: 2 }}>
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

      {/* ── Chat history ─────────────────────────────────────────── */}
      <div
        ref={chatBotRef}
        style={{ flex: 1, width: '100%', maxWidth: 520, overflowY: 'auto', overflowX: 'hidden', padding: '12px 16px 120px', scrollbarWidth: 'none', position: 'relative', zIndex: 5 }}
        onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          const dy = (el as any)._touchY - e.touches[0].clientY;
          (el as any)._touchY = e.touches[0].clientY;
          el.scrollTop += dy;
        }}
      >
        <div style={{ position: 'sticky', top: 0, height: 36, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none', marginBottom: -36, zIndex: 1 }} />
        {messages.map((m, i) => <ChatBubble key={m.id} msg={m} modeKey={mode} fresh={i === freshIdx} />)}
        <AnimatePresence>
          {streamText && <StreamBubble key="stream" text={streamText} modeKey={mode} />}
        </AnimatePresence>
      </div>

      {/* ── Lotus decoration ─────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: [0.14, 0.26, 0.14] }}
        transition={{ duration: 4.0, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'fixed', bottom: 155, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 5 }}
      >
        <svg width="28" height="18" viewBox="0 0 60 36" fill="none">
          <path d="M30 32 C18 32 8 24 8 16 C8 10 14 6 20 8 C22 2 26 0 30 0 C34 0 38 2 40 8 C46 6 52 10 52 16 C52 24 42 32 30 32Z" fill={rgba(r1, g1, b1, 1)} />
          <path d="M30 32 C22 28 16 20 16 14 C16 10 22 8 26 10 C27 6 28 4 30 4 C32 4 33 6 34 10 C38 8 44 10 44 14 C44 20 38 28 30 32Z" fill={rgba(r1, g1, b1, 0.5)} />
        </svg>
      </motion.div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <InputBar value={input} onChange={setInput} onSubmit={submit} disabled={phase !== 'idle'} modeKey={mode} onModeChange={switchMode} quotaLeft={quotaLeft} />

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
