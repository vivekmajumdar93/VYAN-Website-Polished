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

// ── CosmicPortal ──────────────────────────────────────────────────────────────
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

    type Spark = { a: number; spd: number; br: number; sz: number };
    const sparks: Spark[] = Array.from({ length: 38 }, (_, i) => ({
      a: (i / 38) * Math.PI * 2,
      spd: 0.0025 + Math.random() * 0.0035,
      br: 0.3 + Math.random() * 0.7,
      sz: 1.0 + Math.random() * 1.8,
    }));

    let raf: number, t = 0;

    const draw = () => {
      t++;
      ctx.clearRect(0, 0, S, S);
      const ph = phaseRef.current;
      const [r1, g1, b1, r2, g2, b2] = MC[modeRef.current];

      let breathe = 0, spkMul = 1, glow = 1, innerB = 0, ringW = 1.5;
      switch (ph) {
        case 'idle':
          breathe = 4 * Math.sin(t * 0.016); spkMul = 0.55; glow = 0.7; break;
        case 'absorbing':
          breathe = 12 * Math.sin(t * 0.09); spkMul = 4.5; glow = 1.7;
          innerB = 0.35 + 0.25 * Math.sin(t * 0.11); ringW = 2.5; break;
        case 'processing':
          breathe = 6 * Math.sin(t * 0.045); spkMul = 2.6; glow = 1.15;
          innerB = 0.18 + 0.12 * Math.sin(t * 0.065); ringW = 2.0; break;
        case 'emerging':
          breathe = 8 * Math.sin(t * 0.038); spkMul = 1.8; glow = 1.35;
          innerB = 0.55 + 0.22 * Math.sin(t * 0.05); ringW = 2.2; break;
        case 'responding':
          breathe = 5 * Math.sin(t * 0.022); spkMul = 1.1; glow = 1.0;
          innerB = 0.1; break;
        case 'error':
          breathe = 3 * Math.sin(t * 0.03); spkMul = 0.4; glow = 0.5; break;
      }

      const R = innerR + breathe;

      // outer atmospheric halo
      {
        const hg = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.6);
        hg.addColorStop(0, rgba(r1, g1, b1, 0.1 * glow));
        hg.addColorStop(0.5, rgba(r2, g2, b2, 0.05 * glow));
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2);
        ctx.fillStyle = hg; ctx.fill();
      }

      // inner void
      {
        const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.98);
        vg.addColorStop(0,   'rgba(0,0,0,0.99)');
        vg.addColorStop(0.4, 'rgba(3,0,10,0.98)');
        vg.addColorStop(0.75,'rgba(8,2,22,0.96)');
        vg.addColorStop(1,   'rgba(16,3,42,0.93)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
        ctx.fillStyle = vg; ctx.fill();
      }

      // inner shimmer
      if (innerB > 0) {
        const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.65);
        sg.addColorStop(0, rgba(r1, g1, b1, innerB * 0.28));
        sg.addColorStop(0.5, rgba(r2, g2, b2, innerB * 0.14));
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = sg; ctx.fill();
      }

      // ring wide glow
      ctx.save();
      ctx.lineWidth = 14;
      ctx.strokeStyle = rgba(r1, g1, b1, 0.16 * glow);
      ctx.shadowColor = rgba(r2, g2, b2, 0.55 * glow);
      ctx.shadowBlur = 28;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();

      // ring edge (gradient, rotating)
      {
        const ang = t * 0.008;
        const rg = ctx.createLinearGradient(
          cx + R * Math.cos(ang), cy + R * Math.sin(ang),
          cx + R * Math.cos(ang + Math.PI), cy + R * Math.sin(ang + Math.PI),
        );
        rg.addColorStop(0,    rgba(r1, g1, b1, 0.95 * glow));
        rg.addColorStop(0.3,  rgba(r2, g2, b2, 0.78 * glow));
        rg.addColorStop(0.6,  rgba(8, 4, 16, 0.6 * glow));
        rg.addColorStop(1,    rgba(r1, g1, b1, 0.95 * glow));
        ctx.save();
        ctx.lineWidth = ringW;
        ctx.strokeStyle = rg;
        ctx.shadowColor = rgba(r1, g1, b1, 0.7 * glow);
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // subtle inner ring
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = rgba(r2, g2, b2, 0.12 * glow);
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.83, 0, Math.PI * 2); ctx.stroke();

      // energy sparks
      for (const sp of sparks) {
        sp.a += sp.spd * spkMul;
        const sx = cx + R * Math.cos(sp.a);
        const sy = cy + R * Math.sin(sp.a);
        const twinkle = 0.5 + 0.5 * Math.sin(t * 0.055 + sp.a * 3.1);
        const op = sp.br * twinkle * Math.min(glow, 1.3);
        const bigPhase = ph === 'absorbing' || ph === 'processing';
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, sp.sz * (bigPhase ? 1.7 : 1.0), 0, Math.PI * 2);
        ctx.fillStyle = rgba(r1, g1, b1, op * 0.88);
        ctx.shadowColor = rgba(r1, g1, b1, op * 0.45);
        ctx.shadowBlur = 7;
        ctx.fill();
        ctx.restore();
      }

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
        width: Math.min(S, 400),
        height: Math.min(S, 400),
        maxWidth: '95vw',
        maxHeight: '95vw',
      }}
    />
  );
}

