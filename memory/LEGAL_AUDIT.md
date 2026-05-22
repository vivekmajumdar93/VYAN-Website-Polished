# VYAN — Legal & Compliance Audit (May 2026)

> Status: **Audit only.** Identifies risks and required artefacts. No legal text is shipped yet — see "Required next steps" at the bottom for what VYAN must add before production.

## 1. Required legal artefacts (NOT yet implemented)

| # | Artefact | Status | Why |
|---|----------|--------|-----|
| 1 | **Terms of Service** | ❌ Missing | Defines user rights, prohibited uses, IP, dispute resolution. Mandatory for any AI/SaaS. |
| 2 | **Privacy Policy** | ❌ Missing | GDPR/CCPA require disclosure of: data collected (email, chat content, voice transcripts, device fingerprint), legal basis, retention (we use 30-day local storage for chats — must disclose), 3rd-party processors (Gemini, Pollinations, Vercel, MongoDB). |
| 3 | **Cookie / Local-Storage Disclosure** | ❌ Missing | We persist `vyan.medha.chats`, `vyan.user`, `vyan.quota.usage`, `vyan.netra.trusted`, etc. in localStorage. GDPR considers this analogous to cookies — explicit consent required for EU. |
| 4 | **AI Disclaimer** | ⚠️ Partial | Medhā's greeting introduces her as "Cognitive Intelligence" — could be construed as anthropomorphic. Need explicit "AI-generated content, may be inaccurate" disclosure. EU AI Act requires this for generative AI. |
| 5 | **Children / Age Gate** | ❌ Missing | No age verification. Must mark 13+ minimum (COPPA), 16+ for EU data processing. |
| 6 | **DPA / Sub-processor List** | ❌ Missing | Required for enterprise B2B contracts when handling third-party PII. |
| 7 | **Right-to-Delete mechanism** | ⚠️ Partial | Settings modal has "Erase all conversations" — covers local data. **No server-side delete** for `/api/register` or `/api/sankalpa` submissions. Add a `DELETE /api/user` endpoint. |
| 8 | **Data Export (right of access)** | ❌ Missing | GDPR Art. 20. User should be able to download all data VYAN holds. |
| 9 | **Cookie-banner / Consent string** | ❌ Missing | EU users in particular. |
| 10 | **Trademark notice** | ⚠️ Verify | "VYAN", "Vyōma", "Shunya Mandala", "Vistāra", "Medhā", "Saṅkalpa", "VYAN Netra" — confirm trademark/wordmark filing status. Sanskrit terms themselves are not trademarkable but the combinations may be. |

## 2. Content / brand risks

| Risk | Severity | Notes |
|------|----------|-------|
| Use of Sanskrit terminology (Medhā, Prājña, Dhyāna, Akṣaya, Javā, Sañcāra, Shunya, Vistāra, Vyōma, Vyūha, Sandhi, Saṅkalpa) | 🟢 Low | Sanskrit is public-domain; no copyright. Avoid implying religious endorsement. The current copy is poetic, not doctrinal — safe. |
| AI personification of "Medhā" with a body, face, eyes, voice | 🟡 Medium | EU AI Act Art. 50 requires generative AI to be clearly disclosed. Add a tiny "AI" marker near the orb + a one-line tooltip on first encounter. |
| Concierge orb / Nāvika dialogue uses Gemini | 🟡 Medium | Gemini ToS prohibit certain uses (medical, financial advice, etc.). Add a system-prompt-level guardrail (already partially present via `isForbiddenQuery`). |
| Voice synthesis without user consent | 🟢 Low | TTS is opt-in (♪ button is OFF by default). Documented. |
| Voice transcription (STT) | 🟡 Medium | Browser-native `SpeechRecognition` sends audio to vendor servers (Google for Chrome). Must disclose in Privacy Policy. |
| Storing chat content in localStorage 30 days | 🟢 Low | Local-only, no server transmission. But still must disclose. |
| `/api/concierge` calls Gemini with user prompts | 🟡 Medium | Gemini logs the prompts. Disclose this in privacy policy + add prompt-redaction for any obvious PII (email, phone). |
| Saṅkalpa form collects PII (name, email, phone, company) | 🟡 Medium | Need explicit consent checkbox before submit + a "by submitting you agree…" link to ToS/Privacy. |
| `/api/register` collects email | 🟡 Medium | Same as above — needs consent. |
| VYAN Netra admin console (master code in env) | 🟢 Low | Internal use only, no PII exposed. Document who has access. |

## 3. Functional / flow risks

- **No rate-limiting on `/api/sankalpa`** — a bot could flood. Add IP-based throttling (e.g., 5 submissions/hour/IP).
- **No CAPTCHA on Saṅkalpa form** — recommend reCAPTCHA or Cloudflare Turnstile.
- **No email verification flow** for `/api/register` — the route returns `verified: false` and stubs `sendVerifyEmail()`. Wire actual SMTP/Resend before launch.
- **No logout** for VYAN Netra trusted device — add "revoke trust on this device" in console.
- **MongoDB connection** uses single global client — fine for serverless on Vercel, but ensure connection-pool limits aren't exceeded.

## 4. Accessibility (legal in many jurisdictions)

- ✅ Skip-to-content not present — add for screen readers.
- ⚠️ Several controls (concierge, codex `i`) have aria-labels but no keyboard tab-order. Add tabindex + focus styles.
- ⚠️ Color-contrast: subtle pinks on dark may fail WCAG AA in some places (e.g. `.gateway-line-3` at 0.5 opacity).
- ✅ Reduced-motion: NOT currently respected. Add `@media (prefers-reduced-motion: reduce)` to disable canvas animations.

## 5. Required next steps before public launch

1. Draft + publish: ToS, Privacy Policy, Cookie Policy, AI Disclaimer.
2. Add consent checkbox to Saṅkalpa form (`"I agree to the Terms and Privacy Policy"`).
3. Add 13+ age gate on first visit.
4. Implement `DELETE /api/user/:email` for right-to-erasure.
5. Implement `GET /api/user/:email/export` for right-of-access.
6. Wire reCAPTCHA / Turnstile to Saṅkalpa + Register.
7. Wire SMTP (Resend / SendGrid) into `sendVerifyEmail()` and `sendNotificationEmail()`.
8. File trademark applications for "VYAN" wordmark + each product name.
9. Add `prefers-reduced-motion` handling across the canvases.
10. Add a thin "AI" badge below the Medhā greeting per EU AI Act Art. 50.

---
This document is **engineering audit**, not legal advice. Engage a lawyer in the user's primary jurisdictions (India + EU + US recommended) before production launch.
