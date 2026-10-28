import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { readJsonBody } from '@/lib/http';

export async function POST(req: NextRequest) {
  // A pre-flight check for the contact form and curator invites, so the
  // limit is generous; this route never sends or writes anything itself.
  if (isRateLimited(`validate-email:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 429 });
  }

  const body = await readJsonBody(req);
  const email = body?.email;
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ ok: false, reason: 'invalid-format' }, { status: 400 });
  }

  const deliverable = await hasDeliverableDomainWithTimeout(email);
  if (!deliverable) {
    return NextResponse.json({ ok: false, reason: 'no-mx' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
