// Server-side Gemini proxy for the Concierge Orb.
// Keeps the API key off the client and adds rate-limit / fallback handling.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.0-flash';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_KEY_MISSING' }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 });
  }

  const prompt: string = (body?.prompt ?? '').toString().slice(0, 1400);
  const style: string = (body?.style ?? '').toString().slice(0, 280);
  if (!prompt) return NextResponse.json({ error: 'EMPTY_PROMPT' }, { status: 400 });

  // ---- Kill switch & usage tracking (read by /api/netra) ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage: any = (globalThis as any).__VYAN_USAGE__ || ((globalThis as any).__VYAN_USAGE__ = {
    gemini_calls: 0, pollinations_calls: 0, vercel_api_calls: 0, bootedAt: Date.now(),
  });
  const killBudget = parseFloat(process.env.NETRA_KILL_SWITCH_USD || '1');
  const estimatedSpend = usage.gemini_calls * 0.0002;
  if (estimatedSpend >= killBudget) {
    return NextResponse.json(
      { error: 'KILL_SWITCH', message: 'Daily budget exceeded. Console disarmed via VYAN Netra.' },
      { status: 503 },
    );
  }

  const url = `${BASE}/${MODEL}:generateContent?key=${apiKey}`;
  const payload = {
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
    if (!res.ok) {
      return NextResponse.json(
        { error: 'UPSTREAM', status: res.status },
        { status: res.status === 429 ? 429 : 502 },
      );
    }
    usage.gemini_calls += 1;
    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: 'NETWORK', message: e?.message }, { status: 502 });
  }
}
