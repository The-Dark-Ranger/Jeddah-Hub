/* POST /api/media (signed-in members): stores one compressed photo for an
 * initiative, activity or proposal and returns the URL that serves it
 * (/api/media/<id>, see [id]/route.ts). Browsers can't write photos to the
 * database directly (firestore.rules), so every upload passes here: only a
 * real JPEG under 1 MB is kept, and each member has a daily limit, so one
 * misused account can't fill the database's storage. */
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/serverAuth';
import { readJsonBody } from '@/lib/http';
import { isRateLimited } from '@/lib/rateLimit';
import { withinLimit, DAY } from '@/lib/persistentLimit';
import { adminApp } from '@/lib/firebaseAdmin';
import { MEMBER_ROLES } from '@/lib/memberAccounts';

/** The photo as a data URI, kept below Firestore's 1 MiB document limit. */
const MAX_CHARS = 1_000_000;
const JPEG_URI = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/;

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, [...MEMBER_ROLES]);
  if (!caller) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (isRateLimited(`media-upload:${caller.uid}`, 20, 60_000)) {
    return NextResponse.json({ error: 'too_many' }, { status: 429 });
  }

  const body = await readJsonBody(req, MAX_CHARS + 1024);
  const data = typeof body?.data === 'string' && body.data.length <= MAX_CHARS ? body.data : '';
  const base64 = JPEG_URI.exec(data)?.[1];
  // A real JPEG starts with the bytes FF D8 FF, whatever the label says.
  const head = base64 ? Buffer.from(base64.slice(0, 8), 'base64') : null;
  if (!head || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  if (!(await withinLimit(`media-upload:${caller.uid}`, 100, DAY))) {
    return NextResponse.json({ error: 'too_many' }, { status: 429 });
  }

  const app = adminApp();
  if (!app) return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  const ref = await getFirestore(app).collection('media').add({
    data, contentType: 'image/jpeg', uploadedBy: caller.uid, createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ url: `/api/media/${ref.id}` });
}
