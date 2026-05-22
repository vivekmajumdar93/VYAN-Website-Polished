import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, type Db } from 'mongodb';

// ============================================================
// /api/sankalpa
// Stores product-request submissions in MongoDB.
// SMTP / 3rd-party CRM linking is documented inline — wiring point is at
// the `sendNotificationEmail()` call below. Drop in your SMTP creds or
// connect to Resend / SendGrid / SES and the route stays the same.
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

export type SankalpaSubmission = {
  id: string;
  type: 'individual' | 'enterprise';
  name: string;
  email: string;
  company?: string;
  role?: string;
  phone?: string;
  productIntent: 'existing_as_is' | 'modify_combination' | 'fresh_other';
  productsOfInterest?: string[]; // when modify_combination
  usageRequirements: string;     // ALWAYS required
  desiredTimeline?: string;      // free-form; user requests, VYAN approves
  hearAboutUs?: string;
  status: 'received' | 'awaiting_approval' | 'approved' | 'declined';
  createdAt: number;
  // Hook points for backend integrations — populated by VYAN admin later:
  approvedBy?: string;
  approvedAt?: number;
  vyanDeliveryEstimate?: string;
  notes?: string;
};

function newId(): string { return `sk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`; }

// Notification hook — plug your SMTP/Resend/SendGrid client here.
async function sendNotificationEmail(_sub: SankalpaSubmission): Promise<void> {
  // Example wiring (pseudo):
  // await resend.emails.send({
  //   from: 'sankalpa@vyan.dev',
  //   to: [process.env.ADMIN_EMAIL!, _sub.email],
  //   subject: `Saṅkalpa received — ${_sub.name}`,
  //   html: renderSankalpaEmail(_sub),
  // });
  return;
}

function sanitize(s: unknown, maxLen = 2000): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, maxLen).replace(/<[^>]+>/g, '');
}
function looksLikeEmail(s: string): boolean { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = (body.type === 'enterprise') ? 'enterprise' : 'individual';
    const name = sanitize(body.name, 120);
    const email = sanitize(body.email, 240);
    const company = sanitize(body.company, 200);
    const role = sanitize(body.role, 120);
    const phone = sanitize(body.phone, 40);
    const productIntent = ['existing_as_is', 'modify_combination', 'fresh_other'].includes(body.productIntent)
      ? body.productIntent : 'fresh_other';
    const productsOfInterest: string[] = Array.isArray(body.productsOfInterest)
      ? body.productsOfInterest.map((p: unknown) => sanitize(p, 50)).slice(0, 10)
      : [];
    const usageRequirements = sanitize(body.usageRequirements, 4000);
    const desiredTimeline = sanitize(body.desiredTimeline, 200);
    const hearAboutUs = sanitize(body.hearAboutUs, 200);

    if (!name || !email) return NextResponse.json({ ok: false, error: 'name and email required' }, { status: 400 });
    if (!looksLikeEmail(email)) return NextResponse.json({ ok: false, error: 'invalid email' }, { status: 400 });
    if (!usageRequirements || usageRequirements.length < 12) {
      return NextResponse.json({ ok: false, error: 'please describe your usage requirements (≥12 characters)' }, { status: 400 });
    }
    if (type === 'enterprise' && !company) {
      return NextResponse.json({ ok: false, error: 'company is required for enterprise submissions' }, { status: 400 });
    }

    const sub: SankalpaSubmission = {
      id: newId(),
      type, name, email, company, role, phone,
      productIntent, productsOfInterest, usageRequirements, desiredTimeline, hearAboutUs,
      status: 'received',
      createdAt: Date.now(),
    };

    const db = await getDb();
    if (db) {
      await db.collection('sankalpa_submissions').insertOne(sub);
    } else {
      console.warn('[sankalpa] MONGO_URL not configured — submission accepted but NOT persisted.');
    }
    await sendNotificationEmail(sub);

    return NextResponse.json({
      ok: true,
      id: sub.id,
      message: 'Saṅkalpa received. VYAN will review your intent and respond with a delivery commitment.',
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'submission failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'sankalpa', accepts: 'POST' });
}
