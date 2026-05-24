'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { COGNITIVE_MODES, CognitiveModeKey, getMode } from '@/lib/medha/cognitive';
import { chatComplete, type ChatMessage } from '@/lib/medha/MedhaClient';
import { renderMarkdown, isForbiddenQuery, SANDHI_REDIRECT_MARKDOWN } from '@/lib/medha/markdown';
import {
  listChats, getChat, upsertChat, deleteChat, getCurrentChatId, setCurrentChatId, newChatId,
  type StoredChat, type StoredMsg,
} from '@/lib/medha/storage';
import { STT, TTS } from '@/lib/medha/voice';
import { incrementQuota, quotaRemaining, getUser, setUser, quotaLimit, type LocalUser } from '@/lib/quota/quota';
import MedhaConsentSlab, { hasLocalConsent, type ConsentSnapshot } from './MedhaConsentSlab';
import './medha.css';

// ============================================================
// MEDHĀ — The Living Orb. Strict 7-component interface:
//   A = vertical user-query rail (right edge, dots accumulate)
//   B = Sound Console (rendered globally by cosmic layout)
//   C = Nāvika orb       (rendered globally by cosmic layout)
//   D = Settings orb     (cosmic glyph, opens settings panel)
//   E = Slim glass composer (bottom, 1000-char limit, scrolls)
//   F = Shunya back button (top-left)
//   G = Medhā living orb (canvas)
// Medhā's reply renders as a FLOATING DIALOG glass-box near her;
// it vanishes the instant the user begins typing.
// ============================================================

type Phase = 'sleeping' | 'awake';

const GREETING_NEW =
  'Hello — I am Medhā, the Cognitive Intelligence of VYAN. It is a quiet honour to meet you. ' +
  'What would you like us to explore together today?';

function buildContinuationGreeting(prevTopic?: string): string {
  if (prevTopic && prevTopic.length > 6) {
    return `Welcome back. Last time we touched on ${prevTopic}. Shall we keep building from there — or step into something new?`;
  }
  return 'Welcome back. The conversation is still warm. Where shall we begin again?';
}

const uid = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

function summariseTopic(messages: StoredMsg[]): string {
  const first = messages.find(m => m.role === 'user')?.content?.trim() ?? '';
  if (!first) return '';
  return first.length > 60 ? first.slice(0, 57) + '…' : first;
}

