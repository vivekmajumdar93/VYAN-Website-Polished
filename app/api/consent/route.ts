import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, type Db } from 'mongodb';

// ============================================================
// /api/consent — Medhā chat-storage consent.
// Dedupes by email so the user is asked ONLY ONCE per identity,
// regardless of which device they visit on.
// ============================================================

const MONGO_URL = process.env.MONGO_URL || '';
const DB_NAME = process.env.DB_NAME || 'vyan';
let cachedClient: MongoClient | null = null;
async function getDb(): Promise<Db | null> {
  if (!MONGO_URL) return null;
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME);
}

function sanitize(s: unknown, max = 240): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max).replace(/<[^>]+>/g, '');
}
function emailLike(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function newId(): string { return `cnst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`; }

// GET /api/consent?email=... — returns { exists: true } if the email has already consented.
export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') || '').toLowerCase().trim();
  if (!emailLike(email)) return NextResponse.json({ ok: false, exists: false, error: 'invalid email' }, { status: 400 });
  try {
    const db = await getDb();
    if (!db) return NextResponse.json({ ok: true, exists: false, mocked: true });
    const found = await db.collection('medha_consent').findOne({ email });
    return NextResponse.json({ ok: true, exists: !!found, consentedAt: found?.consentedAt ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, exists: false, error: e?.message || 'lookup failed' }, { status: 500 });
  }
}

// POST /api/consent — store consent. Upserts by email so duplicates are
// silently refined into a single canonical row.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = sanitize(body.name, 120);
    const email = sanitize(body.email, 240).toLowerCase();
    const phone = sanitize(body.phone, 40);
    const purpose = sanitize(body.purpose, 1000);
    const consent = body.consent === true;
    if (!name || !emailLike(email)) return NextResponse.json({ ok: false, error: 'name and valid email required' }, { status: 400 });
    if (!consent) return NextResponse.json({ ok: false, error: 'consent flag missing' }, { status: 400 });
    if (!purpose) return NextResponse.json({ ok: false, error: 'purpose required' }, { status: 400 });
    const ua = req.headers.get('user-agent') || '';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const now = Date.now();
    const db = await getDb();
    if (!db) {
      // MOCK MODE — no DB configured. We still return success so the UI flow works.
      return NextResponse.json({ ok: true, id: newId(), persisted: false, mocked: true });
    }
    const existing = await db.collection('medha_consent').findOne({ email });
    if (existing) {
      await db.collection('medha_consent').updateOne(
        { email },
        { $set: { name, phone, purpose, lastSeenAt: now, ua, ip } }
      );
      return NextResponse.json({ ok: true, id: existing.id, persisted: true, deduped: true, consentedAt: existing.consentedAt });
    }
    const id = newId();
    await db.collection('medha_consent').insertOne({
      id, name, email, phone, purpose, consentedAt: now, lastSeenAt: now, ua, ip,
    });
    return NextResponse.json({ ok: true, id, persisted: true, deduped: false, consentedAt: now });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'consent save failed' }, { status: 500 });
  }
}
