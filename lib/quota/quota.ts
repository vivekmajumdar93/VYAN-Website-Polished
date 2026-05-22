// Lightweight quota tracking for unauthenticated VYAN visitors.
// Backend-ready: API endpoints `/api/quota/check` and `/api/register` are
// stubbed below — swap the in-memory map for a Mongo collection when ready.

export type QuotaScope = 'medha' | 'sankalpa' | 'product';

const LIMITS: Record<QuotaScope, number> = {
  medha: 15,      // 15 conversations before registration required
  sankalpa: 1,    // 1 anonymous submission, then register
  product: 5,     // 5 anonymous product slab opens
};

const KEY_USAGE = 'vyan.quota.usage';
const KEY_USER = 'vyan.user';

export type LocalUser = {
  email: string;
  name: string;
  registeredAt: number;
  verified?: boolean;
};

type UsageMap = Partial<Record<QuotaScope, number>>;

function readUsage(): UsageMap {
  try { return JSON.parse(localStorage.getItem(KEY_USAGE) || '{}'); } catch { return {}; }
}
function writeUsage(u: UsageMap) {
  try { localStorage.setItem(KEY_USAGE, JSON.stringify(u)); } catch {}
}

export function getUser(): LocalUser | null {
  try { const raw = localStorage.getItem(KEY_USER); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function setUser(u: LocalUser | null) {
  try { if (u) localStorage.setItem(KEY_USER, JSON.stringify(u)); else localStorage.removeItem(KEY_USER); } catch {}
}

export function quotaRemaining(scope: QuotaScope): number {
  if (getUser()) return Infinity; // registered users have full access (gated server-side later)
  const used = readUsage()[scope] ?? 0;
  return Math.max(0, LIMITS[scope] - used);
}

export function quotaUsed(scope: QuotaScope): number {
  return readUsage()[scope] ?? 0;
}

export function quotaLimit(scope: QuotaScope): number {
  return LIMITS[scope];
}

export function incrementQuota(scope: QuotaScope): { ok: boolean; remaining: number } {
  if (getUser()) return { ok: true, remaining: Infinity };
  const u = readUsage();
  const used = u[scope] ?? 0;
  if (used >= LIMITS[scope]) return { ok: false, remaining: 0 };
  u[scope] = used + 1;
  writeUsage(u);
  return { ok: true, remaining: LIMITS[scope] - u[scope]! };
}

export function resetQuota(scope?: QuotaScope) {
  if (!scope) { writeUsage({}); return; }
  const u = readUsage();
  delete u[scope];
  writeUsage(u);
}