export default function MedhaHUD() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('sleeping');
  const [mode, setMode] = useState<CognitiveModeKey>('prajna');
  const [chatId, setChatId] = useState<string>('');
  const [messages, setMessages] = useState<StoredMsg[]>([]);
  const [composerText, setComposerText] = useState('');
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [hoverDot, setHoverDot] = useState<number | null>(null);
  const [stickyDot, setStickyDot] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [shock, setShock] = useState(0);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [quotaUser, setQuotaUser] = useState<LocalUser | null>(null);
  const [showQuotaLock, setShowQuotaLock] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regErr, setRegErr] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  // NEW: consent gate. Always start `false` on SSR + first client render to
  // avoid hydration mismatch — then upgrade to localStorage value in effect.
  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [consentReady, setConsentReady] = useState<boolean>(false);
  useEffect(() => {
    setConsentGranted(hasLocalConsent());
    setConsentReady(true);
  }, []);
  // NEW: electric link animation trigger. Counter increments each time the
  // user picks a Mode in the settings panel — the SVG link redraws.
  const [linkPulse, setLinkPulse] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const sttRef = useRef<STT | null>(null);
  const ttsRef = useRef<TTS | null>(null);
  const wakeInitRef = useRef(false);
  const dataRef = useRef({ chatId: '', messages: [] as StoredMsg[], mode: 'prajna' as CognitiveModeKey });
  useEffect(() => { dataRef.current = { chatId, messages, mode }; }, [chatId, messages, mode]);

  const modeDef = useMemo(() => getMode(mode), [mode]);

  // ---- Bootstrap ---------------------------------------------
  useEffect(() => { setQuotaUser(getUser()); }, []);
  useEffect(() => {
    sttRef.current = new STT();
    ttsRef.current = new TTS();
    const stored = listChats();
    setChats(stored);
    const currId = getCurrentChatId();
    if (currId && stored.find(c => c.id === currId)) {
      const c = getChat(currId)!;
      setChatId(c.id);
      setMessages(c.messages);
    } else {
      const prev = stored[0];
      const id = newChatId();
      setChatId(id);
      setCurrentChatId(id);
      const greeting: StoredMsg = {
        id: uid(),
        role: 'assistant',
        content: prev ? buildContinuationGreeting(prev.topic) : GREETING_NEW,
        mode, ts: Date.now(),
      };
      setMessages([greeting]);
      upsertChat({
        id, title: 'New Conversation', messages: [greeting],
        createdAt: Date.now(), lastInteractionAt: Date.now(), topic: prev?.topic,
      });
    }
    // PHASE 2 in-place: don't hide the cosmic canvas — the unfolded Medhā
    // orb lives behind this HUD now. We only dim the void-mode UI chrome
    // (depth rail, caption) so the chat stays the focus.
    try {
      document.querySelectorAll('[data-vyan-fade="1"]').forEach((el) => {
        (el as HTMLElement).style.transition = 'opacity 0.7s ease-out';
        (el as HTMLElement).style.opacity = '0';
        setTimeout(() => el.remove(), 800);
      });
      const ui = document.querySelector('.vyan-ui') as HTMLElement | null;
      if (ui) { ui.style.opacity = '0'; ui.style.pointerEvents = 'none'; }
      // DO NOT hide the canvas — leave it visible for the in-place orb.
    } catch {}
    return () => {
      const ui = document.querySelector('.vyan-ui') as HTMLElement | null;
      if (ui) { ui.style.opacity = '1'; ui.style.pointerEvents = 'auto'; }
      window.dispatchEvent(new CustomEvent('vyan:resume'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Wake on first interaction -----------------------------
  useEffect(() => {
    if (phase !== 'sleeping') return;
    const wake = () => {
      if (wakeInitRef.current) return;
      wakeInitRef.current = true;
      setPhase('awake');
      setTimeout(() => setComposerOpen(true), 600);
      const last = dataRef.current.messages[dataRef.current.messages.length - 1];
      if (last?.role === 'assistant' && ttsEnabled && ttsRef.current?.isSupported()) {
        setSpeaking(true);
        ttsRef.current.speak(last.content, { onEnd: () => setSpeaking(false) });
      }
    };
    const opts = { passive: true, once: true } as AddEventListenerOptions;
    window.addEventListener('mousemove', wake, opts);
    window.addEventListener('keydown', wake, opts);
    window.addEventListener('click', wake, opts);
    window.addEventListener('touchstart', wake, opts);
    return () => {
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('click', wake);
      window.removeEventListener('touchstart', wake);
    };
  }, [phase, ttsEnabled]);

  // ---- Persist on changes ------------------------------------
  useEffect(() => {
    if (!chatId) return;
    const topic = summariseTopic(messages);
    const title = topic ? topic.slice(0, 36) : 'New Conversation';
    upsertChat({
      id: chatId, title, messages,
      createdAt: messages[0]?.ts ?? Date.now(),
      lastInteractionAt: Date.now(),
      topic,
    });
    setChats(listChats());
  }, [chatId, messages]);

  // ---- Escape / close ----------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistory || showSettings) { setShowHistory(false); setShowSettings(false); return; }
        if (stickyDot !== null) { setStickyDot(null); return; }
        router.push('/shunya/medha');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, showHistory, showSettings, stickyDot]);

  // ---- Send ---------------------------------------------------
  const send = useCallback(async () => {
    const text = composerText.trim();
    if (!text || busy) return;

    // ---- QUOTA GATE (item 11) ---------------------------------
    // Anonymous visitors get 15 conversations with Medhā. After that they
    // must register with VYAN to unlock full cognition.
    if (!quotaUser && !getUser()) {
      const remaining = quotaRemaining('medha');
      if (remaining <= 0) {
        setShowQuotaLock(true);
        return;
      }
      const inc = incrementQuota('medha');
      if (!inc.ok) {
        setShowQuotaLock(true);
        return;
      }
    }

    setComposerText('');
    const userMsg: StoredMsg = { id: uid(), role: 'user', content: text, mode, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setStickyDot(null);

    if (isForbiddenQuery(text)) {
      const aiMsg: StoredMsg = { id: uid(), role: 'assistant', content: SANDHI_REDIRECT_MARKDOWN, mode, ts: Date.now() };
      setTimeout(() => setMessages(prev => [...prev, aiMsg]), 280);
      return;
    }

    setBusy(true);
    const history: ChatMessage[] = [...dataRef.current.messages, userMsg]
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const full = await chatComplete(modeDef, history);
      const aiMsg: StoredMsg = {
        id: uid(), role: 'assistant',
        content: full || 'I lost the signal for a moment. Try again?',
        mode, ts: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (ttsEnabled && ttsRef.current?.isSupported()) {
        const plain = full.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/[*_`#>]/g, '').replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1');
        setSpeaking(true);
        ttsRef.current.speak(plain, { onEnd: () => setSpeaking(false) });
      }
    } catch {
      const aiMsg: StoredMsg = {
        id: uid(), role: 'assistant',
        content: 'Cognition is busy on the channel. Give it a breath and try again.',
        mode, ts: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setBusy(false);
    }
  }, [composerText, busy, mode, modeDef, ttsEnabled, quotaUser]);

  // Register with VYAN — unlock full Medhā access.
  const submitRegistration = useCallback(async () => {
    if (!regEmail.trim() || regBusy) return;
    setRegBusy(true);
    setRegErr('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, intent: 'medha-unlock' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setRegErr(data?.error || 'Registration failed.'); return; }
      const u: LocalUser = data.user || { email: regEmail, name: regName, registeredAt: Date.now(), verified: false };
      setUser(u);
      setQuotaUser(u);
      setShowQuotaLock(false);
      setRegName(''); setRegEmail('');
    } catch {
      setRegErr('Network unavailable.');
    } finally {
      setRegBusy(false);
    }
  }, [regName, regEmail, regBusy]);

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Trigger the "thunderbolt impact" on Medhā when mode switches.
  useEffect(() => {
    if (linkPulse === 0) return;
    const w = document.querySelector('.mlv-orb-float-wrap');
    if (!w) return;
    w.classList.remove('is-struck');
    // Force reflow so the animation restarts every pulse.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (w as HTMLElement).offsetWidth;
    w.classList.add('is-struck');
    const t = window.setTimeout(() => w.classList.remove('is-struck'), 1100);
    return () => window.clearTimeout(t);
  }, [linkPulse]);

  const switchMode = (k: CognitiveModeKey, ev?: React.MouseEvent<HTMLButtonElement>) => {
    if (k === mode) return;
    setMode(k);
    setShock(s => s + 1);
    // Capture the pill's center position so the electrifying bolt strikes
    // FROM that specific pill TO Medhā's center — like a focused thunderbolt.
    if (ev?.currentTarget) {
      const r = ev.currentTarget.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      document.documentElement.style.setProperty('--mlv-zap-x', `${cx}px`);
      document.documentElement.style.setProperty('--mlv-zap-y', `${cy}px`);
    }
    setLinkPulse(p => p + 1);
  };

  const toggleListening = () => {
    const stt = sttRef.current;
    if (!stt?.isSupported()) return;
    if (listening) { stt.stop(); setListening(false); return; }
    setListening(true);
    stt.start({
      onText: (txt) => setComposerText(txt),
      onEnd: () => setListening(false),
      onError: () => setListening(false),
    });
  };

  const toggleTts = () => {
    setTtsEnabled(v => {
      if (v) ttsRef.current?.cancel();
      return !v;
    });
  };

  const startNewChat = () => {
    const prev = chats[0];
    const id = newChatId();
    setChatId(id);
    setCurrentChatId(id);
    const greeting: StoredMsg = {
      id: uid(), role: 'assistant',
      content: prev ? buildContinuationGreeting(prev.topic) : GREETING_NEW,
      mode, ts: Date.now(),
    };
    setMessages([greeting]);
    setStickyDot(null);
    setShowHistory(false);
  };

  const openChatId = (id: string) => {
    const c = getChat(id);
    if (!c) return;
    setChatId(c.id);
    setCurrentChatId(c.id);
    setMessages(c.messages);
    // Per user spec: opening a specific chat must KEEP the history panel open
    // so the user can navigate between chats without re-opening. Panel closes
    // only via the close button (✕), backdrop click, or ESC.
    setStickyDot(null);
  };

  const userMsgs = useMemo(
    () => messages.map((m, i) => ({ ...m, idx: i })).filter(m => m.role === 'user'),
    [messages]
  );
  const lastUserIdx = userMsgs.length ? userMsgs[userMsgs.length - 1].idx : -1;
  const lastMsg = messages[messages.length - 1] ?? null;

  const focusMsg: StoredMsg | null = stickyDot !== null
    ? (messages[stickyDot] ?? null)
    : (busy ? messages[lastUserIdx] ?? null : (lastMsg?.role === 'assistant' ? lastMsg : (messages[lastUserIdx] ?? null)));
  const previewMsg: StoredMsg | null = hoverDot !== null && stickyDot === null ? messages[hoverDot] ?? null : null;
  const showMsg = previewMsg ?? focusMsg;

  const copyMsg = async (m: StoredMsg) => {
    try { await navigator.clipboard.writeText(m.content); } catch {}
  };

  return (
    <div
      className={`mlv mlv-phase-${phase} ${consentGranted ? '' : 'mlv-consent-locked'}`}
      data-mode={mode}
      style={{
        ['--mode-a' as any]: modeDef.colorA,
        ['--mode-b' as any]: modeDef.colorB,
      }}
    >
      {/* CONSENT GATE — shown ONCE per user (deduped by email server-side). */}
      {!consentGranted && (
        <MedhaConsentSlab onGranted={(snap: ConsentSnapshot) => {
          setConsentGranted(true);
        }} />
      )}

      {/* PHASE 2 in-place architecture: the Medhā orb lives in the cosmic
          canvas (Shunya scene) behind this HUD — we no longer render a
          separate fullscreen MedhaCanvasOrb. The chat UI floats above the
          unfolded cosmic orb. */}

      {/* Orb-click hit area for opening conversation history. Anchored to
          the cosmic Medhā orb's projected screen centre via __vyanAnchor. */}
      <div
        className={`mlv-orb-hit ${speaking ? 'is-speaking' : ''} ${busy ? 'is-listening' : ''}`}
        onClick={() => phase === 'awake' && setShowHistory(v => !v)}
        role="button"
        aria-label="Open conversation history"
      >
        {phase === 'sleeping' && (
          <div className="mlv-orb-cue">a presence stirs · move, touch, or speak</div>
        )}
      </div>

      <button type="button" className="mlv-back" onClick={() => router.push('/shunya/medha')}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Shunya</span>
      </button>

      <aside className="mlv-rail mlv-rail--hidden" aria-hidden="true">
        {/* Legacy left rail intentionally hidden — strict 7-component spec.
            All actions consolidated into the floating Settings orb (D). */}
        <button type="button" className="mlv-rail__btn" onClick={startNewChat} title="New conversation">
          <span className="mlv-rail__glyph">＋</span>
          <span className="mlv-rail__lbl">new</span>
        </button>
        <button type="button" className="mlv-rail__btn" onClick={() => setShowHistory(v => !v)} title="History">
          <span className="mlv-rail__glyph">≡</span>
          <span className="mlv-rail__lbl">history</span>
        </button>
        <button type="button" className={`mlv-rail__btn ${listening ? 'is-on' : ''}`}
                onClick={toggleListening}
                disabled={!sttRef.current?.isSupported()} title="Voice input">
          <span className="mlv-rail__glyph">◉</span>
          <span className="mlv-rail__lbl">speak</span>
        </button>
        <button type="button" className={`mlv-rail__btn ${ttsEnabled ? 'is-on' : ''}`}
                onClick={toggleTts}
                disabled={!ttsRef.current?.isSupported()} title="Voice reply">
          <span className="mlv-rail__glyph">♪</span>
          <span className="mlv-rail__lbl">voice</span>
        </button>
        <button type="button" className="mlv-rail__btn" onClick={() => setShowSettings(v => !v)} title="Settings">
          <span className="mlv-rail__glyph">⚙</span>
          <span className="mlv-rail__lbl">settings</span>
        </button>

        <div className="mlv-rail__divider" />
        <div className="mlv-rail__modes">
          {COGNITIVE_MODES.map((m) => (
            <button key={m.key} type="button"
                    className={`mlv-mind ${mode === m.key ? 'is-active' : ''}`}
                    onClick={() => switchMode(m.key)}
                    title={`${m.name} — ${m.englishName}`}
                    style={{ ['--mind-a' as any]: m.colorA, ['--mind-b' as any]: m.colorB }}>
              <span className="mlv-mind__glyph">{m.glyph}</span>
              <span className="mlv-mind__name">{m.name}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Medhā's reply — FLOATING DIALOG GLASS BOX that drifts beside her.
          Vanishes the instant the user begins typing (per the strict spec).
          User messages NEVER appear here — they're only shown when the
          corresponding rail-dot is hovered/clicked. */}
      {showMsg && phase === 'awake' && !isTyping && !composerOpen && (
        <div className={`mlv-medha-dialog mlv-medha-dialog--${showMsg.role} ${stickyDot !== null ? 'is-sticky' : ''}`}>
          <div className="mlv-medha-dialog__meta">
            <span className="mlv-medha-dialog__who">
              {showMsg.role === 'user' ? 'you' : (getMode(showMsg.mode as CognitiveModeKey).name)}
            </span>
            <span className="mlv-medha-dialog__ts">
              {new Date(showMsg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {showMsg.role === 'assistant' ? (
            <div className="mlv-medha-dialog__body medha-md"
                 dangerouslySetInnerHTML={{ __html: renderMarkdown(showMsg.content) }} />
          ) : (
            <div className="mlv-medha-dialog__body mlv-medha-dialog__body--user">{showMsg.content}</div>
          )}
          <div className="mlv-medha-dialog__actions">
            <button type="button" onClick={() => copyMsg(showMsg)}>⧉ copy</button>
            {stickyDot !== null && (
              <button type="button" onClick={() => setStickyDot(null)}>⟲ release</button>
            )}
          </div>
        </div>
      )}

      {phase === 'awake' && (
        <div className="mlv-thread mlv-thread--user-only">
          <div className="mlv-thread__line" />
          <div className="mlv-thread__dots">
            {/* RAIL DOTS — strictly USER messages only (per item 2 of spec).
                Medhā's responses live in the floating dialog box, not here. */}
            {messages.map((m, i) => m.role !== 'user' ? null : (
              <button key={m.id} type="button"
                      className={`mlv-dot mlv-dot--user ${(stickyDot === i || hoverDot === i) ? 'is-glow' : ''}`}
                      data-msg={m.content.slice(0, 200)}
                      onMouseEnter={() => setHoverDot(i)}
                      onMouseLeave={() => setHoverDot(null)}
                      onClick={() => setStickyDot(stickyDot === i ? null : i)}
                      aria-label={`Your message ${i + 1}`} />
            ))}
            {busy && <span className="mlv-thread__pending" />}
          </div>
        </div>
      )}

      {phase === 'awake' && (
        <div className={`mlv-composer ${composerOpen ? 'is-open' : ''} ${composerText.length > 220 ? 'is-tall' : ''}`}>
          {!composerOpen && (
            <button type="button" className="mlv-composer__pill" onClick={() => { setComposerOpen(true); setIsTyping(true); setTimeout(() => composerRef.current?.focus(), 50); }}>
              <span className="mlv-composer__dot" />
              <span>speak to {modeDef.name}</span>
            </button>
          )}
          {composerOpen && (
            <div className="mlv-composer__wrap">
              <span className="mlv-composer__bind">{modeDef.glyph} {modeDef.name}</span>
              <textarea ref={composerRef} value={composerText}
                        placeholder={listening ? '(listening…)' : `Speak to ${modeDef.name}…`}
                        maxLength={1000}
                        onChange={(e) => {
                          setComposerText(e.target.value);
                          setIsTyping(e.target.value.length > 0);
                        }}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => { if (!composerText.trim()) setIsTyping(false); }}
                        onKeyDown={onComposerKey} rows={composerText.length > 220 ? 3 : 1} disabled={busy} />
              <span className={`mlv-composer__count ${composerText.length > 900 ? 'is-warn' : ''}`}>
                {composerText.length}/1000
              </span>
              <button type="button" className="mlv-composer__attach"
                      onClick={() => { (document.getElementById('mlv-file-input') as HTMLInputElement | null)?.click(); }}
                      title="Attach image or file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <input id="mlv-file-input" type="file" accept="image/*,.pdf,.txt,.md,.json,.csv"
                     style={{ display: 'none' }}
                     onChange={(e) => {
                       const f = e.target.files?.[0];
                       if (!f) return;
                       // Append a marker to the prompt so the backend knows an
                       // attachment exists. Wire to /api/upload later when ready.
                       setComposerText((cur) => `${cur}\n\n[attached: ${f.name} · ${(f.size/1024).toFixed(1)}KB]`);
                       setIsTyping(true);
                     }} />
              <button type="button" className={`mlv-composer__mic ${listening ? 'is-on' : ''}`}
                      onClick={toggleListening}
                      disabled={!sttRef.current?.isSupported()}>◉</button>
              <button type="button" className="mlv-composer__send" onClick={send} disabled={busy || !composerText.trim()}>
                {busy ? <span className="mlv-composer__spin" /> : '→'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS ORB (D) — tiny floating glyph, opens the settings glass panel. */}
      {phase === 'awake' && (
        <button
          type="button"
          className="mlv-settings-orb"
          onClick={() => setShowSettings(true)}
          aria-label="Open Medhā settings"
          title="Medhā settings"
        >
          <span className="mlv-settings-orb__ring" />
          <span className="mlv-settings-orb__core" />
          <span className="mlv-settings-orb__glyph">⚙</span>
        </button>
      )}

      {/* ELECTRIFYING LINK — animated SVG zaps from the settings panel position
          to Medhā when the user switches cognitive modes. Re-keyed on each
          mode change so the animation restarts cleanly. */}
      {linkPulse > 0 && (
        <svg
          key={linkPulse}
          className="mlv-electric-link"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`mlv-elec-grad-${linkPulse}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"  stopColor={modeDef.colorA} stopOpacity="0.0" />
              <stop offset="40%" stopColor={modeDef.colorA} stopOpacity="1" />
              <stop offset="100%" stopColor={modeDef.colorB} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M 750 320 Q 600 260 500 300 Q 400 340 300 280"
            stroke={`url(#mlv-elec-grad-${linkPulse})`}
            strokeWidth="2"
            fill="none"
            className="mlv-electric-link__bolt"
          />
          <path
            d="M 750 320 Q 600 260 500 300 Q 400 340 300 280"
            stroke={modeDef.colorA}
            strokeWidth="0.8"
            fill="none"
            opacity="0.7"
            className="mlv-electric-link__crackle"
          />
        </svg>
      )}

      {showHistory && (
        <div className="mlv-modal" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false); }}>
          <div className="mlv-modal__inner">
            <header className="mlv-modal__head">
              <h2>Conversation Threads</h2>
              <button type="button" className="mlv-modal__x" onClick={() => setShowHistory(false)}>✕</button>
            </header>
            <div className="mlv-modal__body">
              {chats.length === 0 && <p className="mlv-modal__empty">No conversations yet. This is the first.</p>}
              {chats.map((c) => (
                <div key={c.id} className={`mlv-chat-row ${c.id === chatId ? 'is-current' : ''}`}>
                  <button type="button" className="mlv-chat-row__open" onClick={() => openChatId(c.id)}>
                    <div className="mlv-chat-row__title">{c.title || 'Untitled'}</div>
                    <div className="mlv-chat-row__meta">
                      {new Date(c.lastInteractionAt).toLocaleString()} · {c.messages.length} messages
                    </div>
                  </button>
                  <button type="button" className="mlv-chat-row__del"
                          onClick={() => { deleteChat(c.id); setChats(listChats()); if (c.id === chatId) startNewChat(); }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <footer className="mlv-modal__foot">
              <button type="button" className="mlv-modal__cta" onClick={startNewChat}>+ Start new conversation</button>
            </footer>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="mlv-modal mlv-modal--side" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="mlv-modal__inner mlv-modal__inner--side">
            <header className="mlv-modal__head">
              <h2>Cognitive Settings</h2>
              <button type="button" className="mlv-modal__x" onClick={() => setShowSettings(false)}>✕</button>
            </header>
            <div className="mlv-modal__body mlv-settings">
              {/* Cognitive Mode picker — selecting one fires the electrifying
                  link from the settings panel to Medhā and tints her aura. */}
              <div className="mlv-settings__section">
                <div className="mlv-settings__lbl">Cognitive Mode</div>
                <div className="mlv-settings__modes">
                  {COGNITIVE_MODES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      className={`mlv-mind ${mode === m.key ? 'is-active' : ''}`}
                      onClick={(ev) => switchMode(m.key, ev)}
                      title={`${m.name} — ${m.englishName}`}
                      style={{ ['--mind-a' as any]: m.colorA, ['--mind-b' as any]: m.colorB }}
                    >
                      <span className="mlv-mind__glyph">{m.glyph}</span>
                      <span className="mlv-mind__name">{m.name}</span>
                    </button>
                  ))}
                </div>
                <p className="mlv-settings__hint">
                  Active: <strong>{modeDef.name}</strong> · {modeDef.englishName}
                </p>
              </div>
              <div className="mlv-settings__section">
                <div className="mlv-settings__lbl">Response Tone</div>
                <div className="mlv-settings__pills">
                  {(['Sūtra','Poetic','Direct','Mythic'] as const).map((t) => (
                    <button key={t} type="button" className={`mlv-pill ${(typeof window !== 'undefined' && localStorage.getItem('vyan.medha.tone') === t) ? 'is-active' : ''}`}
                            onClick={() => { try { localStorage.setItem('vyan.medha.tone', t); } catch {} setShock(s => s + 1); }}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="mlv-settings__section">
                <div className="mlv-settings__lbl">Response Length</div>
                <div className="mlv-settings__pills">
                  {(['Tight','Standard','Expansive'] as const).map((t) => (
                    <button key={t} type="button" className={`mlv-pill ${(typeof window !== 'undefined' && localStorage.getItem('vyan.medha.length') === t) ? 'is-active' : ''}`}
                            onClick={() => { try { localStorage.setItem('vyan.medha.length', t); } catch {} setShock(s => s + 1); }}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Voice reply (TTS)</span>
                <button type="button" className={`mlv-toggle ${ttsEnabled ? 'is-on' : ''}`} onClick={toggleTts}>
                  {ttsEnabled ? 'on' : 'off'}
                </button>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Voice input (STT)</span>
                <button type="button" className={`mlv-toggle ${listening ? 'is-on' : ''}`}
                        onClick={toggleListening}
                        disabled={!sttRef.current?.isSupported()}>
                  {listening ? 'on' : 'off'}
                </button>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Conversations stored</span>
                <span className="mlv-set-row__v">{chats.length}</span>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Local persistence</span>
                <span className="mlv-set-row__v">30 days · device + VYAN cloud</span>
              </div>
              <div className="mlv-set-row">
                <button type="button" className="mlv-modal__danger" onClick={() => {
                  if (!confirm('Erase ALL conversations stored on this device?')) return;
                  chats.forEach(c => deleteChat(c.id));
                  setChats([]);
                  startNewChat();
                }}>
                  Erase all conversations
                </button>
              </div>
              <p className="mlv-settings__note">
                Tone, response length and voice persona will manifest here in the next emergence.
              </p>
            </div>
          </div>
        </div>
      )}
      {showQuotaLock && (
        <div className="medha-quota-lock" role="dialog" aria-modal="true">
          <div className="medha-quota-lock__card">
            <div className="medha-quota-lock__kicker">Cognition Threshold</div>
            <h2 className="medha-quota-lock__title">You have reached the visitor limit.</h2>
            <p className="medha-quota-lock__p">
              Medhā grants every wanderer <strong>{quotaLimit('medha')} conversations</strong> as a first taste.
              You have arrived at the edge of that gift.
            </p>
            <p className="medha-quota-lock__p">
              Register with VYAN to unlock the <strong>full cognitive lattice</strong> — unlimited
              conversations, voice continuity, mind-switching, and access to the Vistāra products
              waiting beyond this veil.
            </p>
            <div className="medha-quota-lock__form">
              <input type="text" placeholder="Your name" value={regName} onChange={(e) => setRegName(e.target.value)} />
              <input type="email" placeholder="you@domain.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
              {regErr && <div className="medha-quota-lock__err">{regErr}</div>}
              <button type="button" className="medha-quota-lock__cta" onClick={submitRegistration} disabled={regBusy || !regEmail.trim()}>
                {regBusy ? 'Transmitting…' : 'Register with VYAN'}
              </button>
            </div>
            <p className="medha-quota-lock__foot">
              VYAN will send a verification to your address. Your conversations remain on your device.
              No tracking — only continuity.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
