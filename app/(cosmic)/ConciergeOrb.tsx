'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { GREETINGS, FACTS, NUDGES, STUCK_PROMPTS, getTimeBucket, pickRandom } from '@/lib/concierge/facts';
import ConciergePlexusCanvas from './ConciergePlexusCanvas';
import './concierge.css';

type Bubble = { id: string; text: string; kind: 'greet' | 'fact' | 'nudge' | 'stuck'; ttl: number };
type Signal = { id: string; angle: number };

// Hierarchical nav: Vistāra collapses into a dropdown so the panel stays short.
type NavLeaf = { label: string; path: string };
type NavSection = { id: string; label: string; tone: string; path?: string; children?: NavLeaf[]; defaultOpen?: boolean };

const NAV_SECTIONS: NavSection[] = [
  { id: 'gateway', label: 'Vyōma — The Gateway', tone: 'gateway', path: '/vyoma' },
  {
    id: 'shunya', label: 'Shunya Mandala', tone: 'shunya', path: '/shunya', defaultOpen: true,
    children: [
      { label: 'Udbhava — The Emergence', path: '/shunya/udbhava' },
      { label: 'Sandhi — The Communiqué', path: '/shunya/sandhi' },
      { label: 'Vyūha — The Design Seam', path: '/shunya/vyuha' },
      { label: 'Saṅkalpa — The Intention', path: '/shunya/sankalpa' },
      { label: 'Vistāra — The Unfurling', path: '/shunya/vistara' },
      { label: 'Medhā — The Consciousness', path: '/shunya/medha' },
    ],
  },
  {
    id: 'vistara', label: 'Vistāra Products', tone: 'vistara', path: '/vistara',
    children: [
      { label: 'VYAN Ṛtam', path: '/vistara/ritam' },
      { label: 'VYAN Ojas', path: '/vistara/ojas' },
      { label: 'VYAN Mudrā', path: '/vistara/mudra' },
      { label: 'VYAN Netra', path: '/vistara/netra' },
      { label: 'VYAN Ākṛti', path: '/vistara/akriti' },
      { label: 'VYAN Sūtra', path: '/vistara/sutra' },
    ],
  },
  { id: 'medha', label: 'Medhā — Speak to AI', tone: 'medha', path: '/medha' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

// SVG plexus pattern — procedurally placed nodes connected by short lines.
function PlexusPattern() {
  const nodes = [
    { x: 32, y: 8 }, { x: 50, y: 14 }, { x: 12, y: 22 }, { x: 28, y: 28 }, { x: 46, y: 30 },
    { x: 8,  y: 38 }, { x: 22, y: 44 }, { x: 40, y: 46 }, { x: 56, y: 40 }, { x: 16, y: 56 },
    { x: 34, y: 56 }, { x: 50, y: 56 }, { x: 26, y: 12 }, { x: 6,  y: 30 }, { x: 56, y: 24 },
  ];
  const links: Array<[number, number]> = [
    [0,1],[0,3],[1,4],[2,3],[2,5],[3,4],[3,6],[4,7],[4,8],[5,6],[6,7],[7,8],[6,9],[7,10],[8,11],[9,10],[10,11],[12,0],[12,3],[13,5],[14,1],[14,8],
  ];
  return (
    <svg className="concierge-plexus" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="node-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="60%" stopColor="#cba6ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#7a3cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="concierge-plexus__lines">
        {links.map((l, idx) => (
          <line
            key={idx}
            x1={nodes[l[0]].x} y1={nodes[l[0]].y}
            x2={nodes[l[1]].x} y2={nodes[l[1]].y}
            stroke="rgba(206, 173, 255, 0.42)" strokeWidth="0.35"
          />
        ))}
      </g>
      <g className="concierge-plexus__nodes">
        {nodes.map((n, idx) => (
          <circle key={idx} cx={n.x} cy={n.y} r={1.05 + (idx % 3) * 0.25} fill="url(#node-grad)" />
        ))}
      </g>
    </svg>
  );
}

export default function ConciergeOrb() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [hovered, setHovered] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    shunya: true,
    vistara: false,
  });
  const lastPathRef = useRef(pathname);
  const onOrbSinceRef = useRef(Date.now());

  // Hide concierge entirely on the Medhā HUD route (where the user is typing).
  const visible = true; // Nāvika is now visible on every page including /medha (per user spec)

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
      if (kind === 'fact') triggerSignalExchange();
    } catch {
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
    setTimeout(() => {
      setSignals((prev) => prev.filter((s) => !newSignals.find((n) => n.id === s.id)));
    }, 3600);
  }, []);

  // Auto-collapse bubble
  useEffect(() => {
    if (!bubble) return;
    const id = setTimeout(() => setBubble(null), bubble.ttl);
    return () => clearTimeout(id);
  }, [bubble]);

  // Initial greeting (3s after mount)
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => speakFromGemini('greet'), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Rotation loop — slowed to 45s to conserve quota.
  useEffect(() => {
    if (!visible) return;
    const tick = setInterval(() => {
      const pool: Bubble['kind'][] = ['fact', 'fact', 'nudge'];
      speakFromGemini(pickRandom(pool));
    }, 45000);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // 90s stuck nudge (rare).
  useEffect(() => {
    if (!visible) return;
    const stuck = setInterval(() => {
      if (Date.now() - onOrbSinceRef.current > 90000) {
        speakFromGemini('stuck');
        onOrbSinceRef.current = Date.now();
      }
    }, 15000);
    return () => clearInterval(stuck);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const navigateTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!visible) return null;

  return (
    <div className={`concierge-root ${hovered ? 'is-hovered' : ''}`}>
      {/* Bubble (left of orb) */}
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
          style={{ ['--ang' as any]: `${s.angle}deg` }}
        />
      ))}

      {/* Mini plexus orb — floats gently within its zone */}
      <button
        type="button"
        className={`concierge-orb ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Concierge"
      >
        <span className="concierge-orb__halo" />
        <span className="concierge-orb__shell">
          <span className="concierge-orb__neural-canvas">
            <ConciergePlexusCanvas size={160} />
          </span>
        </span>
      </button>

      {/* Quick-nav glass panel — collapsible sections, short by default */}
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
            {NAV_SECTIONS.map((sec) => {
              const hasChildren = !!sec.children?.length;
              const isExpanded = openSections[sec.id] ?? sec.defaultOpen ?? false;
              return (
                <div key={sec.id} className={`concierge-nav__sec concierge-nav__sec--${sec.tone}`}>
                  <div className="concierge-nav__sec-head">
                    <button
                      type="button"
                      className="concierge-nav__item"
                      onClick={() => sec.path ? navigateTo(sec.path) : toggleSection(sec.id)}
                    >
                      <span>{sec.label}</span>
                      <span className="concierge-nav__arrow">→</span>
                    </button>
                    {hasChildren && (
                      <button
                        type="button"
                        className={`concierge-nav__chev ${isExpanded ? 'is-open' : ''}`}
                        onClick={() => toggleSection(sec.id)}
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                          <path d="M2 4 L5 7 L8 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {hasChildren && isExpanded && (
                    <div className="concierge-nav__children">
                      {sec.children!.map((c) => (
                        <button
                          key={c.path}
                          type="button"
                          className="concierge-nav__sub-item"
                          onClick={() => navigateTo(c.path)}
                        >
                          <span className="concierge-nav__bullet" />
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <footer className="concierge-nav__foot">
            Concierge guides only. For conversation → Medhā.
          </footer>
        </div>
      )}
    </div>
  );
}
