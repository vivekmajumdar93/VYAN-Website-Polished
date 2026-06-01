'use client';

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { COGNITIVE_MODES, CognitiveModeKey, getMode, MODEL_GREETINGS } from '@/lib/medha/cognitive';
import { chatComplete, type ChatMessage } from '@/lib/medha/MedhaClient';
import { renderMarkdown, isForbiddenQuery, SANDHI_REDIRECT_MARKDOWN } from '@/lib/medha/markdown';
import {
  listChats, getChat, upsertChat, deleteChat,
  getCurrentChatId, setCurrentChatId, newChatId,
  type StoredChat, type StoredMsg,
} from '@/lib/medha/storage';
import { STT, TTS } from '@/lib/medha/voice';
import {
  incrementQuota, quotaRemaining, getUser, setUser,
  quotaLimit, type LocalUser,
} from '@/lib/quota/quota';
import MedhaConsentSlab, {
  hasLocalConsent, type ConsentSnapshot,
} from './MedhaConsentSlab';
import './medha.css';

// ─── Model colours ────────────────────────────────────────────────────────────
const MODEL_COLOR: Record<CognitiveModeKey, string> = {
  prajna:   '#ff4a4a',
  dhyana:   '#22e0d4',
  akshaya:  '#3a90ff',
  java:     '#ffb84d',
  sanchara: '#ff6688',
};

const uid = () =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2);

function summariseTopic(msgs: StoredMsg[]): string {
  const f = msgs.find(m => m.role === 'user')?.content?.trim() ?? '';
  return f.length > 60 ? f.slice(0, 57) + '…' : f;
}

const GREETING_NEW =
  'Hello — I am Medhā, the Cognitive Intelligence of VYAN. It is a quiet honour to meet you. What would you like to explore?';

