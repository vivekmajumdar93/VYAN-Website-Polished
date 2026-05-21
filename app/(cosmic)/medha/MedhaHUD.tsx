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
import './medha.css';

// ============================================================
// MEDHĀ — The Living Orb. A single breathing presence at the
// centre of a dark void. You don't "use" Medhā — you visit her.
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

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const sttRef = useRef<STT | null>(null);
  const ttsRef = useRef<TTS | null>(null);
  const wakeInitRef = useRef(false);
  const dataRef = useRef({ chatId: '', messages: [] as StoredMsg[], mode: 'prajna' as CognitiveModeKey });
  useEffect(() => { dataRef.current = { chatId, messages, mode }; }, [chatId, messages, mode]);

  const modeDef = useMemo(() => getMode(mode), [mode]);

  // ---- Bootstrap ---------------------------------------------
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
    // Clear leftover fade overlay from portal transition
    try {
      document.querySelectorAll('[data-vyan-fade="1"]').forEach((el) => {
        (el as HTMLElement).style.transition = 'opacity 0.7s ease-out';
        (el as HTMLElement).style.opacity = '0';
        setTimeout(() => el.remove(), 800);
      });
      const ui = document.querySelector('.vyan-ui') as HTMLElement | null;
      if (ui) { ui.style.opacity = '0'; ui.style.pointerEvents = 'none'; }
    } catch {}
    return () => {
      const ui = document.querySelector('.vyan-ui') as HTMLElement | null;
      if (ui) { ui.style.opacity = '1'; ui.style.pointerEvents = 'auto'; }
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
  }, [composerText, busy, mode, modeDef, ttsEnabled]);

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const switchMode = (k: CognitiveModeKey) => {
    if (k === mode) return;
    setMode(k);
    setShock(s => s + 1);
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
    setShowHistory(false);
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
      className={`mlv mlv-phase-${phase}`}
      data-mode={mode}
      style={{
        ['--mode-a' as any]: modeDef.colorA,
        ['--mode-b' as any]: modeDef.colorB,
      }}
    >
      <div className="mlv-bg" aria-hidden="true">
        <div className="mlv-stars" />
        <div className="mlv-stars mlv-stars--slow" />
      </div>

      <div
        className={`mlv-orb-wrap ${speaking ? 'is-speaking' : ''} ${busy ? 'is-listening' : ''}`}
        onClick={() => phase === 'awake' && setShowHistory(v => !v)}
        role="button"
        aria-label="Open conversation history"
      >
        <div className="mlv-orb">
          <div className="mlv-orb__corona" />
          <div className="mlv-orb__ring mlv-orb__ring--a" />
          <div className="mlv-orb__ring mlv-orb__ring--b" />
          <div className="mlv-orb__ring mlv-orb__ring--c" />
          <div className="mlv-orb__core"><div className="mlv-orb__core-inner" /></div>
          <div className="mlv-orb__particles">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="mlv-orb__particle" style={{ ['--p-i' as any]: i }} />
            ))}
          </div>
          <div className="mlv-orb__shockwave" key={shock} />
        </div>
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

      <aside className="mlv-rail" aria-label="Medhā controls">
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

      {showMsg && phase === 'awake' && (
        <div className={`mlv-slab mlv-slab--${showMsg.role} ${stickyDot !== null ? 'is-sticky' : ''} ${previewMsg ? 'is-preview' : ''}`}>
          <div className="mlv-slab__meta">
            <span className="mlv-slab__who">{showMsg.role === 'user' ? 'you' : (getMode(showMsg.mode as CognitiveModeKey).name)}</span>
            <span className="mlv-slab__ts">{new Date(showMsg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {showMsg.role === 'assistant' ? (
            <div className="mlv-slab__body medha-md"
                 dangerouslySetInnerHTML={{ __html: renderMarkdown(showMsg.content) }} />
          ) : (
            <div className="mlv-slab__body mlv-slab__body--user">{showMsg.content}</div>
          )}
          <div className="mlv-slab__actions">
            <button type="button" onClick={() => copyMsg(showMsg)}>⧉ copy</button>
            {stickyDot !== null && (
              <button type="button" onClick={() => setStickyDot(null)}>⟲ release</button>
            )}
          </div>
        </div>
      )}

      {phase === 'awake' && (
        <div className="mlv-thread">
          <div className="mlv-thread__line" />
          <div className="mlv-thread__dots">
            {messages.map((m, i) => (
              <button key={m.id} type="button"
                      className={`mlv-dot mlv-dot--${m.role} ${(stickyDot === i || hoverDot === i) ? 'is-glow' : ''}`}
                      onMouseEnter={() => setHoverDot(i)}
                      onMouseLeave={() => setHoverDot(null)}
                      onClick={() => setStickyDot(stickyDot === i ? null : i)}
                      aria-label={`${m.role} message`} />
            ))}
            {busy && <span className="mlv-thread__pending" />}
          </div>
        </div>
      )}

      {phase === 'awake' && (
        <div className={`mlv-composer ${composerOpen ? 'is-open' : ''}`}>
          {!composerOpen && (
            <button type="button" className="mlv-composer__pill" onClick={() => { setComposerOpen(true); setTimeout(() => composerRef.current?.focus(), 50); }}>
              <span className="mlv-composer__dot" />
              <span>speak to {modeDef.name}</span>
            </button>
          )}
          {composerOpen && (
            <div className="mlv-composer__wrap">
              <span className="mlv-composer__bind">{modeDef.glyph} {modeDef.name}</span>
              <textarea ref={composerRef} value={composerText}
                        placeholder={listening ? '(listening…)' : `Speak to ${modeDef.name}…`}
                        onChange={(e) => setComposerText(e.target.value)}
                        onKeyDown={onComposerKey} rows={1} disabled={busy} />
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
        <div className="mlv-modal" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="mlv-modal__inner">
            <header className="mlv-modal__head">
              <h2>Cognitive Settings</h2>
              <button type="button" className="mlv-modal__x" onClick={() => setShowSettings(false)}>✕</button>
            </header>
            <div className="mlv-modal__body mlv-settings">
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Voice reply (TTS)</span>
                <button type="button" className={`mlv-toggle ${ttsEnabled ? 'is-on' : ''}`} onClick={toggleTts}>
                  {ttsEnabled ? 'on' : 'off'}
                </button>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Active mind</span>
                <span className="mlv-set-row__v">{modeDef.name} · {modeDef.englishName}</span>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Persistence</span>
                <span className="mlv-set-row__v">30 days from last interaction · local device</span>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Conversations stored</span>
                <span className="mlv-set-row__v">{chats.length}</span>
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
                Character tone, voice persona, and per-mode tuning will appear here in the next emergence.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