// ── Orb above portal ──────────────────────────────────────────────────────────
function PortalOrb({ modeKey }: { modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: 20, height: 20, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), ${rgba(r1,g1,b1,0.8)})`,
        boxShadow: `0 0 14px ${rgba(r1,g1,b1,0.9)}, 0 0 28px ${rgba(r1,g1,b1,0.4)}`,
        margin: '0 auto',
      }}
    />
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
          : { duration: 1.1,  ease: [0.08, 0.95, 0.3, 1.0] }
        : { duration: 0 }
      }
      style={{
        display: 'flex',
        flexDirection: 'column',
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
      <div style={{
        maxWidth: 'min(72vw, 320px)',
        padding: isU ? '9px 13px' : '11px 14px',
        background: isU
          ? 'rgba(255,255,255,0.05)'
          : `rgba(${r1},${g1},${b1},0.07)`,
        border: isU
          ? '1px solid rgba(255,255,255,0.08)'
          : `1px solid ${rgba(r1, g1, b1, 0.18)}`,
        borderRadius: isU ? '14px 14px 3px 14px' : '3px 14px 14px 14px',
        fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
        color: isU ? 'rgba(255,255,255,0.78)' : 'rgba(255,230,210,0.90)',
        fontFamily: 'var(--font-vyan)',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        textShadow: isU ? 'none'
          : `0 0 12px ${rgba(r1,g1,b1,0.35)}, 0 0 28px ${rgba(r1,g1,b1,0.15)}`,
      }}>
        {msg.role === 'assistant'
          ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} className="medha-md" />
          : msg.content
        }
      </div>
    </motion.div>
  );
}

// ── StreamBubble: AI response being typed into existence ──────────────────────
function StreamBubble({
  text, modeKey,
}: { text: string; modeKey: CognitiveModeKey }) {
  const [r1, g1, b1] = MC[modeKey];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.06, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.95, ease: [0.08, 0.95, 0.3, 1.0] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 10,
        transformOrigin: 'top center',
      }}
    >
      <span style={{
        fontSize: 9, letterSpacing: '0.22em', color: rgba(r1, g1, b1, 0.5),
        marginBottom: 4, textTransform: 'uppercase', fontFamily: 'var(--font-vyan)',
      }}>
        MEDHĀ
      </span>
      <div style={{
        maxWidth: 'min(72vw, 320px)',
        padding: '11px 14px',
        background: `rgba(${r1},${g1},${b1},0.07)`,
        border: `1px solid ${rgba(r1, g1, b1, 0.18)}`,
        borderRadius: '3px 14px 14px 14px',
        fontSize: 12.5, lineHeight: '1.68', letterSpacing: '0.018em',
        color: 'rgba(255,230,210,0.90)',
        fontFamily: 'var(--font-vyan)',
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        textShadow: `0 0 12px ${rgba(r1,g1,b1,0.35)}, 0 0 28px ${rgba(r1,g1,b1,0.15)}`,
        minHeight: 40,
      }}>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text || '…') }} className="medha-md" />
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          style={{ display: 'inline-block', width: 1, height: '1em', background: rgba(r1,g1,b1,0.8), marginLeft: 2, verticalAlign: 'text-bottom' }}
        />
      </div>
    </motion.div>
  );
}

// ── Input bar ─────────────────────────────────────────────────────────────────
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
  const ref = useRef<HTMLTextAreaElement>(null);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
      padding: '10px 14px 14px',
      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)',
    }}>
      {/* Mode pills */}
      <div style={{
        display: 'flex', gap: 5, justifyContent: 'center',
        marginBottom: 8, overflowX: 'auto', paddingBottom: 2,
      }}>
        {COGNITIVE_MODES.map(m => {
          const [mr, mg, mb] = MC[m.key];
          const active = m.key === modeKey;
          return (
            <button key={m.key} onClick={() => onModeChange(m.key)}
              style={{
                padding: '3px 10px', borderRadius: 20,
                border: active ? `1px solid ${rgba(mr,mg,mb,0.6)}` : '1px solid rgba(255,255,255,0.1)',
                background: active ? rgba(mr,mg,mb,0.15) : 'transparent',
                color: active ? rgba(mr,mg,mb,0.95) : 'rgba(255,255,255,0.3)',
                fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase',
                fontFamily: 'var(--font-vyan)', cursor: 'pointer',
                transition: 'all 0.2s', flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
              {m.name}
            </button>
          );
        })}
      </div>

      {/* Input row */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        background: 'rgba(10,6,20,0.72)',
        border: `1px solid ${rgba(r1,g1,b1,0.22)}`,
        borderRadius: 20,
        padding: '8px 10px 8px 14px',
        backdropFilter: 'blur(14px)',
        boxShadow: `0 0 28px ${rgba(r1,g1,b1,0.1)}`,
      }}>
        <textarea
          ref={ref} value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKey}
          disabled={disabled}
          placeholder={disabled ? 'MEDHĀ is weaving…' : 'Enter the void…'}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'rgba(255,230,200,0.88)', fontSize: 13.5,
            fontFamily: 'var(--font-vyan)', resize: 'none', lineHeight: '1.5',
            letterSpacing: '0.02em',
            maxHeight: 100, overflowY: 'auto',
          }}
          onInput={e => {
            const el = e.currentTarget;
            el.style.height = '0';
            el.style.height = Math.min(el.scrollHeight, 100) + 'px';
          }}
        />
        <button onClick={onSubmit} disabled={disabled || !value.trim()}
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            border: `1px solid ${rgba(r1,g1,b1, disabled || !value.trim() ? 0.2 : 0.55)}`,
            background: disabled || !value.trim() ? 'transparent' : rgba(r1,g1,b1,0.18),
            color: disabled || !value.trim() ? rgba(r1,g1,b1,0.25) : rgba(r1,g1,b1,0.95),
            cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {quotaLeft <= 3 && quotaLeft > 0 && (
        <p style={{
          textAlign: 'center', fontSize: 9.5, color: rgba(r1,g1,b1,0.4),
          letterSpacing: '0.14em', margin: '6px 0 0',
          fontFamily: 'var(--font-vyan)',
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

  // ── Core state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<Phase>('idle');
  const [mode, setMode]           = useState<CognitiveModeKey>('dhyana');
  const [chatId, setChatId]       = useState('');
  const [messages, setMessages]   = useState<StoredMsg[]>([]);
  const [input, setInput]         = useState('');
  const [streamText, setStream]   = useState('');
  const [errorMsg, setError]      = useState('');
  const [freshIdx, setFreshIdx]   = useState(-1);  // index of the last fresh message
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

  // ── Init ───────────────────────────────────────────────────────────────────
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
      const greeting: StoredMsg = {
        id: uid(), role: 'assistant', content: GREET_NEW, mode, ts: Date.now(),
      };
      setMessages([greeting]);
      upsertChat({
        id, title: 'New conversation',
        messages: [greeting],
        lastInteractionAt: Date.now(),
        createdAt: Date.now(),
      });
    }
  }, [consentDone]); // eslint-disable-line

  // Auto-scroll
  useEffect(() => {
    if (chatBotRef.current) {
      chatBotRef.current.scrollTop = chatBotRef.current.scrollHeight;
    }
  }, [messages, streamText]);

  // ── Consent callback ───────────────────────────────────────────────────────
  const onConsent = useCallback((_snap: ConsentSnapshot) => {
    setConsent(true);
    setQuota(quotaRemaining('medha'));
  }, []);

  // ── Mode switch ────────────────────────────────────────────────────────────
  const switchMode = useCallback((k: CognitiveModeKey) => {
    setMode(k);
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────────
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

    // Calculate flight delta for the animation
    let deltaY = -300;
    if (portalRef.current) {
      const pr = portalRef.current.getBoundingClientRect();
      const portalCenterY = pr.top + pr.height / 2;
      const inputY = window.innerHeight - 90;
      deltaY = portalCenterY - inputY;
    }
    setFlyDeltaY(deltaY);
    setFlying(text);
    setInput('');
    setPhase('absorbing');

    // Absorbing animation runs for 650ms, then we transition to processing
    const { ok } = incrementQuota('medha');
    setQuota(quotaRemaining('medha'));

    const userMsg: StoredMsg = { id: uid(), role: 'user', content: text, mode, ts: Date.now() };

    setTimeout(async () => {
      setFlying(null);
      setPhase('processing');

      // Add user msg to history
      setMessages(prev => {
        const next = [...prev, userMsg];
        setFreshIdx(next.length - 1);
        return next;
      });

      // Start API call
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const history: ChatMessage[] = [
        ...messagesRef.current.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: text },
      ];

      let full = '';
      let isFirst = true;

      await chatStream(
        getMode(mode),
        history,
        {
          onChunk: (chunk) => {
            if (isFirst) {
              isFirst = false;
              setPhase('emerging');
              setStream(chunk);
            } else {
              setStream(prev => prev + chunk);
            }
            full += chunk;
          },
          onDone: (finalText) => {
            full = finalText;
            const assistantMsg: StoredMsg = {
              id: uid(), role: 'assistant', content: finalText, mode, ts: Date.now(),
            };
            setMessages(prev => {
              const next = [...prev, assistantMsg];
              setFreshIdx(next.length - 1);
              const cid = chatIdRef.current;
              const summary = text.slice(0, 55);
              upsertChat({
                id: cid, title: summary,
                messages: next,
                lastInteractionAt: Date.now(),
                createdAt: Date.now(),
              });
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
        },
        ctrl.signal,
      );
    }, 650);
  }, [input, mode, messages, chatId, quotaLeft]);

  // ── Back navigation ────────────────────────────────────────────────────────
  const goBack = () => router.push('/vistara');

  // ── Quota exhausted ────────────────────────────────────────────────────────
  if (quotaLeft <= 0 && !consentDone) {
    return (
      <div style={{
        position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'rgba(0,0,0,0.9)',
        fontFamily: 'var(--font-vyan)', color: 'rgba(255,200,180,0.8)',
        textAlign: 'center', padding: 24,
      }}>
        <div>
          <p style={{ fontSize: 13, letterSpacing: '0.08em', marginBottom: 16 }}>
            MEDHĀ quota reached. Please register to continue.
          </p>
          <MedhaConsentSlab onConsent={onConsent} />
        </div>
      </div>
    );
  }

  // ── Consent gate ───────────────────────────────────────────────────────────
  if (!consentDone) {
    return <MedhaConsentSlab onConsent={onConsent} />;
  }

  const [r1, g1, b1] = MC[mode];
  const isActive = phase !== 'idle' && phase !== 'error';

  // Portal ring inner radius — responsive
  const innerR = typeof window !== 'undefined'
    ? Math.min(130, (window.innerWidth * 0.4) / 2)
    : 130;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 30,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      overflow: 'hidden',
    }}>

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
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

        <span style={{
          fontSize: 10, letterSpacing: '0.3em', color: rgba(r1, g1, b1, 0.5),
          fontFamily: 'var(--font-vyan)', textTransform: 'uppercase',
        }}>
          MEDHĀ
        </span>

        <div style={{ width: 68 }} /> {/* spacer */}
      </div>

      {/* ── Portal section (upper half) ────────────────────────────────── */}
      <div
        ref={portalRef}
        style={{
          flex: '0 0 auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 'max(60px, 8vh)',
        }}
      >
        <PortalOrb modeKey={mode} />
        <div style={{ marginTop: 8 }}>
          <CosmicPortal phase={phase} modeKey={mode} innerR={innerR} />
        </div>

        {/* Status label */}
        <div style={{ minHeight: 22, marginTop: 2 }}>
          <AnimatePresence mode="wait">
            {phase === 'processing' && (
              <ProcessingLabel key="proc" modeKey={mode} />
            )}
            {phase === 'error' && (
              <motion.p
                key="err"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                  fontSize: 9.5, letterSpacing: '0.18em', color: 'rgba(255,100,100,0.65)',
                  fontFamily: 'var(--font-vyan)', textAlign: 'center',
                }}
              >
                {errorMsg || 'Signal lost — try again'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Chat history ───────────────────────────────────────────────── */}
      <div
        ref={chatBotRef}
        style={{
          flex: 1, width: '100%', maxWidth: 520,
          overflowY: 'auto', overflowX: 'hidden',
          padding: '12px 16px 120px',
          scrollbarWidth: 'none',
        }}
        onTouchStart={(e) => { (e.currentTarget as any)._touchY = e.touches[0].clientY; }}
        onTouchMove={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          const dy = (el as any)._touchY - e.touches[0].clientY;
          (el as any)._touchY = e.touches[0].clientY;
          el.scrollTop += dy;
        }}
      >
        {/* fade top */}
        <div style={{
          position: 'sticky', top: 0, height: 36,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none', marginBottom: -36, zIndex: 1,
        }} />

        {messages.map((m, i) => (
          <ChatBubble
            key={m.id} msg={m} modeKey={mode}
            fresh={i === freshIdx}
          />
        ))}

        {/* Streaming response */}
        <AnimatePresence>
          {streamText && (
            <StreamBubble key="stream" text={streamText} modeKey={mode} />
          )}
        </AnimatePresence>
      </div>

      {/* ── Lotus decoration ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 155, left: '50%', transform: 'translateX(-50%)',
        pointerEvents: 'none', opacity: 0.18,
      }}>
        <svg width="28" height="18" viewBox="0 0 60 36" fill="none">
          <path d="M30 32 C18 32 8 24 8 16 C8 10 14 6 20 8 C22 2 26 0 30 0 C34 0 38 2 40 8 C46 6 52 10 52 16 C52 24 42 32 30 32Z"
            fill={rgba(r1, g1, b1, 1)} />
          <path d="M30 32 C22 28 16 20 16 14 C16 10 22 8 26 10 C27 6 28 4 30 4 C32 4 33 6 34 10 C38 8 44 10 44 14 C44 20 38 28 30 32Z"
            fill={rgba(r1, g1, b1, 0.5)} />
        </svg>
      </div>

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <InputBar
        value={input}
        onChange={setInput}
        onSubmit={submit}
        disabled={phase !== 'idle'}
        modeKey={mode}
        onModeChange={switchMode}
        quotaLeft={quotaLeft}
      />

      {/* ── Flying text overlay (absorption animation) ─────────────────── */}
      <AnimatePresence>
        {flyingText && (
          <motion.div
            initial={{ opacity: 1, scale: 1, y: 0 }}
            animate={{ opacity: 0, scale: 0.04, y: flyDeltaY }}
            transition={{ duration: 0.65, ease: [0.4, 0, 0.8, 1] }}
            style={{
              position: 'fixed',
              bottom: 86,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              maxWidth: 280,
              padding: '9px 13px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px 14px 3px 14px',
              fontSize: 12.5, lineHeight: '1.6',
              color: 'rgba(255,255,255,0.78)',
              fontFamily: 'var(--font-vyan)',
              pointerEvents: 'none',
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
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
