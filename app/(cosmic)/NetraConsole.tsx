'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './netraconsole.css';

// ===========================================================
// VYAN Netra — Secret Admin Console
// Activation: type the sequence "netra" anywhere on the site,
// OR — if this device has been authorized before — tap the small
// orbit-gear icon at the bottom-right (visible ONLY on devices that
// have already authenticated once with the access code).
// Auth: 6-digit alphanumeric code stored in /app/.env (VYAN_NETRA_CODE).
// ===========================================================

const ACTIVATION_SEQ = 'netra';
const POLL_MS = 30_000; // 30s — zero cost (cached server-side)
const FP_KEY = 'vyan.netra.fp';
const TRUSTED_KEY = 'vyan.netra.trusted';
const DEVICE_AUTH_KEY = 'vyan.netra.device_auth';

type Metrics = {
  ok: boolean;
  timestamp: number;
  killSwitch: { tripped: boolean; budgetUSD: number; estimatedSpendUSD: number };
  server: { uptimeHuman: string; env: string };
  vercel: {
    mocked: boolean;
    project?: string;
    latestDeployment?: { state: string; createdAt: number; url: string; target: string };
    readyDeployments24h?: number;
    errorDeployments24h?: number;
    error?: string;
  };
  pollinations: { ms: number; ok: boolean };
  gemini: { calls: number; estimatedSpendUSD: number; keyConfigured: boolean };
  visitors: { active: number; windowMinutes: number };
  smtp?: {
    host: string;
    port: number | '';
    user: string;
    fromEmail: string;
    secure: boolean;
    hasPassword: boolean;
    persisted: boolean;
    updatedAt?: number;
  };
};

function getOrCreateFingerprint(): string {
  try {
    let fp = localStorage.getItem(FP_KEY);
    if (!fp) {
      fp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(FP_KEY, fp);
    }
    return fp;
  } catch {
    return 'anon';
  }
}

