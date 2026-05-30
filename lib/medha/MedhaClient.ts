// MedhaClient — Pollinations.ai anonymous text endpoint.
// GET-only (POST is currently failing with ENOSPC on the free tier).
// Uses ?system=... query param for mode tuning; inlines prior turns into the prompt.

import { CognitiveMode } from './cognitive';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StreamCallbacks = {
  onChunk: (text: string) => void;
  onDone: (full: string) => void;
  onError: (err: Error) => void;
};

const POLLINATIONS_BASE = 'https://text.pollinations.ai';
const MAX_PROMPT_CHARS = 1200;        // keep total URL well under server limits
const MAX_SYSTEM_CHARS = 320;          // very short to avoid bloat

function trim(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

function buildUserPrompt(history: ChatMessage[]): string {
  // The LAST user message is the actual prompt; prior turns become brief context.
  const turns = history.filter(m => m.role !== 'system');
  if (turns.length === 0) return '';
  const lastUser = [...turns].reverse().find(m => m.role === 'user');
  if (!lastUser) return '';

  // Build short context summary from prior assistant/user pairs (skip the last user).
  const prior = turns.slice(0, turns.length - 1);
  let context = '';
  for (const m of prior) {
    const tag = m.role === 'user' ? 'U' : 'A';
    context += `(${tag}: ${trim(m.content, 240)}) `;
  }
  context = context.trim();

  let prompt = lastUser.content.trim();
  if (context) {
    prompt = `${context}\n\nNow respond to: ${prompt}`;
  }
  return trim(prompt, MAX_PROMPT_CHARS);
}

function isPollinationsError(text: string): boolean {
  if (!text) return true;
  const t = text.trim();
  if (t.length === 0) return true;
  // Server-side error responses come back as JSON envelopes.
  if (t.startsWith('{') && t.includes('"error"') && t.includes('"status"')) return true;
  if (t.includes('IMPORTANT NOTICE') && t.includes('deprecated')) return true;
  return false;
}

async function fetchMedhaApi(
  mode: CognitiveMode,
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  // Call our /api/medha proxy (Emergent LLM \u2192 Pollinations fallback).
  const res = await fetch('/api/medha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      system: trim(mode.systemPrompt, MAX_SYSTEM_CHARS),
      history,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.text) throw new Error(data?.error || 'medha-api-error');
  return String(data.text).trim();
}

async function fetchPollinations(
  mode: CognitiveMode,
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const userPrompt = buildUserPrompt(history);
  if (!userPrompt) throw new Error('Empty prompt');

  const params = new URLSearchParams({
    model: mode.pollinationsModel,
    system: trim(mode.systemPrompt, MAX_SYSTEM_CHARS),
    seed: String(Math.floor(Math.random() * 1e9)),
  });

  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(userPrompt)}?${params.toString()}`;
  const res = await fetch(url, { signal });
  const text = await res.text();
  if (!res.ok || isPollinationsError(text)) {
    throw new Error('Pollinations transient error');
  }
  return text.trim();
}

/** One-shot completion with single retry on transient failure.
 *  Primary: /api/medha (Emergent LLM). Fallback: direct Pollinations. */
export async function chatComplete(
  mode: CognitiveMode,
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  // Primary path \u2014 our server proxy that uses Emergent universal LLM key.
  try {
    return await fetchMedhaApi(mode, history, signal);
  } catch (_) {
    // Fallback to direct Pollinations (slow / occasionally errors).
    try {
      return await fetchPollinations(mode, history, signal);
    } catch (__) {
      await new Promise(r => setTimeout(r, 1800));
      if (signal?.aborted) throw new Error('aborted');
      return await fetchPollinations(mode, history, signal);
    }
  }
}

/**
 * Cinematic streaming reveal. Pollinations GET is non-streaming, so we
 * fetch the full response then unfurl it locally for the loom effect.
 */
export async function chatStream(
  mode: CognitiveMode,
  history: ChatMessage[],
  cb: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const full = await chatComplete(mode, history, signal);
    if (!full || full.length === 0) {
      cb.onError(new Error('Cognition returned no signal — try again in a moment.'));
      return;
    }
    // Letter-by-letter reveal — speed scales with length, capped to feel snappy.
    const totalChunks = Math.max(24, Math.min(160, Math.floor(full.length / 4)));
    const chunkSize = Math.max(1, Math.ceil(full.length / totalChunks));
    const delayMs = Math.max(8, Math.min(22, 1600 / totalChunks));
    for (let i = 0; i < full.length; i += chunkSize) {
      if (signal?.aborted) return;
      cb.onChunk(full.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, delayMs));
    }
    cb.onDone(full);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === 'aborted') return;
    cb.onError(
      new Error(
        'Cognition is busy on the free Pollinations channel right now. ' +
        'Wait a few seconds and try again, or switch to another cognitive mode.',
      ),
    );
  }
}
