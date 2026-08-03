import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';

const SECRET = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }
  if (!SECRET) {
    console.warn('[verify-recaptcha] RECAPTCHA_SECRET_KEY not configured — rejecting request');
    return NextResponse.json({ ok: false, error: 'reCAPTCHA not configured' }, { status: 503 });
  }

  const passed = await verifyRecaptchaToken(token);
  if (passed) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, error: 'reCAPTCHA verification failed' }, { status: 400 });
}
