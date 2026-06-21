// Server-side LLM proxy for Medhā chat.
// Priority: Gemini Direct → Emergent → Pollinations (last resort, free, no key).
// The Gemini key is server-side only — never exposed to the client.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 45; // Vercel function max — give Pollinations time

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function callGeminiDirect(messages: Msg[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const sys = messages.find(m => m.role === 'system')?.content ?? '';
    const turns = messages.filter(m => m.role !== 'system');

    // Use Gemini's native multi-turn format for best quality
    const body: Record<string, unknown> = {
      contents: turns.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 700, temperature: 0.85 },
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };

    const res = await withTimeout(
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      ),
      9000,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || null;
  } catch {
    return null;
  }
}

async function callEmergent(messages: Msg[]): Promise<string | null> {
  const key = process.env.EMERGENT_LLM_KEY;
  if (!key) return null;
  const base = process.env.EMERGENT_LLM_PROXY_URL || 'https://integrations.emergentagent.com/llm/v1/chat/completions';
  try {
    const res = await withTimeout(
      fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gemini/gemini-2.0-flash', messages, max_tokens: 600, temperature: 0.9 }),
      }),
      9000,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.toString?.()?.trim?.() || null;
  } catch {
    return null;
  }
}

async function callPollinations(messages: Msg[]): Promise<string | null> {
  // Uses Pollinations' OpenAI-compatible POST endpoint — free, no key, full history
  try {
    const res = await withTimeout(
      fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: 700,
          temperature: 0.85,
          seed: Math.floor(Math.random() * 1e9),
        }),
      }),
      18000,
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim?.() ?? null;
    if (!text || text.includes('"error"')) return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 }); }

  const systemPrompt: string = (body?.system ?? '').toString().slice(0, 1800);
  const history: any[] = Array.isArray(body?.history) ? body.history : [];

  const messages: Msg[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const h of history.slice(-14)) {
    if (!h?.role || !h?.content) continue;
    messages.push({ role: h.role, content: String(h.content).slice(0, 2400) });
  }
  if (!messages.some(m => m.role === 'user')) {
    return NextResponse.json({ error: 'NO_USER_MESSAGE' }, { status: 400 });
  }

  // Primary: Gemini Direct (fast, free key available)
  const geminiText = await callGeminiDirect(messages);
  if (geminiText) return NextResponse.json({ text: geminiText, source: 'gemini' });

  // Fallback 1: Emergent proxy
  const emergentText = await callEmergent(messages);
  if (emergentText) return NextResponse.json({ text: emergentText, source: 'emergent' });

  // Fallback 2: Pollinations (slow, public)
  const text = await callPollinations(messages);
  if (text) return NextResponse.json({ text, source: 'pollinations' });

  return NextResponse.json({ error: 'NO_LLM' }, { status: 502 });
}
