'use client';
import React from 'react';

// ============================================================
// MEDHĀ CONSENT GATE — Policy-only, no personal data collected
// User either agrees (full features) or denies (guest / temp session).
// ============================================================

const LOCAL_KEY    = 'vyan.medha.consent';
const LOCAL_DENIED = 'vyan.medha.consent.denied';

export type ConsentSnapshot = { consentedAt: number };

export function hasLocalConsent(): boolean {
  try { return localStorage.getItem(LOCAL_KEY) === '1'; } catch { return false; }
}
export function hasLocalDenial(): boolean {
  try { return localStorage.getItem(LOCAL_DENIED) === '1'; } catch { return false; }
}
export function clearLocalConsent() {
  try { localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(LOCAL_DENIED); } catch {}
}

export default function MedhaConsentSlab({
  onGranted,
  onDenied,
}: {
  onGranted: (snap: ConsentSnapshot) => void;
  onDenied: () => void;
}) {
  const handleAgree = () => {
    try { localStorage.setItem(LOCAL_KEY, '1'); } catch {}
    onGranted({ consentedAt: Date.now() });
  };

  const handleDeny = () => {
    try { localStorage.setItem(LOCAL_DENIED, '1'); } catch {}
    onDenied();
  };

  return (
    <div className="mcc-veil" role="dialog" aria-modal="true">
      <div className="mcc-card">
        <div className="mcc-kicker">Before you enter the void</div>
        <h2 className="mcc-title">Cognitive Interaction Policy</h2>

        <div className="mcc-policy">
          <section className="mcc-policy__section">
            <h3 className="mcc-policy__heading">What Medhā may collect</h3>
            <p className="mcc-policy__body">
              Your conversation messages may be processed and retained on secure VYAN servers
              to provide continuity across sessions and to refine Medhā&apos;s intelligence over time.
            </p>
          </section>

          <section className="mcc-policy__section">
            <h3 className="mcc-policy__heading">How your data is used</h3>
            <ul className="mcc-policy__list">
              <li>Conversations may be stored to enable session continuity — returning to Medhā resumes where you left off.</li>
              <li>Interaction patterns may be used anonymously to improve Medhā&apos;s reasoning and responses.</li>
              <li>Your data is never sold to or shared with any third party outside VYAN.</li>
              <li>Sessions are identified by a browser token — no personal identity is required.</li>
            </ul>
          </section>

          <section className="mcc-policy__section">
            <h3 className="mcc-policy__heading">Your rights</h3>
            <p className="mcc-policy__body">
              You may request deletion of your data at any time by contacting <strong>admin@vyanlabs.com</strong>.
              Consent may be revoked from within the Medhā interface at any time — stored sessions
              will be cleared from this device immediately.
            </p>
          </section>

          <section className="mcc-policy__section mcc-policy__section--last">
            <h3 className="mcc-policy__heading">Proceeding without consent</h3>
            <p className="mcc-policy__body">
              You may enter Medhā without consenting. In this mode your conversations are <strong>temporary</strong> —
              they exist only during your current visit and are not stored, recoverable, or continuable after you leave.
            </p>
          </section>
        </div>

        <div className="mcc-actions">
          <button type="button" className="mcc-cta" onClick={handleAgree}>
            I Agree — Enter Medhā
          </button>
          <button type="button" className="mcc-deny" onClick={handleDeny}>
            Proceed Without Consent
          </button>
        </div>

        <p className="mcc-foot">
          By agreeing you accept VYAN&apos;s privacy policy and terms of service.
        </p>
      </div>
    </div>
  );
}
