import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { readJsonBody } from '@/lib/http';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isBlockedBot } from '@/lib/botCheck';
import { isCrossSite } from '@/lib/formGuard';

const SECRET = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
  // Gates login and contact submissions; a real person needs a handful of
  // tries a minute at most.
  if (isRateLimited(`verify-recaptcha:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }
  if (await isBlockedBot('verify-recaptcha')) {
    return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
  }

  const body = await readJsonBody(req);
  const token = body?.token;
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }
  if (!SECRET) {
    console.warn('[verify-recaptcha] RECAPTCHA_SECRET_KEY not configured, rejecting request');
    return NextResponse.json({ ok: false, error: 'reCAPTCHA not configured' }, { status: 503 });
  }

  // The token must have been issued for the form that's asking.
  const action = body?.action === 'login' || body?.action === 'contact' ? body.action : null;
  if (!action) return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  const passed = await verifyRecaptchaToken(token, { action });
  if (passed) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, error: 'reCAPTCHA verification failed' }, { status: 400 });
}
