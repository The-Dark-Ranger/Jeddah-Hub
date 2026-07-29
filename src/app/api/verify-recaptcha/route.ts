import { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.RECAPTCHA_SECRET_KEY;

export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }
  if (!SECRET) {
    return NextResponse.json({ ok: true });
  }

  const body = new URLSearchParams({ secret: SECRET, response: token });
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data: { success: boolean; score?: number; 'error-codes'?: string[] } = await res.json();

  // For v3 keys a score of 0.0–1.0 is returned; require ≥ 0.5 to pass.
  // For v2 keys the score field is absent and success alone is sufficient.
  if (data.success && (data.score === undefined || data.score >= 0.5)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'reCAPTCHA verification failed' }, { status: 400 });
}
