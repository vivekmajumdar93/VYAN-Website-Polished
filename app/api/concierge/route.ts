// Server-side LLM proxy for the Concierge Orb.
// Primary path: Emergent Universal LLM key (OpenAI-compatible /chat/completions).
// Fallback: direct Gemini generateContent (free tier — rate-limited).
// Cache: 60s in-memory keyed by (prompt+style) so we don't burn calls on every poll.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Emergent LLM gateway — OpenAI-compatible. Verified working URL.
const EMERGENT_BASE = process.env.EMERGENT_LLM_PROXY_URL
  || 'https://integrations.emergentagent.com/llm/v1/chat/completions';
// Model names on the Emergent gateway use a provider/<name> namespacing.
const EMERGENT_MODEL = 'gemini/gemini-2.0-flash';

// In-memory response cache (60s TTL) keyed by (prompt+style).
type CacheEntry = { text: string; ts: number };
const cache: Map<string, CacheEntry> = (globalThis as any).__VYAN_CONCIERGE_CACHE__
  || ((globalThis as any).__VYAN_CONCIERGE_CACHE__ = new Map());
const CACHE_TTL_MS = 60_000;

// Per-IP throttle: max 1 request per 10s.
const ipLast: Map<string, number> = (globalThis as any).__VYAN_CONCIERGE_IP__
  || ((globalThis as any).__VYAN_CONCIERGE_IP__ = new Map());
const THROTTLE_MS = 10_000;

async function callEmergent(prompt: string, style: string, key: string): Promise<string | null> {
  const messages: any[] = [];
  if (style) messages.push({ role: 'system', content: style });
  messages.push({ role: 'user', content: prompt });
  const body = JSON.stringify({
    model: EMERGENT_MODEL,
    messages,
    max_tokens: 220,
    temperature: 0.85,
  });
  try {
    const res = await fetch(EMERGENT_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body,
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text: string =
      data?.choices?.[0]?.message?.content?.toString?.()?.trim?.() ?? '';
    return text || null;
  } catch {
    return null;
  }
}

async function callGemini(prompt: string, style: string, key: string): Promise<{ text: string | null; status: number }> {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`;
  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: style ? { parts: [{ text: style }] } : undefined,
    generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 200 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { text: null, status: res.status };
    const data: any = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() ?? '';
    return { text: text || null, status: 200 };
  } catch {
    return { text: null, status: 502 };
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 });
  }

  const prompt: string = (body?.prompt ?? '').toString().slice(0, 1400);
  const style: string = (body?.style ?? '').toString().slice(0, 280);
  if (!prompt) return NextResponse.json({ error: 'EMPTY_PROMPT' }, { status: 400 });

  // ---- Cache lookup ------------------------------------------
  const cacheKey = `${style}::${prompt}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ text: cached.text, cached: true });
  }

  // ---- Per-IP throttle ---------------------------------------
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  const last = ipLast.get(ip) || 0;
  if (now - last < THROTTLE_MS) {
    // If we have *any* cache entry, serve it stale rather than 429.
    if (cached) return NextResponse.json({ text: cached.text, cached: true, stale: true });
    return NextResponse.json({ error: 'THROTTLE' }, { status: 429 });
  }
  ipLast.set(ip, now);

  // ---- Kill switch & usage tracking --------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage: any = (globalThis as any).__VYAN_USAGE__ || ((globalThis as any).__VYAN_USAGE__ = {
    gemini_calls: 0, pollinations_calls: 0, vercel_api_calls: 0, emergent_calls: 0, bootedAt: Date.now(),
  });
  const killBudget = parseFloat(process.env.NETRA_KILL_SWITCH_USD || '1');
  const estimatedSpend = usage.gemini_calls * 0.0002;
  if (estimatedSpend >= killBudget) {
    return NextResponse.json(
      { error: 'KILL_SWITCH', message: 'Daily budget exceeded. Console disarmed via VYAN Netra.' },
      { status: 503 },
    );
  }

  // ---- PRIMARY: Emergent Universal LLM key (free tier) -------
  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (emergentKey) {
    const text = await callEmergent(prompt, style, emergentKey);
    if (text) {
      usage.emergent_calls = (usage.emergent_calls || 0) + 1;
      cache.set(cacheKey, { text, ts: now });
      return NextResponse.json({ text, source: 'emergent' });
    }
  }

  // ---- FALLBACK: direct Gemini -------------------------------
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (geminiKey) {
    const r = await callGemini(prompt, style, geminiKey);
    if (r.text) {
      usage.gemini_calls += 1;
      cache.set(cacheKey, { text: r.text, ts: now });
      return NextResponse.json({ text: r.text, source: 'gemini' });
    }
    if (r.status === 429) {
      return NextResponse.json({ error: 'UPSTREAM', status: 429 }, { status: 429 });
    }
  }

  return NextResponse.json({ error: 'NO_LLM' }, { status: 502 });
}
