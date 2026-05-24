'use client';
import React, { useEffect, useState } from 'react';

// ============================================================
// MEDHĀ CONSENT GATE
// Shown ONCE per user (email) before entering the Medhā void.
// Persists to MongoDB via /api/consent (deduped by email) AND
// to localStorage so the user isn't asked again on the same device.
// ============================================================

const LOCAL_KEY = 'vyan.medha.consent';
const LOCAL_EMAIL = 'vyan.medha.consent.email';

export type ConsentSnapshot = {
  name: string;
  email: string;
  phone?: string;
  purpose: string;
  consentedAt: number;
};

export function hasLocalConsent(): boolean {
  try { return localStorage.getItem(LOCAL_KEY) === '1'; } catch { return false; }
}
export function getStoredConsentEmail(): string {
  try { return localStorage.getItem(LOCAL_EMAIL) || ''; } catch { return ''; }
}
export function clearLocalConsent() {
  try { localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(LOCAL_EMAIL); } catch {}
}

export default function MedhaConsentSlab({ onGranted }: { onGranted: (snap: ConsentSnapshot) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);

  // If user has an old email cached but no local consent flag, check server.
  useEffect(() => {
    const cached = getStoredConsentEmail();
    if (!cached) return;
    setChecking(true);
    fetch(`/api/consent?email=${encodeURIComponent(cached)}`)
      .then(r => r.json())
      .then(d => {
        if (d.exists) {
          try { localStorage.setItem(LOCAL_KEY, '1'); } catch {}
          onGranted({ name: '', email: cached, purpose: '', consentedAt: d.consentedAt ?? Date.now() });
        }
      })
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, [onGranted]);

  const submit = async () => {
    if (busy) return;
    setErr('');
    if (!name.trim()) return setErr('Please share your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr('A valid email is needed.');
    if (purpose.trim().length < 6) return setErr('A short purpose helps Medhā meet you better.');
    if (!agree) return setErr('Consent is required to converse with Medhā.');
    setBusy(true);
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          purpose: purpose.trim(),
          consent: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data?.error || 'Could not record consent. Try again.'); return; }
      try {
        localStorage.setItem(LOCAL_KEY, '1');
        localStorage.setItem(LOCAL_EMAIL, email.trim().toLowerCase());
      } catch {}
      onGranted({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        purpose: purpose.trim(),
        consentedAt: data.consentedAt ?? Date.now(),
      });
    } catch {
      setErr('Network unavailable. Try again.');
    } finally { setBusy(false); }
  };

  if (checking) return null;

  return (
    <div className="mcc-veil" role="dialog" aria-modal="true">
      <div className="mcc-card">
        <div className="mcc-kicker">A quiet word before you meet Medhā</div>
        <h2 className="mcc-title">Consent &middot; Continuity</h2>
        <p className="mcc-p">
          Your conversation with Medhā may be retained by VYAN — to refine her cognition,
          improve the service, and uphold security. Your messages stay associated only with
          the email you share below. You are asked <strong>only once</strong>.
        </p>
        <div className="mcc-grid">
          <label className="mcc-field">
            <span>Name <em>*</em></span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="How may Medhā address you?" />
          </label>
          <label className="mcc-field">
            <span>Email <em>*</em></span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={240} placeholder="you@domain.com" />
          </label>
          <label className="mcc-field">
            <span>Phone <span className="mcc-opt">(optional)</span></span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} placeholder="+91 …" />
          </label>
          <label className="mcc-field mcc-field--wide">
            <span>Purpose <em>*</em></span>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={1000} rows={3} placeholder="Why are you here? What would you like to explore with Medhā?" />
          </label>
        </div>
        <label className="mcc-agree">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I consent to VYAN storing my conversations with Medhā for service improvement, cognition refinement, and security purposes. I have read and agree to the relevant legal notices below the cosmos.</span>
        </label>
        {err && <div className="mcc-err">{err}</div>}
        <button type="button" className="mcc-cta" onClick={submit} disabled={busy}>
          {busy ? 'transmitting…' : 'Enter Medhā'}
        </button>
        <p className="mcc-foot">
          Your local browser keeps a copy of every conversation. The cloud copy may be deleted at any time by emailing <em>sandhi@vyanlabs.com</em>.
        </p>
      </div>
    </div>
  );
}