export default function NetraConsole() {
  const [phase, setPhase] = useState<'hidden' | 'auth' | 'open'>('hidden');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [refreshAt, setRefreshAt] = useState(0);
  const [deviceAuthorized, setDeviceAuthorized] = useState(false);
  const [smtp, setSmtp] = useState({ host: '', port: '587', user: '', pass: '', fromEmail: '', secure: false });
  const [smtpMsg, setSmtpMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [smtpBusy, setSmtpBusy] = useState(false);
  const seqRef = useRef('');
  const codeRef = useRef<string>('');

  // ----- On mount: read device-auth state ------------------
  useEffect(() => {
    try {
      const trusted = localStorage.getItem(TRUSTED_KEY) || '';
      const deviceAuth = localStorage.getItem(DEVICE_AUTH_KEY) || '';
      if (trusted) codeRef.current = trusted;
      setDeviceAuthorized(!!deviceAuth);
    } catch {
      /* no-op */
    }
  }, []);

  // ----- Heartbeat: register this visitor ------------------
  useEffect(() => {
    const fp = getOrCreateFingerprint();
    const ping = () => {
      fetch('/api/netra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'ping', fingerprint: fp }),
        keepalive: true,
      }).catch(() => undefined);
    };
    ping();
    const id = setInterval(ping, 90_000);
    return () => clearInterval(id);
  }, []);

  // ----- Konami-style listener -----------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key.length !== 1) return;
      seqRef.current = (seqRef.current + e.key.toLowerCase()).slice(-ACTIVATION_SEQ.length);
      if (seqRef.current === ACTIVATION_SEQ) {
        seqRef.current = '';
        e.preventDefault();
        e.stopPropagation();
        const trusted = localStorage.getItem(TRUSTED_KEY) || '';
        if (trusted) {
          codeRef.current = trusted;
          setPhase('open');
        } else {
          setPhase('auth');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ----- ESC to close --------------------------------------
  useEffect(() => {
    if (phase === 'hidden') return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPhase('hidden');
        setCode('');
        setError('');
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [phase]);

  // ----- Fetch metrics (when open) -------------------------
  const fetchMetrics = useCallback(async () => {
    if (!codeRef.current) return;
    try {
      const r = await fetch(`/api/netra?code=${encodeURIComponent(codeRef.current)}`, {
        headers: { 'x-netra-code': codeRef.current },
      });
      if (r.status === 401) {
        localStorage.removeItem(TRUSTED_KEY);
        localStorage.removeItem(DEVICE_AUTH_KEY);
        codeRef.current = '';
        setDeviceAuthorized(false);
        setPhase('auth');
        setError('Trust revoked. Re-enter code.');
        return;
      }
      const data = (await r.json()) as Metrics;
      setMetrics(data);
      setRefreshAt(Date.now());
      // Seed SMTP form with persisted values (but never the password).
      if (data.smtp) {
        setSmtp((s) => ({
          host: data.smtp?.host ?? s.host,
          port: String(data.smtp?.port ?? s.port),
          user: data.smtp?.user ?? s.user,
          pass: '',
          fromEmail: data.smtp?.fromEmail ?? s.fromEmail,
          secure: !!data.smtp?.secure,
        }));
      }
    } catch {
      /* keep last metrics */
    }
  }, []);

  useEffect(() => {
    if (phase !== 'open') return;
    fetchMetrics();
    const id = setInterval(fetchMetrics, POLL_MS);
    return () => clearInterval(id);
  }, [phase, fetchMetrics]);

  // ----- Submit code ---------------------------------------
  const submit = useCallback(async () => {
    const c = code.trim().toUpperCase();
    if (c.length !== 6) {
      setError('Code must be 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/netra?code=${encodeURIComponent(c)}`, {
        headers: { 'x-netra-code': c },
      });
      if (r.status === 401) {
        setError('Code rejected.');
        setBusy(false);
        return;
      }
      if (!r.ok) {
        setError('Service unavailable.');
        setBusy(false);
        return;
      }
      codeRef.current = c;
      localStorage.setItem(TRUSTED_KEY, c);
      // Mark THIS device as authorized so the gear icon appears henceforth.
      localStorage.setItem(DEVICE_AUTH_KEY, '1');
      setDeviceAuthorized(true);
      const data = (await r.json()) as Metrics;
      setMetrics(data);
      setRefreshAt(Date.now());
      setPhase('open');
      setCode('');
    } catch {
      setError('Network error.');
    } finally {
      setBusy(false);
    }
  }, [code]);

  const onKeyAuth = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
  };

  // ----- SMTP update --------------------------------------
  const saveSmtp = useCallback(async () => {
    if (!codeRef.current) return;
    setSmtpBusy(true);
    setSmtpMsg(null);
    try {
      const r = await fetch('/api/netra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-netra-code': codeRef.current },
        body: JSON.stringify({
          event: 'smtp_update',
          code: codeRef.current,
          host: smtp.host.trim(),
          port: parseInt(smtp.port || '587', 10) || 587,
          user: smtp.user.trim(),
          pass: smtp.pass,
          fromEmail: smtp.fromEmail.trim(),
          secure: !!smtp.secure,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setSmtpMsg({ tone: 'err', text: data?.error || 'Save failed.' });
      } else {
        setSmtpMsg({
          tone: 'ok',
          text: data.persisted
            ? 'SMTP settings saved (in-memory). Restart to clear.'
            : 'SMTP saved · MOCKED · drop into /app/.env to persist.',
        });
        // Clear password field on success — never leave plaintext lingering.
        setSmtp((s) => ({ ...s, pass: '' }));
        fetchMetrics();
      }
    } catch {
      setSmtpMsg({ tone: 'err', text: 'Network error.' });
    } finally {
      setSmtpBusy(false);
    }
  }, [smtp, fetchMetrics]);

  const openFromIcon = useCallback(() => {
    const trusted = localStorage.getItem(TRUSTED_KEY) || '';
    if (trusted) {
      codeRef.current = trusted;
      setPhase('open');
    } else {
      setPhase('auth');
    }
  }, []);

  return (
    <>
      {/* Device-restricted gear icon — appears ONLY on devices that have
          successfully authenticated at least once. Tap to re-open the console.
          To hide on this device: long-press the gear and confirm reset. */}
      {deviceAuthorized && phase === 'hidden' && (
        <button
          className="netra-gear"
          onClick={openFromIcon}
          onContextMenu={(e) => {
            e.preventDefault();
            const ok = window.confirm('Revoke admin trust on THIS device? You will need the access code to re-enable.');
            if (ok) {
              localStorage.removeItem(TRUSTED_KEY);
              localStorage.removeItem(DEVICE_AUTH_KEY);
              setDeviceAuthorized(false);
              codeRef.current = '';
            }
          }}
          aria-label="Open Netra admin console"
          title="VYAN Netra — admin"
        >
          <span className="netra-gear__orbit" />
          <span className="netra-gear__glyph">◈</span>
        </button>
      )}

      {phase !== 'hidden' && (
        <div className="netra-root" role="dialog" aria-modal="true">
          <div className="netra-veil" onClick={() => setPhase('hidden')} />

          <div className="netra-frame">
            <div className="netra-corner tl" />
            <div className="netra-corner tr" />
            <div className="netra-corner bl" />
            <div className="netra-corner br" />

            <header className="netra-header">
              <div className="netra-title">
                <span className="netra-glyph">◈</span>
                <span>VYAN&nbsp;Netra</span>
                <span className="netra-sub">universal console</span>
              </div>
              <button className="netra-x" onClick={() => setPhase('hidden')} aria-label="close">
                ✕
              </button>
            </header>

            {phase === 'auth' && (
              <section className="netra-auth">
                <p className="netra-prompt">enter 6-character access code</p>
                <input
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={onKeyAuth}
                  className="netra-code-input"
                  placeholder="------"
                  spellCheck={false}
                  autoComplete="off"
                />
                {error && <div className="netra-error">{error}</div>}
                <button className="netra-submit" onClick={submit} disabled={busy || code.length !== 6}>
                  {busy ? 'verifying…' : 'transmit'}
                </button>
                <div className="netra-hint">esc to exit · trust persists on this device</div>
              </section>
            )}

            {phase === 'open' && metrics && (
              <section className="netra-grid">
                <Panel title="system" tone="primary">
                  <Row k="env" v={metrics.server.env} />
                  <Row k="uptime" v={metrics.server.uptimeHuman} />
                  <Row
                    k="kill-switch"
                    v={
                      <span className={metrics.killSwitch.tripped ? 'bad' : 'good'}>
                        {metrics.killSwitch.tripped ? 'TRIPPED' : 'armed'}{' '}
                        <span className="dim">
                          (${metrics.killSwitch.estimatedSpendUSD.toFixed(4)} / ${metrics.killSwitch.budgetUSD.toFixed(2)})
                        </span>
                      </span>
                    }
                  />
                </Panel>

                <Panel title="vercel" tone="cyan">
                  {metrics.vercel.mocked && <Row k="source" v={<span className="warn">MOCK · provide VERCEL_API_TOKEN</span>} />}
                  <Row
                    k="state"
                    v={
                      <span className={metrics.vercel.latestDeployment?.state === 'READY' ? 'good' : 'warn'}>
                        {metrics.vercel.latestDeployment?.state || '—'}
                      </span>
                    }
                  />
                  {metrics.vercel.latestDeployment?.url && <Row k="url" v={metrics.vercel.latestDeployment.url} mono />}
                  {metrics.vercel.latestDeployment?.target && <Row k="target" v={metrics.vercel.latestDeployment.target} />}
                  {typeof metrics.vercel.latestDeployment?.createdAt === 'number' && (
                    <Row k="deployed" v={timeAgo(metrics.vercel.latestDeployment.createdAt)} />
                  )}
                  {typeof metrics.vercel.readyDeployments24h === 'number' && (
                    <Row
                      k="24h"
                      v={
                        <span>
                          <span className="good">{metrics.vercel.readyDeployments24h} ready</span> ·{' '}
                          <span className={metrics.vercel.errorDeployments24h ? 'bad' : 'dim'}>
                            {metrics.vercel.errorDeployments24h || 0} err
                          </span>
                        </span>
                      }
                    />
                  )}
                  {metrics.vercel.error && <Row k="err" v={<span className="bad">{metrics.vercel.error}</span>} />}
                </Panel>

                <Panel title="latency" tone="violet">
                  <Row
                    k="pollinations"
                    v={
                      <span className={metrics.pollinations.ok ? 'good' : 'bad'}>
                        {metrics.pollinations.ms}ms {metrics.pollinations.ok ? '✓' : '✗'}
                      </span>
                    }
                  />
                  <Row
                    k="gemini key"
                    v={
                      <span className={metrics.gemini.keyConfigured ? 'good' : 'warn'}>
                        {metrics.gemini.keyConfigured ? 'configured' : 'missing'}
                      </span>
                    }
                  />
                  <Row k="gemini calls" v={`${metrics.gemini.calls}`} />
                  <Row k="est. spend" v={`$${metrics.gemini.estimatedSpendUSD.toFixed(4)}`} />
                </Panel>

                <Panel title="visitors" tone="amber">
                  <Row k="active" v={<span className="good big">{metrics.visitors.active}</span>} />
                  <Row k="window" v={`${metrics.visitors.windowMinutes}m`} />
                </Panel>

                {/* SMTP credentials editor — full-width row */}
                <div className="netra-panel netra-panel--wide tone-ember">
                  <div className="netra-panel-title">
                    smtp · saṅkalpa transmissions
                    <span className="netra-panel-sub">
                      {metrics.smtp?.persisted ? 'in-memory · ephemeral' : 'MOCKED · provide SMTP_* env vars to persist'}
                    </span>
                  </div>
                  <div className="netra-panel-body">
                    <div className="netra-form-grid">
                      <label className="netra-field">
                        <span>host</span>
                        <input
                          type="text"
                          value={smtp.host}
                          onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                          placeholder="smtp.zoho.in"
                          autoComplete="off"
                        />
                      </label>
                      <label className="netra-field">
                        <span>port</span>
                        <input
                          type="text"
                          value={smtp.port}
                          onChange={(e) => setSmtp({ ...smtp, port: e.target.value.replace(/[^0-9]/g, '') })}
                          placeholder="587"
                          autoComplete="off"
                        />
                      </label>
                      <label className="netra-field">
                        <span>user</span>
                        <input
                          type="text"
                          value={smtp.user}
                          onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                          placeholder="sankalpa@vyan.com"
                          autoComplete="off"
                        />
                      </label>
                      <label className="netra-field">
                        <span>password</span>
                        <input
                          type="password"
                          value={smtp.pass}
                          onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                          placeholder={metrics.smtp?.hasPassword ? '••••• (stored)' : 'app password'}
                          autoComplete="new-password"
                        />
                      </label>
                      <label className="netra-field netra-field--wide">
                        <span>from email</span>
                        <input
                          type="text"
                          value={smtp.fromEmail}
                          onChange={(e) => setSmtp({ ...smtp, fromEmail: e.target.value })}
                          placeholder="VYAN Saṅkalpa <sankalpa@vyan.com>"
                          autoComplete="off"
                        />
                      </label>
                      <label className="netra-checkrow">
                        <input
                          type="checkbox"
                          checked={smtp.secure}
                          onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
                        />
                        <span>TLS (secure: true · port 465)</span>
                      </label>
                    </div>
                    <div className="netra-form-actions">
                      <button className="netra-submit netra-submit--inline" onClick={saveSmtp} disabled={smtpBusy}>
                        {smtpBusy ? 'saving…' : 'save smtp'}
                      </button>
                      {smtpMsg && <span className={`netra-formmsg ${smtpMsg.tone}`}>{smtpMsg.text}</span>}
                    </div>
                    <p className="netra-formfoot">
                      Saved values are stored in server memory and used by <code>/api/sankalpa</code> until restart.
                      For permanent persistence, add <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,
                      <code> SMTP_USER</code>, <code>SMTP_PASS</code>, <code>SMTP_FROM</code>,
                      <code> SMTP_SECURE</code> to <code>/app/.env</code>.
                    </p>
                  </div>
                </div>
              </section>
            )}

            <footer className="netra-footer">
              <span className="dim">esc to exit</span>
              {phase === 'open' && refreshAt > 0 && (
                <span className="dim">
                  last sync · {new Date(refreshAt).toLocaleTimeString()}
                  <button className="netra-refresh" onClick={fetchMetrics} title="refresh now">
                    ⟳
                  </button>
                </span>
              )}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function Panel({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <div className={`netra-panel tone-${tone}`}>
      <div className="netra-panel-title">{title}</div>
      <div className="netra-panel-body">{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="netra-row">
      <span className="netra-k">{k}</span>
      <span className={`netra-v ${mono ? 'mono' : ''}`}>{v}</span>
    </div>
  );
}

function timeAgo(t: number): string {
  const d = Date.now() - t;
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
