/* POST /api/contact/notify: emails the hub inbox a copy of a contact-form
 * message (the message itself is already saved in Firestore by the form).
 * Replying to the email replies to the visitor. It only ever sends to the
 * hub's own inbox, so it can't be used to email strangers. */
import { NextRequest, NextResponse } from 'next/server';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { readJsonBody, asString } from '@/lib/http';
import { escapeHtml } from '@/lib/escapeHtml';
import { sendEmail, emailLayout, CONTACT_INBOX } from '@/lib/email';

const SUBJECTS: Record<string, string> = {
  general: 'General Inquiry', partnership: 'Partnership', join: 'Joining the Hub',
  media: 'Media & Press', other: 'Other',
};

export async function POST(req: NextRequest) {
  if (isRateLimited(`contact-notify:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await readJsonBody(req, 24 * 1024);
  // Same limits as firestore.rules on contact_messages.
  const name    = asString(body?.name, 200);
  const email   = asString(body?.email, 200);
  const message = asString(body?.message, 5000);
  const topic   = SUBJECTS[String(body?.subject ?? '')] ?? 'Other';
  if (!name || !email || !message || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  // Fail closed, like the newsletter route: no verified token, no email.
  const passed = await verifyRecaptchaToken(body?.recaptchaToken, { action: 'contact_notify' });
  if (!passed) return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;width:90px;font-size:13px;color:#64748b;vertical-align:top;">${label}</td>` +
    `<td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${value}</td></tr>`;

  const html = emailLayout({
    lang: 'en',
    title: 'New contact message',
    footer: 'Sent from the contact form on jeddahhub.org. Reply to this email to answer the sender directly.',
    body: `
      <h2 style="margin:0 0 18px;font-size:21px;font-weight:700;color:#0f172a;">New message: ${escapeHtml(topic)}</h2>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        ${row('From', escapeHtml(name))}
        ${row('Email', `<a href="mailto:${escapeHtml(email)}" style="color:#0f5a9f;">${escapeHtml(email)}</a>`)}
        ${row('Topic', escapeHtml(topic))}
      </table>
      <div style="padding:18px 20px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:15px;line-height:1.7;color:#334155;white-space:pre-wrap;" dir="auto">${escapeHtml(message)}</div>`,
  });

  const result = await sendEmail({
    to: CONTACT_INBOX,
    replyTo: email,
    subject: `[Jeddah Hub] ${topic}: ${name}`,
    html,
    text: `New contact message (${topic})\nFrom: ${name} <${email}>\n\n${message}`,
  });
  if (!result.ok) {
    return 'skipped' in result && result.skipped
      ? NextResponse.json({ ok: true, skipped: result.error })
      : NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
