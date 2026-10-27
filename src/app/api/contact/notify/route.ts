/* POST /api/contact/notify: after the contact form saves a message, emails
 *  1. the hub inbox a copy (replying answers the visitor), and
 *  2. the visitor a receipt with a copy of what they sent, in the language
 *     of the site they wrote from.
 * Protected by reCAPTCHA and rate limits; the receipt is also limited per
 * address, so the form can't be used to flood someone else's inbox. */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody, asString } from '@/lib/http';
import { sendEmail } from '@/lib/email';
import { hubNotification, senderCopy, isTopic, type ContactMessage } from '@/lib/emails/contact';

export async function POST(req: NextRequest) {
  if (isRateLimited(`contact-notify:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await readJsonBody(req, 24 * 1024);
  // Same limits as firestore.rules on contact_messages.
  const name    = asString(body?.name, 200);
  const email   = asString(body?.email, 200);
  const message = asString(body?.message, 5000);
  if (!name || !email || !message || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }
  const rawRef = asString(body?.ref, 40);

  // Fail closed: no verified token, no email.
  const passed = await verifyRecaptchaToken(body?.recaptchaToken, { action: 'contact_notify' });
  if (!passed) return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });

  const msg: ContactMessage = {
    name, email, message,
    topic: isTopic(body?.subject) ? body.subject : 'other',
    lang: body?.locale === 'ar' ? 'ar' : 'en',
    ref: rawRef && /^[A-Za-z0-9]{10,40}$/.test(rawRef) ? rawRef : undefined,
    at: new Date(),
  };

  const hub = await sendEmail(hubNotification(msg));
  if (!hub.ok && 'skipped' in hub && hub.skipped) return NextResponse.json({ ok: true, skipped: hub.error });

  // The visitor's receipt: only to a real mailbox, a few per address an hour.
  let copy: 'sent' | 'skipped' | 'failed' = 'skipped';
  if (!isRateLimited(`contact-copy:${email.toLowerCase()}`, 3, 60 * 60_000)
      && await hasDeliverableDomainWithTimeout(email)) {
    copy = (await sendEmail(senderCopy(msg))).ok ? 'sent' : 'failed';
  }

  if (!hub.ok) return NextResponse.json({ error: 'Failed to send email', copy }, { status: 502 });
  return NextResponse.json({ ok: true, copy });
}
