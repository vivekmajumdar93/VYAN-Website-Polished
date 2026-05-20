'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  COGNITIVE_MODES,
  CognitiveMode,
  CognitiveModeKey,
  getMode,
} from '@/lib/medha/cognitive';
import { chatStream, type ChatMessage } from '@/lib/medha/MedhaClient';
import './medha.css';

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: CognitiveModeKey;
  streaming?: boolean;
};

const uid = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

export default function MedhaHUD() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<CognitiveModeKey>('prajna');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const mode: CognitiveMode = getMode(activeMode);

  // Auto-scroll thread to bottom on new content.
  useEffect(() => {
    const el = railRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Focus the composer on mount; Esc returns to /shunya.
  useEffect(() => {
    inputRef.current?.focus();

    // CRITICAL: when the user lands on /medha via the portal burst, the
    // previous route's fade-to-black overlay is still alive at z-index 10000.
    // Since modeFromPath('/medha') === 'shunya' (canvas backdrop), setMode is
    // a no-op (we were already in shunya), so fadeFromBlack is never fired
    // by the realm. We clear the fade overlay manually so the HUD is visible.
    const clearFade = () => {
      try {
        document.querySelectorAll('[data-vyan-fade="1"]').forEach((el) => {
          (el as HTMLElement).style.transition = 'opacity 0.7s ease-out';
          (el as HTMLElement).style.opacity = '0';
          setTimeout(() => el.remove(), 800);
        });
        const ui = document.querySelector('.vyan-ui') as HTMLElement | null;
        if (ui) {
          ui.style.transition = 'opacity 0.6s ease-out';
          ui.style.opacity = '0';
          ui.style.pointerEvents = 'none';
        }
      } catch {}
    };
    clearFade();
    // Also run once more after the first frame in case the overlay was added
    // mid-flight by an in-progress portal transition.
    const id = setTimeout(clearFade, 250);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/shunya/medha');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener('keydown', onKey);
      // Restore .vyan-ui on unmount so Shunya/Vistara HUD comes back.
      const ui = document.querySelector('.vyan-ui') as HTMLElement | null;
      if (ui) {
        ui.style.transition = 'opacity 0.6s ease-out';
        ui.style.opacity = '1';
        ui.style.pointerEvents = 'auto';
      }
    };
  }, [router]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    const userMsg: Msg = { id: uid(), role: 'user', content: text, mode: activeMode };
    const aiId = uid();
    setMessages(prev => [
      ...prev,
      userMsg,
      { id: aiId, role: 'assistant', content: '', mode: activeMode, streaming: true },
    ]);
    setBusy(true);

    // Build history payload — last 12 messages, role-mapped.
    const history: ChatMessage[] = [...messages, userMsg]
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    await chatStream(
      mode,
      history,
      {
        onChunk: (delta) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === aiId ? { ...m, content: m.content + delta } : m,
            ),
          );
        },
        onDone: () => {
          setMessages(prev =>
            prev.map(m => (m.id === aiId ? { ...m, streaming: false } : m)),
          );
          setBusy(false);
        },
        onError: (e) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === aiId
                ? { ...m, content: `⚠ Cognition unreachable. ${e.message}`, streaming: false }
                : m,
            ),
          );
          setBusy(false);
        },
      },
      ac.signal,
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearThread() {
    abortRef.current?.abort();
    setMessages([]);
    setBusy(false);
  }

  // Dynamic CSS variables tinted by the active mode.
  const styleVars: React.CSSProperties = {
    ['--medha-a' as any]: mode.colorA,
    ['--medha-b' as any]: mode.colorB,
  };

  return (
    <div className="medha-shell" style={styleVars}>
      {/* TOP SPINE — cognitive mode selector arc */}
      <header className="medha-spine">
        <div className="medha-spine__brand">
          <div className="medha-spine__brand-row">
            <span className="medha-spine__eye" aria-hidden="true">
              <span className="medha-spine__eye-pulse" />
              <span className="medha-spine__eye-core" />
            </span>
            <div className="medha-spine__title">MEDHĀ</div>
          </div>
          <div className="medha-spine__subtitle">The Consciousness of VYAN</div>
        </div>

        <nav className="medha-spine__nodes" aria-label="Cognitive identity">
          {COGNITIVE_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMode(m.key)}
              className={`medha-node ${activeMode === m.key ? 'is-active' : ''}`}
              data-glyph={m.glyph}
              style={{
                ['--node-a' as any]: m.colorA,
                ['--node-b' as any]: m.colorB,
              }}
            >
              <span className="medha-node__glyph" aria-hidden="true">{m.glyph}</span>
              <span className="medha-node__label">
                <span className="medha-node__name">{m.name}</span>
                <span className="medha-node__provider">{m.provider}</span>
              </span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="medha-exit"
          onClick={() => router.push('/shunya/medha')}
          title="Return to Shunya"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          <span>SHUNYA</span>
        </button>
      </header>

      {/* CENTER — the Resonance Loom (chat thread) */}
      <section className="medha-loom">
        <div className="medha-loom__rail" ref={railRef}>
          {messages.length === 0 && (
            <div className="medha-greeting">
              <div className="medha-greeting__pulse" />
              <h1 className="medha-greeting__line">
                <span className="medha-greeting__sanskrit">{mode.name}</span> is listening.
              </h1>
              <p className="medha-greeting__purpose">{mode.purpose}</p>
              <div className="medha-greeting__chips">
                {[
                  'Architect a system',
                  'Reflect on a question',
                  'Surface a concept',
                  'Quick answer',
                  'Route this to the right mind',
                ].map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className="medha-chip"
                    onClick={() => {
                      setDraft(c + ': ');
                      inputRef.current?.focus();
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const msgMode = getMode(m.mode);
            const cls = m.role === 'user' ? 'medha-msg medha-msg--user' : 'medha-msg medha-msg--ai';
            return (
              <div key={m.id} className={cls} style={{ ['--msg-a' as any]: msgMode.colorA, ['--msg-b' as any]: msgMode.colorB }}>
                <div className="medha-msg__meta">
                  {m.role === 'user' ? (
                    <span className="medha-msg__who">YOU</span>
                  ) : (
                    <>
                      <span className="medha-msg__glyph">{msgMode.glyph}</span>
                      <span className="medha-msg__who">{msgMode.name.toUpperCase()}</span>
                      <span className="medha-msg__provider">{msgMode.englishName}</span>
                    </>
                  )}
                </div>
                <div className="medha-msg__body">
                  {m.content || (m.streaming ? <span className="medha-msg__cursor">▌</span> : null)}
                  {m.streaming && m.content && <span className="medha-msg__cursor">▌</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* RIGHT RAIL — active mode card + thread controls */}
      <aside className={`medha-aside ${showDetails ? 'is-open' : ''}`}>
        <button
          type="button"
          className="medha-aside__toggle"
          onClick={() => setShowDetails(v => !v)}
          aria-label="Toggle cognitive details"
        >
          {showDetails ? '×' : 'i'}
        </button>
        <div className="medha-card">
          <div className="medha-card__head">
            <span className="medha-card__glyph">{mode.glyph}</span>
            <div>
              <div className="medha-card__name">{mode.name}</div>
              <div className="medha-card__provider">{mode.englishName}</div>
            </div>
          </div>
          <div className="medha-card__purpose">{mode.purpose}</div>
          <ul className="medha-card__list">
            {mode.capabilities.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <div className="medha-card__foot">
            <span className="medha-dot" />
            <span>{mode.provider} · routed via Pollinations</span>
          </div>
        </div>

        <button type="button" className="medha-clear" onClick={clearThread}>
          ↻ Clear Cognition
        </button>
      </aside>

      {/* BOTTOM — composer */}
      <footer className="medha-composer">
        <div className="medha-composer__wrap">
          <div className="medha-composer__bind">
            <span className="medha-composer__bind-glyph">{mode.glyph}</span>
            <span className="medha-composer__bind-name">{mode.name}</span>
          </div>
          <textarea
            ref={inputRef}
            className="medha-composer__input"
            placeholder={`Speak to ${mode.name}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button
            type="button"
            className="medha-send"
            onClick={send}
            disabled={busy || !draft.trim()}
            title="Send (Enter)"
          >
            {busy ? (
              <span className="medha-send__spin" aria-hidden="true" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
