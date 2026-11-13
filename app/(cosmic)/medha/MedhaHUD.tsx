'use client';

import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import gsap from 'gsap';
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

// (VoidBackground removed — image provides the full backdrop)

// (GLSL shaders removed — image provides the visual base)

// ── CosmicPortal: image backdrop + Canvas 2D animated overlay ────────────────
function CosmicPortal({ phase, modeKey }: { phase: Phase; modeKey: CognitiveModeKey }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef  = useRef(phase);
  const modeRef   = useRef(modeKey);
  phaseRef.current = phase;
  modeRef.current  = modeKey;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Ring geometry measured from reference image (1024×1536)
    const IMG_W = 1024, IMG_H = 1536;
    const IMG_CX = 512, IMG_CY = 580;
    const IMG_RX = 295, IMG_RY = 245;
    const IMG_ORB_Y = 275;
    const IMG_LOTUS_Y = 940;
    const IMG_RIPPLE_Y = 1330;

    function resize() {
      const W = window.innerWidth, H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function getGeo() {
      const W = window.innerWidth, H = window.innerHeight;
      const sc = Math.max(W / IMG_W, H / IMG_H);
      const ox = (IMG_W * sc - W) / 2;
      const oy = (IMG_H * sc - H) / 2;
      const spx = (ix: number) => ix * sc - ox;
      const spy = (iy: number) => iy * sc - oy;
      return {
        W, H, sc,
        cx: spx(IMG_CX), cy: spy(IMG_CY),
        rX: IMG_RX * sc, rY: IMG_RY * sc,
        orbX: spx(IMG_CX), orbY: spy(IMG_ORB_Y),
        lotusX: spx(IMG_CX), lotusY: spy(IMG_LOTUS_Y),
        rippleX: spx(IMG_CX), rippleY: spy(IMG_RIPPLE_Y),
      };
    }

    let raf: number;
    const t0 = performance.now();

    function draw() {
      const t = (performance.now() - t0) / 1000;
      const geo = getGeo();
      const ph  = phaseRef.current;
      const mk  = modeRef.current;
      const [mr, mg, mb] = MC[mk];
      const intensity = ph === 'processing' ? 1.8 : ph === 'absorbing' ? 1.4 : 1.0;

      ctx.clearRect(0, 0, geo.W, geo.H);

      // 1. Fire particles along inner ring edge
      for (let i = 0; i < 100; i++) {
        const ang = (i / 100) * Math.PI * 2;
        const flicker = Math.pow(
          Math.max(0, Math.sin(t * 6 + i * 0.47 + Math.sin(t * 2.3 + i * 0.3))),
          0.5,
        );
        const inward = flicker * 20 * geo.sc;
        const x = geo.cx + (geo.rX - inward) * Math.cos(ang);
        const y = geo.cy + (geo.rY - inward) * Math.sin(ang);
        const sz = (2 + 9 * flicker) * geo.sc * intensity;
        const alpha = 0.65 * flicker * intensity;
        if (alpha < 0.01) continue;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, sz);
        gr.addColorStop(0,    `rgba(255,248,200,${alpha.toFixed(3)})`);
        gr.addColorStop(0.35, `rgba(255,140,0,${(alpha * 0.8).toFixed(3)})`);
        gr.addColorStop(1,    'rgba(255,40,0,0)');
        ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2);
        ctx.fillStyle = gr; ctx.fill();
      }

      // 3. Energy sweep arcs (2 arcs, 180° apart)
      ctx.save();
      for (let s = 0; s < 2; s++) {
        const baseAng = t * 1.2 + s * Math.PI;
        for (let w = 0; w < 2; w++) {
          const r = w === 0 ? 1.0 : 1.03;
          ctx.beginPath();
          ctx.ellipse(geo.cx, geo.cy, geo.rX * r, geo.rY * r, 0, baseAng, baseAng + Math.PI * 0.5);
          ctx.strokeStyle = w === 0
            ? `rgba(255,180,50,${(0.9 * intensity).toFixed(3)})`
            : `rgba(255,120,20,${(0.4 * intensity).toFixed(3)})`;
          ctx.lineWidth = (w === 0 ? 3 : 1) * geo.sc;
          ctx.shadowColor = `rgba(255,140,0,${(0.8 * intensity).toFixed(3)})`;
          ctx.shadowBlur = 20;
          ctx.stroke();
        }
      }
      ctx.restore();

      // 4. Crystal orb pulse
      {
        const orbPulse = 0.8 + 0.2 * Math.sin(t * 2.5);
        const orbR = 32 * geo.sc * orbPulse;
        ctx.save();
        const og = ctx.createRadialGradient(geo.orbX, geo.orbY, 0, geo.orbX, geo.orbY, orbR * 2.5);
        og.addColorStop(0,   `rgba(255,255,255,${(0.45 * intensity).toFixed(3)})`);
        og.addColorStop(0.3, `rgba(200,120,255,${(0.35 * intensity).toFixed(3)})`);
        og.addColorStop(1,   'rgba(100,50,255,0)');
        ctx.beginPath(); ctx.arc(geo.orbX, geo.orbY, orbR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = og; ctx.fill();
        for (let i = 0; i < 3; i++) {
          const arcR  = orbR * (1.8 + i * 0.8);
          const arcA  = (0.4 - i * 0.1) * intensity;
          ctx.beginPath();
          ctx.arc(geo.orbX, geo.orbY, arcR, Math.PI, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,185,80,${arcA.toFixed(3)})`;
          ctx.lineWidth = 1.5 * geo.sc;
          ctx.shadowColor = 'rgba(255,160,50,0.6)'; ctx.shadowBlur = 10;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 6. Lotus glow
      {
        const lotusPulse = 0.75 + 0.25 * Math.sin(t * 1.8 + 1.2);
        const lotusR = 28 * geo.sc * lotusPulse;
        ctx.save();
        const lg = ctx.createRadialGradient(geo.lotusX, geo.lotusY, 0, geo.lotusX, geo.lotusY, lotusR * 3);
        lg.addColorStop(0,   `rgba(255,210,80,${(0.5 * intensity).toFixed(3)})`);
        lg.addColorStop(0.4, `rgba(255,160,20,${(0.3 * intensity).toFixed(3)})`);
        lg.addColorStop(1,   'rgba(255,120,0,0)');
        ctx.beginPath(); ctx.arc(geo.lotusX, geo.lotusY, lotusR * 3, 0, Math.PI * 2);
        ctx.fillStyle = lg; ctx.fill();
        ctx.restore();
      }

      // 7. Water ripples
      ctx.save();
      for (let r = 0; r < 4; r++) {
        const ph_r    = ((t * 0.65 + r * 0.5) % 2.0) / 2.0;
        const ripR    = geo.rX * 0.52 * (0.3 + ph_r);
        const ripAlpha = (1 - ph_r) * 0.55 * intensity;
        if (ripAlpha < 0.01) continue;
        ctx.beginPath();
        ctx.ellipse(geo.rippleX, geo.rippleY, ripR, ripR * 0.18, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,165,50,${ripAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.5 * geo.sc;
        ctx.shadowColor = 'rgba(255,140,0,0.4)'; ctx.shadowBlur = 8;
        ctx.stroke();
      }
      ctx.restore();

      // 8. Processing mode: void pulse
      if (ph === 'processing') {
        const pp = 0.5 + 0.5 * Math.sin(t * 4.5);
        ctx.save();
        const vg = ctx.createRadialGradient(geo.cx, geo.cy, 0, geo.cx, geo.cy, geo.rX * 0.9);
        vg.addColorStop(0,   `rgba(${mr},${mg},${mb},0)`);
        vg.addColorStop(0.5, `rgba(${mr},${mg},${mb},${(pp * 0.08).toFixed(3)})`);
        vg.addColorStop(1,   `rgba(${mr},${mg},${mb},0)`);
        ctx.beginPath();
        ctx.ellipse(geo.cx, geo.cy, geo.rX * 0.9, geo.rY * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = vg; ctx.fill();
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'fixed', inset: 0, zIndex: 2,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
        }}
      >
        <source src="/medha-portal.mp4" type="video/mp4" />
      </video>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', inset: 0, zIndex: 3,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        } as React.CSSProperties}
      />
    </>
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
            `0 0 0 1px ${rgba(r1,g1,b1,0.12)}, 0 0 10px ${rgba(r1,g1,b1,0.05)}`,
            `0 0 0 1px ${rgba(r1,g1,b1,0.38)}, 0 0 22px ${rgba(r1,g1,b1,0.14)}`,
            `0 0 0 1px ${rgba(r1,g1,b1,0.12)}, 0 0 10px ${rgba(r1,g1,b1,0.05)}`,
          ],
        } : {}}
        transition={!isU ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 2 } : {}}
        style={{
          maxWidth: 'min(72vw, 320px)',
          padding: isU ? '7px 11px' : '10px 14px',
          background: 'transparent',
          border: isU ? '1px solid rgba(255,255,255,0.07)' : 'none',
          borderRadius: isU ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
          fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
          color: isU ? 'rgba(255,255,255,0.65)' : 'rgba(255,230,210,0.90)',
          fontFamily: 'var(--font-vyan)',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap',
          textShadow: isU ? 'none' : `0 0 14px ${rgba(r1,g1,b1,0.40)}, 0 0 30px ${rgba(r1,g1,b1,0.18)}`,
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
            `0 0 0 1px ${rgba(r1,g1,b1,0.14)}, 0 0 12px ${rgba(r1,g1,b1,0.06)}`,
            `0 0 0 1px ${rgba(r1,g1,b1,0.42)}, 0 0 26px ${rgba(r1,g1,b1,0.17)}`,
            `0 0 0 1px ${rgba(r1,g1,b1,0.14)}, 0 0 12px ${rgba(r1,g1,b1,0.06)}`,
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          maxWidth: 'min(72vw, 320px)',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
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
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.onstart = () => setIsListening(true);
    rec.onend   = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join('');
      onChange(t);
    };
    recognitionRef.current = rec;
    rec.start();
  }, [isListening, onChange]);

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
                padding: '5px 13px', borderRadius: 20,
                border: active ? `1px solid ${rgba(mr,mg,mb,0.65)}` : '1px solid rgba(255,255,255,0.14)',
                background: active ? rgba(mr,mg,mb,0.18) : 'rgba(0,0,0,0.3)',
                color: active ? rgba(mr,mg,mb,0.98) : 'rgba(255,255,255,0.45)',
                fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
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
          {/* Mic / voice button */}
          <button
            onClick={toggleVoice}
            title={isListening ? 'Stop listening' : 'Voice input'}
            style={{
              background: 'transparent', border: 'none', padding: '4px 6px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0,
              color: isListening ? rgba(r1,g1,b1,1) : 'rgba(255,255,255,0.28)',
              transition: 'color 0.2s', position: 'relative', zIndex: 2,
            }}
          >
            {isListening
              ? <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6"/></svg>
                </motion.div>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
            }
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

      {/* ── Watermark cover — solid black patch behind send button ── */}
      <div style={{
        position: 'fixed', right: 0, bottom: 0,
        width: 80, height: 68,
        background: 'rgba(0,0,0,0.98)',
        zIndex: 54, pointerEvents: 'none',
      }} />
      {/* ── Send button — fixed bottom-right, fully opaque ── */}
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          width: 56,
          height: 72,
          borderRadius: '28px 0 0 0',
          border: 'none',
          background: disabled || !value.trim()
            ? `rgb(${Math.round(r1*0.08)},${Math.round(g1*0.08)},${Math.round(b1*0.08)})`
            : `rgb(${r1},${g1},${b1})`,
          color: disabled || !value.trim() ? rgba(r1,g1,b1,0.28) : 'rgba(0,0,0,0.88)',
          cursor: disabled || !value.trim() ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.25s, color 0.25s',
          zIndex: 55,
          paddingBottom: 8,
          paddingLeft: 4,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
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
  const [gsapQueryText, setGsapQueryText]       = useState('');
  const [gsapResponseText, setGsapResponseText] = useState('');
  const [gatePhase, setGatePhase] = useState<'checking' | 'consent' | 'active'>('checking');
  const [guestMode, setGuestMode] = useState(false);
  const [quotaLeft, setQuota]     = useState(99);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modeFlash, setModeFlash]     = useState(0);

  const abortRef        = useRef<AbortController | null>(null);
  const chatBotRef      = useRef<HTMLDivElement>(null);
  const portalRef       = useRef<HTMLDivElement>(null);
  const queryGSAPRef    = useRef<HTMLDivElement>(null);
  const responseGSAPRef = useRef<HTMLDivElement>(null);
  const phaseRef     = useRef(phase);
  const chatIdRef    = useRef(chatId);
  const messagesRef  = useRef(messages);
  const guestModeRef = useRef(guestMode);
  phaseRef.current     = phase;
  chatIdRef.current    = chatId;
  messagesRef.current  = messages;
  guestModeRef.current = guestMode;

  // ── GSAP: initialize centering once the active UI actually mounts ─────────
  useEffect(() => {
    if (gatePhase !== 'active') return;
    // rAF ensures refs are populated after the conditional render
    requestAnimationFrame(() => {
      if (queryGSAPRef.current)
        gsap.set(queryGSAPRef.current,    { xPercent: -50, yPercent: -50, opacity: 0 });
      if (responseGSAPRef.current)
        gsap.set(responseGSAPRef.current, { xPercent: -50, yPercent: -50, opacity: 0 });
    });
  }, [gatePhase]);

  // ── GSAP: 6-step animation timeline driven by phase ────────────────────────
  useEffect(() => {
    const q = queryGSAPRef.current;
    const r = responseGSAPRef.current;
    if (!q || !r) return;

    if (phase === 'absorbing') {
      const userMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
      setGsapQueryText(renderMarkdown(userMsg));
      gsap.killTweensOf([q, r]);
      gsap.set(r, { opacity: 0 });
      // Step 2: query flies from bottom to center
      gsap.fromTo(q,
        { y: 80, scale: 0.85, opacity: 0, z: 0, filter: 'blur(0px)' },
        { y: 0,  scale: 1,    opacity: 1, duration: 0.45, ease: 'power2.out',
          onComplete: () => {
            // Step 3: suck into void
            gsap.to(q, { z: -1200, scale: 0.08, opacity: 0, filter: 'blur(12px)',
              duration: 0.85, ease: 'power2.in' });
          }
        }
      );
    }

    if (phase === 'emerging') {
      const content = streamText || [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
      setGsapResponseText(renderMarkdown(content));
      gsap.killTweensOf(r);
      // Step 5: response emerges from void
      gsap.fromTo(r,
        { z: -1200, scale: 0.3, opacity: 0, filter: 'blur(16px)', y: 0 },
        { z: 0,     scale: 1,   opacity: 1, filter: 'blur(0px)',
          duration: 1.5, ease: 'power2.out' }
      );
    }

    if (phase === 'responding') {
      gsap.to(r, { opacity: 1, z: 0, scale: 1, filter: 'blur(0px)', duration: 0.3 });
    }

    if (phase === 'idle') {
      // Show initial greeting / last response faded
      gsap.killTweensOf([q, r]);
      gsap.to(q, { opacity: 0, duration: 0.4 });
      const lastAsst = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
      if (lastAsst) {
        setGsapResponseText(renderMarkdown(lastAsst));
        gsap.to(r, { opacity: 0.82, z: 0, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power1.out' });
      } else {
        gsap.to(r, { opacity: 0, duration: 0.4 });
      }
    }

    if (phase === 'error') {
      gsap.to([q, r], { opacity: 0, duration: 0.4 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── GSAP: keep response text live during streaming ─────────────────────────
  useEffect(() => {
    if ((phase === 'emerging' || phase === 'responding') && streamText) {
      setGsapResponseText(renderMarkdown(streamText));
    }
  }, [streamText, phase]);

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
    let voidContent = '';
    if (guestMode) {
      const id = newChatId();
      setChatId(id);
      voidContent = buildGreeting(true);
      const greeting: StoredMsg = { id: uid(), role: 'assistant', content: voidContent, mode, ts: Date.now() };
      setMessages([greeting]);
    } else {
      const id = getCurrentChatId() || newChatId();
      setCurrentChatId(id);
      setChatId(id);
      const stored = getChat(id);
      if (stored?.messages?.length) {
        setMessages(stored.messages);
        voidContent = stored.messages.slice().reverse().find(m => m.role === 'assistant')?.content || '';
      } else {
        voidContent = buildGreeting(false);
        const greeting: StoredMsg = { id: uid(), role: 'assistant', content: voidContent, mode, ts: Date.now() };
        setMessages([greeting]);
        upsertChat({ id, title: 'New conversation', messages: [greeting], lastInteractionAt: Date.now(), createdAt: Date.now() });
      }
    }
    // Show greeting / last response in void immediately
    if (voidContent) {
      setTimeout(() => {
        setGsapResponseText(renderMarkdown(voidContent));
        const r = responseGSAPRef.current;
        if (r) gsap.to(r, { opacity: 0.82, z: 0, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power1.out' });
      }, 350);
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

  const switchMode = useCallback((k: CognitiveModeKey) => {
    setMode(k);
    setModeFlash(Date.now());
    setTimeout(() => setModeFlash(0), 500);
  }, []);

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
            {/* Sound toggle + Settings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
              <button
                onClick={() => setSettingsOpen(o => !o)}
                title="Settings"
                style={{
                  background: 'transparent', border: 'none', padding: 8, cursor: 'pointer',
                  color: settingsOpen ? rgba(r1,g1,b1,0.85) : 'rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', transition: 'color 0.2s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Settings panel ───────────────────────────────────────── */}
          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, x: 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 60 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: 'absolute', top: 52, right: 12, zIndex: 20,
                  width: 220,
                  background: 'rgba(4,2,12,0.88)',
                  border: `1px solid ${rgba(r1,g1,b1,0.22)}`,
                  borderRadius: 14,
                  backdropFilter: 'blur(18px)',
                  boxShadow: `0 0 32px ${rgba(r1,g1,b1,0.10)}`,
                  padding: '14px 0',
                }}
              >
                <p style={{
                  fontSize: 8.5, letterSpacing: '0.22em', color: rgba(r1,g1,b1,0.5),
                  textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
                  padding: '0 16px 10px', borderBottom: `1px solid ${rgba(r1,g1,b1,0.10)}`,
                  marginBottom: 6,
                }}>Settings</p>
                {[
                  {
                    label: 'Clear Conversation',
                    icon: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
                    action: () => {
                      setMessages([]);
                      setGsapQueryText('');
                      setGsapResponseText('');
                      setSettingsOpen(false);
                    },
                  },
                  {
                    label: 'Reset Session',
                    icon: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15',
                    action: () => {
                      clearLocalConsent();
                      setGuestMode(false);
                      setGatePhase('consent');
                      setMessages([]);
                      setSettingsOpen(false);
                    },
                  },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', background: 'transparent',
                      border: 'none', padding: '9px 16px', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.60)', fontSize: 12,
                      fontFamily: 'var(--font-vyan)', letterSpacing: '0.04em',
                      textAlign: 'left', transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = `rgb(${r1},${g1},${b1})`)}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.60)')}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={item.icon}/>
                    </svg>
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* ── GSAP text animation layer (perspective parent for z-axis) ── */}
          <div style={{ position: 'fixed', inset: 0, perspective: '1200px', pointerEvents: 'none', zIndex: 15 }}>
            {/* Query text — flies to center then sucks into void */}
            <div
              ref={queryGSAPRef}
              className="medha-md"
              style={{
                position: 'absolute',
                top: '38svh', left: '50%',
                width: 'min(62vw, 380px)',
                textAlign: 'center',
                mixBlendMode: 'screen',
                color: 'rgba(255,235,195,0.88)',
                fontSize: 13,
                lineHeight: 1.65,
                letterSpacing: '0.018em',
                fontFamily: 'var(--font-vyan)',
                textShadow: '0 0 20px rgba(255,160,0,0.75)',
                wordBreak: 'break-word',
                pointerEvents: 'none',
              }}
              dangerouslySetInnerHTML={{ __html: gsapQueryText }}
            />
            {/* Response text — emerges from void, constrained within ring */}
            <div
              ref={responseGSAPRef}
              className="medha-md"
              style={{
                position: 'absolute',
                top: '44svh', left: '50%',
                width: 'min(66vw, 360px)',
                maxHeight: '24svh',
                overflow: 'hidden',
                textAlign: 'center',
                mixBlendMode: 'screen',
                color: 'rgba(255,235,195,0.95)',
                fontSize: 12.5,
                lineHeight: 1.72,
                letterSpacing: '0.022em',
                fontFamily: 'var(--font-vyan)',
                textShadow: '0 0 20px rgba(255,160,0,0.60), 0 0 40px rgba(200,120,255,0.20)',
                wordBreak: 'break-word',
                pointerEvents: 'none',
              }}
              dangerouslySetInnerHTML={{ __html: gsapResponseText }}
            />
          </div>

          {/* ── Mode change flash ────────────────────────────────────── */}
          {modeFlash > 0 && (
            <motion.div
              key={modeFlash}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none',
                background: `radial-gradient(ellipse at 50% 42%, ${rgba(r1,g1,b1,0.45)} 0%, transparent 65%)`,
              }}
            />
          )}

          {/* ── Processing / error label ──────────────────────────────── */}
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

          {/* ── Layout spacer: pushes chat history below lotus (void ends ~62vh, lotus+beads ~76vh) ── */}
          <div ref={portalRef} style={{ flex: '0 0 76svh', minHeight: 0, width: '100%' }} />

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
              // All assistant responses live in the void overlay — only user messages as bubbles
              if (m.role === 'assistant') return null;
              return <ChatBubble key={m.id} msg={m} modeKey={mode} fresh={i === freshIdx} />;
            })}
            {/* StreamBubble removed — streaming content shows in the void via GSAP */}
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