function buildContinuationGreeting(prevTopic?: string): string {
  if (prevTopic && prevTopic.length > 6)
    return `Welcome back. Last time we touched on ${prevTopic}. Shall we continue — or step into something new?`;
  return 'Welcome back. The conversation is still warm. Where shall we begin?';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MedhaHUD() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<CognitiveModeKey>('prajna');
  const [chatId, setChatId] = useState('');
  const [messages, setMessages] = useState<StoredMsg[]>([]);
  const [composerText, setComposerText] = useState('');
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hoverDot, setHoverDot] = useState<number | null>(null);
  const [stickyDot, setStickyDot] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [quotaUser, setQuotaUser] = useState<LocalUser | null>(null);
  const [showQuotaLock, setShowQuotaLock] = useState(false);
  const [regBusy, setRegBusy] = useState(false);
  const [regErr, setRegErr] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [consentReady, setConsentReady] = useState(false);
  // Greeting: appears from node on model selection
  const [greetingText, setGreetingText] = useState<string | null>(null);
  const [greetingMode, setGreetingMode] = useState<CognitiveModeKey>('prajna');

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const sttRef = useRef<STT | null>(null);
  const ttsRef = useRef<TTS | null>(null);
  const greetingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef({ chatId: '', messages: [] as StoredMsg[], mode: 'prajna' as CognitiveModeKey });
  useEffect(() => { dataRef.current = { chatId, messages, mode }; }, [chatId, messages, mode]);

  const modeDef = useMemo(() => getMode(mode), [mode]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setConsentGranted(hasLocalConsent());
    setConsentReady(true);
    setQuotaUser(getUser());
    sttRef.current = new STT();
    ttsRef.current = new TTS();

    // Hide the Overlay's neural-depth rail and shunya caption — they're
    // part of the Shunya navigation UI and have no meaning inside Medhā.
    const rail = document.querySelector('.neural-depth') as HTMLElement | null;
    const caption = document.querySelector('.shunya-caption') as HTMLElement | null;
    if (rail) { rail.style.opacity = '0'; rail.style.pointerEvents = 'none'; }
    if (caption) { caption.style.opacity = '0'; }

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
      setChatId(id); setCurrentChatId(id);
      const greeting: StoredMsg = {
        id: uid(), role: 'assistant',
        content: prev ? buildContinuationGreeting(prev.topic) : GREETING_NEW,
        mode: 'prajna', ts: Date.now(),
      };
      setMessages([greeting]);
      upsertChat({ id, title: 'New Conversation', messages: [greeting], createdAt: Date.now(), lastInteractionAt: Date.now() });
    }
    setTimeout(() => setComposerOpen(true), 400);
    // Fire greeting for the default/initial model
    const initialModel = (searchParams?.get('model') as CognitiveModeKey) || 'prajna';
    const validInitial = COGNITIVE_MODES.find(x => x.key === initialModel) ? initialModel : 'prajna';
    setMode(validInitial);
    setGreetingText(MODEL_GREETINGS[validInitial]);
    setGreetingMode(validInitial);
    greetingTimer.current = setTimeout(() => setGreetingText(null), 5500);
    return () => {
      if (greetingTimer.current) clearTimeout(greetingTimer.current);
      // Restore Overlay elements when leaving Medhā
      const rail = document.querySelector('.neural-depth') as HTMLElement | null;
      const caption = document.querySelector('.shunya-caption') as HTMLElement | null;
      if (rail) { rail.style.opacity = ''; rail.style.pointerEvents = ''; }
      if (caption) { caption.style.opacity = ''; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync model from URL ?model= param ─────────────────────────────────────
  useEffect(() => {
    const m = searchParams?.get('model') as CognitiveModeKey | null;
    if (m && COGNITIVE_MODES.find(x => x.key === m)) {
      activateModel(m, m === mode); // force=true only when mode hasn't changed (re-select)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Persist chats ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatId) return;
    const topic = summariseTopic(messages);
    upsertChat({
      id: chatId,
      title: topic ? topic.slice(0, 36) : 'New Conversation',
      messages, createdAt: messages[0]?.ts ?? Date.now(),
      lastInteractionAt: Date.now(), topic,
    });
    setChats(listChats());
  }, [chatId, messages]);

  // ── Escape ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showHistory || showSettings) { setShowHistory(false); setShowSettings(false); return; }
        if (stickyDot !== null) { setStickyDot(null); return; }
        handleBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory, showSettings, stickyDot]);

  // ── Back: camera returns to orb-full, route back to /medha ────────────────
  const handleBack = () => {
    try {
      const vyan: any = (window as any).__vyan;
      vyan?.worldRef?.cameraRig?.returnToMedhaOrbFull?.();
    } catch {}
    router.push('/shunya/medha');
  };

  // ── Activate a model node: camera perspective + greeting + color pulse ────
  const activateModel = useCallback((k: CognitiveModeKey, force = false) => {
    if (k === mode && !force) return;
    setMode(k);

    // Greeting from node
    if (greetingTimer.current) clearTimeout(greetingTimer.current);
    setGreetingText(MODEL_GREETINGS[k]);
    setGreetingMode(k);
    greetingTimer.current = setTimeout(() => setGreetingText(null), 5500);

    // Update orb branch colors
    try {
      const vyan: any = (window as any).__vyan;
      const orb = vyan?.worldRef?.realms?.shunya?.getOrbByKey?.('medha');
      orb?.setSocketColors?.(MODEL_COLOR[k]);
    } catch {}

    // Camera: fly to this node's radial perspective (if not already done by ShunyaRealm click)
    // This path handles URL-driven switches (e.g. from ConciergeOrb nav)
    try {
      const vyan: any = (window as any).__vyan;
      const rig = vyan?.worldRef?.cameraRig;
      const shunya = vyan?.worldRef?.realms?.shunya;
      if (rig?.flyToMedhaNodePerspective && shunya) {
        const medhaOrb = shunya.getOrbByKey?.('medha');
        if (medhaOrb?.socketGroup?.children?.length) {
          const sock = medhaOrb.socketGroup.children.find(
            (c: any) => c.userData?.isProductSocket && c.userData?.productKey === k && c.geometry,
          );
          if (sock) {
            const THREE = require('three');
            const nodePos = new THREE.Vector3();
            sock.getWorldPosition(nodePos);
            const orbCenter = medhaOrb.group.position.clone();
            rig.flyToMedhaNodePerspective(nodePos, orbCenter);
          }
        }
      }
    } catch {}
  }, [mode]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = composerText.trim();
    if (!text || busy) return;
    if (!quotaUser && !getUser()) {
      if (quotaRemaining('medha') <= 0) { setShowQuotaLock(true); return; }
      if (!incrementQuota('medha').ok) { setShowQuotaLock(true); return; }
    }
    setComposerText(''); setIsTyping(false); setStickyDot(null);
    const userMsg: StoredMsg = { id: uid(), role: 'user', content: text, mode, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    if (isForbiddenQuery(text)) {
      const aiMsg: StoredMsg = { id: uid(), role: 'assistant', content: SANDHI_REDIRECT_MARKDOWN, mode, ts: Date.now() };
      setTimeout(() => setMessages(prev => [...prev, aiMsg]), 280);
      return;
    }

    setBusy(true);
    const history: ChatMessage[] = [...dataRef.current.messages, userMsg]
      .slice(-12).map(m => ({ role: m.role, content: m.content }));
    try {
      const full = await chatComplete(modeDef, history);
      const aiMsg: StoredMsg = {
        id: uid(), role: 'assistant',
        content: full || 'I lost the signal for a moment. Try again?',
        mode, ts: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (ttsEnabled && ttsRef.current?.isSupported()) {
        const plain = full.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/[*_`#>]/g, '');
        ttsRef.current.speak(plain, { onEnd: () => {} });
      }
    } catch {
      setMessages(prev => [...prev, { id: uid(), role: 'assistant', content: 'Cognition is busy. Give it a breath and try again.', mode, ts: Date.now() }]);
    } finally { setBusy(false); }
  }, [composerText, busy, mode, modeDef, ttsEnabled, quotaUser]);

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const submitRegistration = useCallback(async () => {
    if (!regEmail.trim() || regBusy) return;
    setRegBusy(true); setRegErr('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName, email: regEmail, intent: 'medha-unlock' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setRegErr(data?.error || 'Registration failed.'); return; }
      const u: LocalUser = data.user || { email: regEmail, name: regName, registeredAt: Date.now(), verified: false };
      setUser(u); setQuotaUser(u); setShowQuotaLock(false);
      setRegName(''); setRegEmail('');
    } catch { setRegErr('Network unavailable.'); }
    finally { setRegBusy(false); }
  }, [regName, regEmail, regBusy]);

  const startNewChat = () => {
    const prev = chats[0];
    const id = newChatId();
    setChatId(id); setCurrentChatId(id);
    const greeting: StoredMsg = {
      id: uid(), role: 'assistant',
      content: prev ? buildContinuationGreeting(prev.topic) : GREETING_NEW,
      mode, ts: Date.now(),
    };
    setMessages([greeting]); setStickyDot(null); setShowHistory(false);
  };

  const userMsgs = useMemo(
    () => messages.map((m, i) => ({ ...m, origIdx: i })).filter(m => m.role === 'user'),
    [messages],
  );
  const lastMsg = messages[messages.length - 1] ?? null;
  // Only show last message if it matches the CURRENT active mode.
  // This prevents a Javā response persisting when the user switches to Akṣaya.
  const lastMsgForMode = [...messages].reverse().find(
    m => m.role === 'assistant' && m.mode === mode,
  ) ?? null;
  const focusMsg: StoredMsg | null = stickyDot !== null
    ? (messages[stickyDot] ?? null)
    : busy ? (userMsgs[userMsgs.length - 1] ?? null)
           : lastMsgForMode;
  const previewMsg: StoredMsg | null = hoverDot !== null && stickyDot === null
    ? (messages[hoverDot] ?? null) : null;
  const showMsg = previewMsg ?? focusMsg;

  const copyMsg = async (m: StoredMsg) => {
    try { await navigator.clipboard.writeText(m.content); } catch {}
  };

  return (
    <div
      className="mlv"
      data-mode={mode}
      style={{
        ['--mode-a' as any]: MODEL_COLOR[mode],
        ['--mode-b' as any]: modeDef.colorB,
      }}
    >
      {/* ── Consent gate ─────────────────────────────────────────────── */}
      {consentReady && !consentGranted && (
        <MedhaConsentSlab onGranted={(_snap: ConsentSnapshot) => setConsentGranted(true)} />
      )}

      {/* ── Invisible orb-click zone (opens history) ─────────────────── */}
      <div
        className="mlv-orb-hit"
        onClick={() => setShowHistory(v => !v)}
        role="button"
        aria-label="Open conversation history"
      />

      {/* ── Back button ──────────────────────────────────────────────── */}
      <button type="button" className="mlv-back" onClick={handleBack}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
        </svg>
        <span>Shunya</span>
      </button>

      {/* ── Floating dialogue (one at a time, hides while typing) ─────── */}
      {showMsg && !isTyping && (
        <div
          className={`mlv-medha-dialog mlv-medha-dialog--${showMsg.role}`}
          key={showMsg.id}
        >
          <div className="mlv-medha-dialog__meta">
            <span>{showMsg.role === 'user' ? 'you' : getMode(showMsg.mode as CognitiveModeKey).name}</span>
            <span>{new Date(showMsg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          {showMsg.role === 'assistant' ? (
            <div
              className="mlv-medha-dialog__body medha-md"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(showMsg.content) }}
            />
          ) : (
            <div className="mlv-medha-dialog__body mlv-medha-dialog__body--user">
              {showMsg.content}
            </div>
          )}
          <div className="mlv-medha-dialog__actions">
            <button type="button" onClick={() => copyMsg(showMsg)}>⧉ copy</button>
            {stickyDot !== null && (
              <button type="button" onClick={() => setStickyDot(null)}>⟲ release</button>
            )}
          </div>
        </div>
      )}

      {/* ── Model greeting (fires from node on selection) ─────────────── */}
      {greetingText && (
        <div
          className="mlv-greeting-dialog"
          style={{ bottom: '120px', left: '50%', transform: 'translateX(-50%)' }}
        >
          <span className="mlv-greeting-dialog__who">
            {getMode(greetingMode).name}
          </span>
          <p className="mlv-greeting-dialog__text">{greetingText}</p>
        </div>
      )}

      {/* ── Right-rail: user inputs only ─────────────────────────────── */}
      <div className="mlv-thread">
        <div className="mlv-thread__line" />
        <div className="mlv-thread__dots">
          {userMsgs.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mlv-dot mlv-dot--user ${(stickyDot === m.origIdx || hoverDot === m.origIdx) ? 'is-glow' : ''}`}
              data-msg={m.content.slice(0, 200)}
              onMouseEnter={() => setHoverDot(m.origIdx)}
              onMouseLeave={() => setHoverDot(null)}
              onClick={() => setStickyDot(stickyDot === m.origIdx ? null : m.origIdx)}
              aria-label={`Message ${userMsgs.indexOf(m) + 1}`}
            />
          ))}
          {busy && <span className="mlv-thread__pending" />}
        </div>
      </div>

      {/* ── Composer ─────────────────────────────────────────────────── */}
      <div className={`mlv-composer ${composerOpen ? 'is-open' : ''} ${composerText.length > 220 ? 'is-tall' : ''}`}>
        {!composerOpen ? (
          <button
            type="button"
            className="mlv-composer__pill"
            onClick={() => { setComposerOpen(true); setTimeout(() => composerRef.current?.focus(), 50); }}
          >
            <span className="mlv-composer__dot" />
            <span>speak to {modeDef.name}</span>
          </button>
        ) : (
          <div className="mlv-composer__wrap">
            <span className="mlv-composer__bind">{modeDef.glyph} {modeDef.name}</span>
            <textarea
              ref={composerRef}
              value={composerText}
              placeholder={listening ? '(listening…)' : `Speak to ${modeDef.name}…`}
              maxLength={1000}
              onChange={e => { setComposerText(e.target.value); setIsTyping(e.target.value.length > 0); }}
              onFocus={() => setIsTyping(true)}
              onBlur={() => { if (!composerText.trim()) setIsTyping(false); }}
              onKeyDown={onComposerKey}
              rows={composerText.length > 220 ? 3 : 1}
              disabled={busy}
            />
            <button
              type="button"
              className="mlv-composer__attach"
              onClick={() => (document.getElementById('mlv-file-input') as HTMLInputElement | null)?.click()}
              title="Attach"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input
              id="mlv-file-input" type="file" accept="image/*,.pdf,.txt,.md,.json,.csv"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                setComposerText(cur => `${cur}\n\n[attached: ${f.name} · ${(f.size / 1024).toFixed(1)}KB]`);
                setIsTyping(true);
              }}
            />
            <button
              type="button"
              className={`mlv-composer__mic ${listening ? 'is-on' : ''}`}
              onClick={() => {
                const stt = sttRef.current;
                if (!stt?.isSupported()) return;
                if (listening) { stt.stop(); setListening(false); return; }
                setListening(true);
                stt.start({ onText: txt => setComposerText(txt), onEnd: () => setListening(false), onError: () => setListening(false) });
              }}
              disabled={!sttRef.current?.isSupported()}
            >◉</button>
            <button
              type="button"
              className="mlv-composer__send"
              onClick={send}
              disabled={busy || !composerText.trim()}
            >
              {busy ? <span className="mlv-composer__spin" /> : '→'}
            </button>
          </div>
        )}
      </div>

      {/* ── Settings orb — top-right, below Nāvika ───────────────────── */}
      <button
        type="button"
        className="mlv-settings-orb"
        onClick={() => setShowSettings(true)}
        aria-label="Medhā settings"
      >
        <span className="mlv-settings-orb__ring" />
        <span className="mlv-settings-orb__core" />
        <span className="mlv-settings-orb__glyph">⚙</span>
      </button>

      {/* ── History modal ─────────────────────────────────────────────── */}
      {showHistory && (
        <div className="mlv-modal" role="dialog" aria-modal="true"
             onClick={e => { if (e.target === e.currentTarget) setShowHistory(false); }}>
          <div className="mlv-modal__inner" onClick={e => e.stopPropagation()}>
            <header className="mlv-modal__head">
              <h2>Conversation Threads</h2>
              <button type="button" className="mlv-modal__x" onClick={() => setShowHistory(false)}>✕</button>
            </header>
            <div className="mlv-modal__body">
              {chats.length === 0 && <p className="mlv-modal__empty">No conversations yet.</p>}
              {chats.map(c => (
                <div key={c.id} className={`mlv-chat-row ${c.id === chatId ? 'is-current' : ''}`}>
                  <button type="button" className="mlv-chat-row__open"
                          onClick={() => { const ch = getChat(c.id); if (!ch) return; setChatId(ch.id); setCurrentChatId(ch.id); setMessages(ch.messages); setStickyDot(null); setShowHistory(false); }}>
                    <div className="mlv-chat-row__title">{c.title || 'Untitled'}</div>
                    <div className="mlv-chat-row__meta">{new Date(c.lastInteractionAt).toLocaleString()} · {c.messages.length} messages</div>
                  </button>
                  <button type="button" className="mlv-chat-row__del"
                          onClick={() => { deleteChat(c.id); setChats(listChats()); if (c.id === chatId) startNewChat(); }}>✕</button>
                </div>
              ))}
            </div>
            <footer className="mlv-modal__foot">
              <button type="button" className="mlv-modal__cta" onClick={startNewChat}>+ New conversation</button>
            </footer>
          </div>
        </div>
      )}

      {/* ── Settings panel ────────────────────────────────────────────── */}
      {showSettings && (
        <div className="mlv-modal mlv-modal--side" role="dialog" aria-modal="true"
             onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="mlv-modal__inner mlv-modal__inner--side" onClick={e => e.stopPropagation()}>
            <header className="mlv-modal__head">
              <h2>Cognitive Settings</h2>
              <button type="button" className="mlv-modal__x" onClick={() => setShowSettings(false)}>✕</button>
            </header>
            <div className="mlv-modal__body mlv-settings">
              <div className="mlv-settings__section">
                <div className="mlv-settings__lbl">Cognitive Mode</div>
                <div className="mlv-settings__modes">
                  {COGNITIVE_MODES.map(m => (
                    <button
                      key={m.key} type="button"
                      className={`mlv-mind ${mode === m.key ? 'is-active' : ''}`}
                      onClick={() => { activateModel(m.key); setShowSettings(false); }}
                      style={{ ['--mind-a' as any]: m.colorA, ['--mind-b' as any]: m.colorB }}
                    >
                      <span className="mlv-mind__glyph">{m.glyph}</span>
                      <span className="mlv-mind__name">{m.name}</span>
                    </button>
                  ))}
                </div>
                <p className="mlv-settings__hint">Active: <strong>{modeDef.name}</strong> · {modeDef.englishName}</p>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Voice reply (TTS)</span>
                <button type="button" className={`mlv-toggle ${ttsEnabled ? 'is-on' : ''}`}
                        onClick={() => setTtsEnabled(v => { if (v) ttsRef.current?.cancel(); return !v; })}>
                  {ttsEnabled ? 'on' : 'off'}
                </button>
              </div>
              <div className="mlv-set-row">
                <span className="mlv-set-row__k">Conversations stored</span>
                <span className="mlv-set-row__v">{chats.length}</span>
              </div>
              <div className="mlv-set-row">
                <button type="button" className="mlv-modal__danger" onClick={() => {
                  if (!confirm('Erase ALL conversations on this device?')) return;
                  chats.forEach(c => deleteChat(c.id)); setChats([]); startNewChat();
                }}>Erase all conversations</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quota lock ────────────────────────────────────────────────── */}
      {showQuotaLock && (
        <div className="medha-quota-lock" role="dialog" aria-modal="true">
          <div className="medha-quota-lock__card">
            <div className="medha-quota-lock__kicker">Cognition Threshold</div>
            <h2 className="medha-quota-lock__title">You have reached the visitor limit.</h2>
            <p className="medha-quota-lock__p">
              Medhā grants every wanderer <strong>{quotaLimit('medha')} conversations</strong> as a first taste.
            </p>
            <div className="medha-quota-lock__form">
              <input type="text" placeholder="Your name" value={regName} onChange={e => setRegName(e.target.value)} />
              <input type="email" placeholder="you@domain.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
              {regErr && <div className="medha-quota-lock__err">{regErr}</div>}
              <button type="button" className="medha-quota-lock__cta"
                      onClick={submitRegistration} disabled={regBusy || !regEmail.trim()}>
                {regBusy ? 'Transmitting…' : 'Register with VYAN'}
              </button>
            </div>
            <p className="medha-quota-lock__foot">VYAN will send a verification to your address.</p>
          </div>
        </div>
      )}
    </div>
  );
}
