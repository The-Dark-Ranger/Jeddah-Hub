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
  const data: { success: boolean; 'error-codes'?: string[] } = await res.json();

  if (data.success) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: 'reCAPTCHA verification failed' }, { status: 400 });
}
