import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody } from '@/lib/http';
import { sendEmail } from '@/lib/email';
import { newsletterWelcome } from '@/lib/emails/newsletter';

/* POST /api/newsletter/welcome: sends a new subscriber the welcome email
 * (src/lib/emails/newsletter.ts) in the language they subscribed from. */

export async function POST(req: NextRequest) {
  // This route sends a real outbound email per request, a token-farmed or
  // replayed recaptcha pass shouldn't translate into unbounded email volume
  // to arbitrary addresses. Best-effort, single-instance limiter, see
  // src/lib/rateLimit.ts for its limits.
  if (isRateLimited(`newsletter-welcome:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await readJsonBody(req);
  const email = body?.email;
  const recaptchaToken = body?.recaptchaToken;
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  // Defense in depth: the client is expected to pre-check via
  // /api/validate-email before ever reaching this route, but that's a
  // client-side gate a direct call can skip, so check again here, right
  // before actually sending anything.
  if (!(await hasDeliverableDomainWithTimeout(email))) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Fail closed (matches /api/verify-recaptcha): a misconfigured/missing
  // secret must reject the request, not silently skip verification, this
  // is a public, unauthenticated route with no other abuse control, so a
  // skipped check would turn it into an open relay for arbitrary email.
  if (!process.env.RECAPTCHA_SECRET_KEY) {
    console.warn('[newsletter/welcome] RECAPTCHA_SECRET_KEY not configured, rejecting request');
    return NextResponse.json({ error: 'reCAPTCHA not configured' }, { status: 503 });
  }
  const passed = await verifyRecaptchaToken(recaptchaToken, { action: 'newsletter_subscribe' });
  if (!passed) return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });

  const lang = body?.locale === 'ar' ? 'ar' : 'en';
  // One welcome per address an hour, however many times it is resubmitted.
  if (isRateLimited(`newsletter-welcome-to:${email.toLowerCase()}`, 1, 60 * 60_000)) {
    return NextResponse.json({ ok: true, skipped: 'Recently welcomed' });
  }
  const result = await sendEmail(newsletterWelcome(lang, email));
  if (!result.ok) {
    return 'skipped' in result && result.skipped
      ? NextResponse.json({ ok: true, skipped: result.error })
      : NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
