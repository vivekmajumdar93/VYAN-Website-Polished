import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, type Db } from 'mongodb';

// ============================================================
// /api/register — anonymous-to-known visitor registration.
// Unlocks unlimited Medhā conversations + product depth.
// Backend wiring points:
//   • Mongo collection: `vyan_users`
//   • SMTP / OTP verification: stub at `sendVerifyEmail()`
//   • Pluggable into any auth provider (Clerk, Auth0, Supabase) by
//     swapping the storage layer — the route signature is stable.
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

function sanitize(s: unknown, maxLen = 240): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen).replace(/<[^>]+>/g, '');
}
function looksLikeEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

async function sendVerifyEmail(_to: string, _token: string): Promise<void> {
  // Wire your transactional email here (Resend / SendGrid / SES / SMTP).
  return;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = sanitize(body.name, 120);
    const email = sanitize(body.email, 240);
    const intent = sanitize(body.intent, 60);
    if (!email || !looksLikeEmail(email)) return NextResponse.json({ ok: false, error: 'valid email required' }, { status: 400 });

    const db = await getDb();
    const verifyToken = Math.random().toString(36).slice(2, 10).toUpperCase();
    if (db) {
      await db.collection('vyan_users').updateOne(
        { email },
        {
          $setOnInsert: { email, createdAt: Date.now() },
          $set: { name: name || undefined, lastIntent: intent || undefined, verifyToken },
        },
        { upsert: true },
      );
    } else {
      console.warn('[register] MONGO_URL not configured — registration accepted but NOT persisted.');
    }
    await sendVerifyEmail(email, verifyToken);

    return NextResponse.json({
      ok: true,
      // Returning the user object so the client can store it locally and
      // unlock the full experience right away. Verification happens out-of-band.
      user: { email, name, registeredAt: Date.now(), verified: false },
      message: 'Registered with VYAN. Full access unlocked. A verification email follows.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'registration failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'register', accepts: 'POST' });
}
