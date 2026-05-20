import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// VYAN Netra — Universal Console Backend
// Zero-cost design: aggressive caching, no DB required, kill switches.
// ============================================================

const NETRA_CODE = process.env.VYAN_NETRA_CODE || '';
const KILL_SWITCH_USD = parseFloat(process.env.NETRA_KILL_SWITCH_USD || '1');
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN || '';
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';

// ---- In-memory caches (zero infra cost) -------------------
type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();
function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}
function setCached<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// ---- Active visitors (in-memory, 5-min TTL) ---------------
const visitors = new Map<string, number>(); // fingerprint -> lastSeen
function pruneVisitors() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [k, t] of visitors.entries()) if (t < cutoff) visitors.delete(k);
}

// ---- Usage counters (for cost estimation) -----------------
const usage = {
  gemini_calls: 0,
  pollinations_calls: 0,
  vercel_api_calls: 0,
  bootedAt: Date.now(),
};
// Expose increments via global so other routes (concierge) can bump it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__VYAN_USAGE__ = usage;

// ---- Cost estimation (Gemini 1.5 Flash ~ $0.075/M in, $0.30/M out)
// We just charge a flat $0.0002/call as ceiling estimate (very conservative).
function estimatedSpendUSD(): number {
  return usage.gemini_calls * 0.0002;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

async function pingPollinations(): Promise<{ ms: number; ok: boolean }> {
  const cached = getCached<{ ms: number; ok: boolean }>('pollinations_ping');
  if (cached) return cached;
  const start = Date.now();
  try {
    const r = await fetch('https://text.pollinations.ai/ping', { method: 'GET', signal: AbortSignal.timeout(4000) });
    const ms = Date.now() - start;
    const out = { ms, ok: r.ok };
    setCached('pollinations_ping', out, 60_000);
    return out;
  } catch {
    const out = { ms: Date.now() - start, ok: false };
    setCached('pollinations_ping', out, 60_000);
    return out;
  }
}

async function fetchVercelHealth() {
  const cached = getCached<unknown>('vercel_health');
  if (cached) return cached;

  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    // Mocked response when token not configured (zero cost).
    const mock = {
      mocked: true,
      project: 'vyan-cosmos',
      latestDeployment: {
        state: 'READY',
        createdAt: Date.now() - 1000 * 60 * 42,
        url: 'preview.vercel.app',
        target: 'production',
      },
      readyDeployments24h: 3,
      errorDeployments24h: 0,
    };
    setCached('vercel_health', mock, 5 * 60_000);
    return mock;
  }

  try {
    usage.vercel_api_calls += 1;
    const qs = new URLSearchParams({ projectId: VERCEL_PROJECT_ID, limit: '5' });
    if (VERCEL_TEAM_ID) qs.set('teamId', VERCEL_TEAM_ID);
    const r = await fetch(`https://api.vercel.com/v6/deployments?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) throw new Error(`vercel ${r.status}`);
    const data = (await r.json()) as { deployments?: Array<{ state?: string; created?: number; url?: string; target?: string }> };
    const deployments = data.deployments || [];
    const latest = deployments[0] || {};
    const since24 = Date.now() - 24 * 60 * 60 * 1000;
    const within24 = deployments.filter((d) => (d.created || 0) > since24);
    const result = {
      mocked: false,
      project: VERCEL_PROJECT_ID,
      latestDeployment: {
        state: latest.state || 'UNKNOWN',
        createdAt: latest.created || Date.now(),
        url: latest.url || '',
        target: latest.target || '',
      },
      readyDeployments24h: within24.filter((d) => d.state === 'READY').length,
      errorDeployments24h: within24.filter((d) => d.state === 'ERROR').length,
    };
    setCached('vercel_health', result, 5 * 60_000);
    return result;
  } catch (e) {
    const fail = { mocked: false, error: String(e), latestDeployment: { state: 'UNREACHABLE' } };
    setCached('vercel_health', fail, 60_000);
    return fail;
  }
}

// ---- POST: heartbeat / visitor ping (no auth needed) -----
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { fingerprint?: string; event?: string };
    if (body.fingerprint && body.event === 'ping') {
      visitors.set(body.fingerprint, Date.now());
      pruneVisitors();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// ---- GET: secured metrics dashboard -----------------------
export async function GET(req: NextRequest) {
  const code = req.headers.get('x-netra-code') || req.nextUrl.searchParams.get('code') || '';
  if (!NETRA_CODE) {
    return NextResponse.json({ ok: false, error: 'netra not configured' }, { status: 503 });
  }
  if (code !== NETRA_CODE) return unauthorized();

  // Kill switch — block paid endpoints if est. spend exceeds budget.
  const spend = estimatedSpendUSD();
  const killed = spend >= KILL_SWITCH_USD;

  pruneVisitors();
  const [vercel, pp] = await Promise.all([fetchVercelHealth(), pingPollinations()]);

  const uptimeMs = Date.now() - usage.bootedAt;
  return NextResponse.json({
    ok: true,
    timestamp: Date.now(),
    killSwitch: { tripped: killed, budgetUSD: KILL_SWITCH_USD, estimatedSpendUSD: spend },
    server: {
      uptimeMs,
      uptimeHuman: humanDuration(uptimeMs),
      env: process.env.NODE_ENV,
    },
    vercel,
    pollinations: pp,
    gemini: {
      calls: usage.gemini_calls,
      estimatedSpendUSD: spend,
      keyConfigured: !!process.env.GOOGLE_GEMINI_API_KEY,
    },
    visitors: {
      active: visitors.size,
      windowMinutes: 5,
    },
  });
}

function humanDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
