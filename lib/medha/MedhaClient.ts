// MedhaClient — Pollinations.ai free anonymous text endpoint.
// Anonymous GET on text.pollinations.ai is documented as free, no-auth, unlimited.
// The /openai POST variant on gen.* now requires auth (deprecation in Nov 2025),
// so we use the simple GET prompt format for guaranteed free access.

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

function buildPromptFromHistory(mode: CognitiveMode, history: ChatMessage[]): string {
  // Inline-format the conversation so it works through a single GET prompt.
  // This preserves the mode's system tone + multi-turn context.
  const lines: string[] = [];
  lines.push(`[System]: ${mode.systemPrompt}`);
  for (const m of history) {
    if (m.role === 'user') lines.push(`[User]: ${m.content}`);
    else if (m.role === 'assistant') lines.push(`[Assistant]: ${m.content}`);
  }
  // Cue the model for the next assistant turn.
  lines.push('[Assistant]:');
  return lines.join('\n\n');
}

/**
 * Anonymous one-shot completion via Pollinations GET endpoint.
 * Returns the model's generated text. Free, no key, no signup.
 */
export async function chatComplete(
  mode: CognitiveMode,
  history: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const prompt = buildPromptFromHistory(mode, history);
  const params = new URLSearchParams({
    model: mode.pollinationsModel,
    seed: String(Math.floor(Math.random() * 1e9)),
    private: 'true',
  });
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?${params.toString()}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);
  const text = await res.text();
  return text.trim();
}

/**
 * Streaming chat. Pollinations GET returns the full body — we simulate
 * the cinematic letter-by-letter reveal locally for that "thinking" feel.
 * If the response is short, this gives a satisfying ribbon-unfurl effect.
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
      cb.onError(new Error('Empty response from cognition'));
      return;
    }
    // Cinematic reveal — chunks of 4–8 chars at a time, ~12–20ms per chunk.
    // Total reveal time scales with response length but caps to feel snappy.
    const totalChunks = Math.max(20, Math.min(120, Math.floor(full.length / 5)));
    const chunkSize = Math.max(1, Math.ceil(full.length / totalChunks));
    const delayMs = Math.max(8, Math.min(24, 1800 / totalChunks));

    for (let i = 0; i < full.length; i += chunkSize) {
      if (signal?.aborted) return;
      cb.onChunk(full.slice(i, i + chunkSize));
      await new Promise((r) => setTimeout(r, delayMs));
    }
    cb.onDone(full);
  } catch (e: any) {
    cb.onError(e instanceof Error ? e : new Error(String(e)));
  }
}
