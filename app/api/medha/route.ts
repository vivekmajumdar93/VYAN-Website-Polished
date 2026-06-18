// Server-side LLM proxy for Medhā chat.
// Uses Emergent Universal LLM key (free tier) with gemini-2.0-flash.
// Falls back to direct Gemini, then Pollinations.ai if all else fails.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EMERGENT_BASE = process.env.EMERGENT_LLM_PROXY_URL
  || 'https://integrations.emergentagent.com/llm/v1/chat/completions';
const EMERGENT_MODEL = 'gemini/gemini-2.0-flash';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

async function callEmergent(messages: Msg[], key: string): Promise<string | null> {
  try {
    const res = await fetch(EMERGENT_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: EMERGENT_MODEL,
        messages,
        max_tokens: 600,
        temperature: 0.9,
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content?.toString?.()?.trim?.() || null;
  } catch {
    return null;
  }
}

async function callGeminiDirect(messages: Msg[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const sys = messages.find(m => m.role === 'system')?.content ?? '';
    const turns = messages.filter(m => m.role !== 'system');
    const fullPrompt = (sys ? sys + '\n\n' : '') + turns.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
      }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || null;
  } catch {
    return null;
  }
}

async function callPollinations(messages: Msg[]): Promise<string | null> {
  try {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    if (!lastUser) return null;
    const sys = messages.find(m => m.role === 'system')?.content || '';
    const params = new URLSearchParams({
      model: 'openai',
      system: sys.slice(0, 300),
      seed: String(Math.floor(Math.random() * 1e9)),
    });
    const url = `https://text.pollinations.ai/${encodeURIComponent(lastUser.slice(0, 1200))}?${params.toString()}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok || !text || text.includes('"error"')) return null;
    return text.trim();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 }); }

  const systemPrompt: string = (body?.system ?? '').toString().slice(0, 1200);
  const history: any[] = Array.isArray(body?.history) ? body.history : [];

  const messages: Msg[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const h of history.slice(-12)) {
    if (!h?.role || !h?.content) continue;
    messages.push({ role: h.role, content: String(h.content).slice(0, 2400) });
  }
  if (!messages.some(m => m.role === 'user')) {
    return NextResponse.json({ error: 'NO_USER_MESSAGE' }, { status: 400 });
  }

  // Primary: Emergent.
  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (emergentKey) {
    const text = await callEmergent(messages, emergentKey);
    if (text) return NextResponse.json({ text, source: 'emergent' });
  }

  // Fallback 1: Gemini direct.
  const geminiText = await callGeminiDirect(messages);
  if (geminiText) return NextResponse.json({ text: geminiText, source: 'gemini' });

  // Fallback 2: Pollinations.
  const text = await callPollinations(messages);
  if (text) return NextResponse.json({ text, source: 'pollinations' });

  return NextResponse.json({ error: 'NO_LLM' }, { status: 502 });
}
