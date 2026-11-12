/* /api/newsletter/unsubscribe: takes an address off the newsletter list.
 *
 * POST does it, from two places: the button on /{locale}/unsubscribe (the
 * link in the welcome email, sending JSON), and mail apps' own Unsubscribe
 * button (RFC 8058 one-click: a form POST with the id and token in this
 * address). GET only forwards to that page: link scanners open every link
 * in an email, and must not unsubscribe anyone by doing so.
 *
 * `id` is the subscription's document id and `t` the random token stored
 * with it when they subscribed, so only someone with the email can use it.
 * A wrong token and an address already off the list get the same answer,
 * so this can't be used to find out who is subscribed. */
import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { readJsonBody } from '@/lib/http';
import { isRateLimited, clientIp } from '@/lib/rateLimit';

const ID_RE = /^[a-f0-9]{64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

const sameToken = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lang = q.get('l') === 'ar' ? 'ar' : 'en';
  const page = new URL(`/${lang}/unsubscribe`, req.nextUrl.origin);
  for (const k of ['id', 't']) { const v = q.get(k); if (v) page.searchParams.set(k, v); }
  return NextResponse.redirect(page, 303);
}

export async function POST(req: NextRequest) {
  if (isRateLimited(`unsubscribe:${clientIp(req)}`, 20, 10 * 60_000)) return json({ error: 'too_many' }, 429);
  const q = req.nextUrl.searchParams;
  const body = req.headers.get('content-type')?.includes('application/json') ? await readJsonBody(req) : null;
  const id = String(body?.id ?? q.get('id') ?? '');
  const token = String(body?.t ?? q.get('t') ?? '');
  if (!ID_RE.test(id) || !TOKEN_RE.test(token)) return json({ error: 'not_found' }, 404);

  const app = adminApp();
  if (!app) return json({ error: 'unavailable' }, 503);
  try {
    const ref = getFirestore(app).collection('newsletter_subscribers').doc(id);
    const snap = await ref.get();
    const stored = snap.exists ? snap.get('unsubToken') : null;
    if (typeof stored !== 'string' || !sameToken(stored, token)) return json({ error: 'not_found' }, 404);
    await ref.delete();
    return json({ ok: true });
  } catch (err) {
    console.error('[unsubscribe] failed', err);
    return json({ error: 'unavailable' }, 503);
  }
}
