'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GREETINGS, FACTS, NUDGES, STUCK_PROMPTS, getTimeBucket, pickRandom } from '@/lib/concierge/facts';
import './concierge.css';

type Bubble = { id: string; text: string; kind: 'greet' | 'fact' | 'nudge' | 'stuck'; ttl: number };
type Signal = { id: string; angle: number };

const NAV_ITEMS = [
  { label: 'Vyōma — The Gateway', path: '/vyoma', tone: 'gateway' },
  { label: 'Shunya Void', path: '/shunya', tone: 'shunya' },
  { label: '— Udbhava', path: '/shunya/udbhava', tone: 'shunya-sub' },
  { label: '— Sandhi', path: '/shunya/sandhi', tone: 'shunya-sub' },
  { label: '— Vistāra', path: '/shunya/vistara', tone: 'shunya-sub' },
  { label: '— Medhā', path: '/shunya/medha', tone: 'shunya-sub' },
  { label: 'Vistāra Products', path: '/vistara', tone: 'vistara' },
  { label: '— VYAN Ṛtam', path: '/vistara/ritam', tone: 'vistara-sub' },
  { label: '— VYAN Ojas', path: '/vistara/ojas', tone: 'vistara-sub' },
  { label: '— VYAN Mudrā', path: '/vistara/mudra', tone: 'vistara-sub' },
  { label: '— VYAN Netra', path: '/vistara/netra', tone: 'vistara-sub' },
  { label: '— VYAN Ākṛti', path: '/vistara/akriti', tone: 'vistara-sub' },
  { label: '— VYAN Sūtra', path: '/vistara/sutra', tone: 'vistara-sub' },
  { label: 'Medhā — Type to AI', path: '/medha', tone: 'medha' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export default function ConciergeOrb() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const lastPathRef = useRef(pathname);
  const onOrbSinceRef = useRef(Date.now());

  // Hide concierge entirely on the Medhā HUD route (where the user is typing).
  const visible = !pathname?.startsWith('/medha');

  // Reset stuck timer whenever pathname changes.
  useEffect(() => {
    if (pathname !== lastPathRef.current) {
      lastPathRef.current = pathname;
      onOrbSinceRef.current = Date.now();
    }
  }, [pathname]);

  // ---------- Speak helpers ----------
  const speakStatic = useCallback((kind: Bubble['kind']) => {
    let text = '';
    if (kind === 'greet') text = pickRandom(GREETINGS[getTimeBucket()]);
    else if (kind === 'fact') text = pickRandom(FACTS);
    else if (kind === 'nudge') text = pickRandom(NUDGES);
    else text = pickRandom(STUCK_PROMPTS);
    const ttl = Math.max(5000, Math.min(11000, text.length * 90));
    setBubble({ id: uid(), text, kind, ttl });
  }, []);

  const speakFromGemini = useCallback(async (kind: Bubble['kind']) => {
    const style =
      'You are the Concierge of VYAN — a brief, warm, slightly-cosmic guide. ' +
      'Reply in ONE short sentence (12–20 words). No emojis, no markdown.';
    let prompt = '';
    if (kind === 'greet') {
      prompt = `Greet a visitor of the VYAN cosmic website. Time of day: ${getTimeBucket()}. They are exploring orbs of consciousness. Be warm, brief, slightly mystical.`;
    } else if (kind === 'fact') {
      prompt = 'Share ONE fascinating Did-You-Know fact about the evolution of AI / language models / cognition (post-2020). 18 words max. Start with "Did you know—".';
    } else if (kind === 'nudge') {
      prompt = 'Suggest the visitor explore the Vistāra products or talk to Medhā (the conversational AI). One short sentence.';
    } else {
      prompt = 'The visitor has lingered. Gently ask if they need help navigating. One short sentence, kind tone.';
    }
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style }),
      });
      if (!res.ok) throw new Error('upstream');
      const data = await res.json();
      const text: string = (data?.text ?? '').trim();
      if (!text) throw new Error('empty');
      const ttl = Math.max(5000, Math.min(12000, text.length * 95));
      setBubble({ id: uid(), text, kind, ttl });
      // If this is a fact, summon signal orbs to deliver it.
      if (kind === 'fact') triggerSignalExchange();
    } catch {
      // Fallback to curated rotation — user never sees an error.
      speakStatic(kind);
      if (kind === 'fact') triggerSignalExchange();
    }
  }, [speakStatic]);

  // ---------- Signal-orb cinematic ----------
  const triggerSignalExchange = useCallback(() => {
    const count = 2 + Math.floor(Math.random() * 2);
    const newSignals: Signal[] = [];
    for (let i = 0; i < count; i++) {
      newSignals.push({ id: uid(), angle: Math.random() * 360 });
    }
    setSignals((prev) => [...prev, ...newSignals]);
    // Auto-clean after the animation completes (3.4s)
    setTimeout(() => {
      setSignals((prev) => prev.filter((s) => !newSignals.find((n) => n.id === s.id)));
    }, 3600);
  }, []);

  // ---------- Auto-collapse bubble ----------
  useEffect(() => {
    if (!bubble) return;
    const id = setTimeout(() => setBubble(null), bubble.ttl);
    return () => clearTimeout(id);
  }, [bubble]);

  // ---------- Initial greeting (2.5s after mount) ----------
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => speakFromGemini('greet'), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ---------- 30s rotation loop ----------
  useEffect(() => {
    if (!visible) return;
    const tick = setInterval(() => {
      const pool: Bubble['kind'][] = ['fact', 'fact', 'nudge', 'fact'];
      speakFromGemini(pickRandom(pool));
    }, 30000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ---------- 60s stuck-on-one-orb nudge ----------
  useEffect(() => {
    if (!visible) return;
    const stuck = setInterval(() => {
      if (Date.now() - onOrbSinceRef.current > 60000) {
        speakFromGemini('stuck');
        onOrbSinceRef.current = Date.now();
      }
    }, 10000);
    return () => clearInterval(stuck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const navigateTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  if (!visible) return null;

  return (
    <div className="concierge-root">
      {/* Bubble (above the orb) */}
      {bubble && (
        <div key={bubble.id} className={`concierge-bubble concierge-bubble--${bubble.kind}`}>
          <span>{bubble.text}</span>
          {bubble.kind === 'nudge' && (
            <button
              type="button"
              className="concierge-bubble__cta"
              onClick={() => router.push('/medha')}
            >
              Open Medhā →
            </button>
          )}
        </div>
      )}

      {/* Signal orbs cinematic */}
      {signals.map((s) => (
        <span
          key={s.id}
          className="concierge-signal"
          style={{
            ['--ang' as any]: `${s.angle}deg`,
          }}
        />
      ))}

      {/* Concierge orb */}
      <button
        type="button"
        className={`concierge-orb ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Concierge"
      >
        <span className="concierge-orb__halo" />
        <span className="concierge-orb__core" />
        <span className="concierge-orb__ring" />
      </button>

      {/* Quick-nav glass panel */}
      {open && (
        <div className="concierge-nav" role="menu">
          <header className="concierge-nav__head">
            <span className="concierge-nav__dot" />
            <div>
              <div className="concierge-nav__title">Concierge</div>
              <div className="concierge-nav__sub">Quick traverse</div>
            </div>
          </header>
          <div className="concierge-nav__list">
            {NAV_ITEMS.map((n) => (
              <button
                key={n.path}
                type="button"
                className={`concierge-nav__item concierge-nav__item--${n.tone}`}
                onClick={() => navigateTo(n.path)}
              >
                <span>{n.label}</span>
                <span className="concierge-nav__arrow">→</span>
              </button>
            ))}
          </div>
          <footer className="concierge-nav__foot">
            Concierge guides only. For conversation → Medhā.
          </footer>
        </div>
      )}
    </div>
  );
}
