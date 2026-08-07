import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { isRateLimited, clientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  // Called from three separate public-facing forms (newsletter, contact,
  // curator invite) as a pre-flight check, so the limit is generous
  // relative to /api/newsletter/welcome's — this route never sends
  // anything or writes anything itself.
  if (isRateLimited(`validate-email:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 429 });
  }

  const { email } = await req.json();
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, reason: 'invalid-format' }, { status: 400 });
  }

  const deliverable = await hasDeliverableDomainWithTimeout(email);
  if (!deliverable) {
    return NextResponse.json({ ok: false, reason: 'no-mx' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
