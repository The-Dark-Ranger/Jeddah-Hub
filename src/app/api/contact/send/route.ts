/* POST /api/contact/send: the only way to send a contact-form message.
 *
 * Browsers can't write to contact_messages directly (firestore.rules), so
 * every message passes the checks here before anything is saved or sent:
 *   rate limits → honeypot / fill-time trap → field and spam checks →
 *   reCAPTCHA → real mail domain → duplicate check.
 * Then the message is saved for Dashboard → Messages, the hub inbox gets a
 * copy and the visitor a receipt in their language (src/lib/emails/contact.ts).
 * Emails only ever go to the hub inbox and to the sender's own address. */
import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody } from '@/lib/http';
import { json, isBotSubmission } from '@/lib/formGuard';
import { isBlockedBot } from '@/lib/botCheck';
import { withinLimit, withinEmailBudget, DAY, HOUR } from '@/lib/persistentLimit';
import { sendEmail } from '@/lib/email';
import { hubNotification, senderCopy, isTopic, type ContactMessage } from '@/lib/emails/contact';

/** A person needs at least this long to fill in name, email, topic and a message. */
const MIN_FILL_MS = 4000;
/** Stricter than the site default (0.5): contact forms are a common spam target. */
const MIN_SCORE = 0.6;
const NAME_MAX = 200, EMAIL_MAX = 254, MESSAGE_MIN = 10, MESSAGE_MAX = 5000;
/** Spam messages are mostly links; real ones rarely need more than a few. */
const MAX_LINKS = 3;
/** The same message from the same address within this window counts once. */
const DUPLICATE_WINDOW_MS = 24 * 60 * 60_000;

/** Trimmed text without invisible control characters (newlines and tabs kept). */
const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').trim().slice(0, max + 1) : '';

const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|ru|xyz|top|info|biz|click|link|shop|site|online)\b/gi;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(`contact:${ip}`, 3, 10 * 60_000)) return json({ error: 'too_many' }, 429);
  if (await isBlockedBot('contact')) return json({ error: 'bot_check_failed' }, 403);

  const body = await readJsonBody(req, 24 * 1024);
  const name    = clean(body?.name, NAME_MAX);
  const email   = clean(body?.email, EMAIL_MAX).toLowerCase();
  const message = clean(body?.message, MESSAGE_MAX);
  const lang    = body?.locale === 'ar' ? 'ar' : 'en';

  // Bot traps: answer like a success so the bot learns nothing, keep nothing.
  if (isBotSubmission(body, MIN_FILL_MS)) return json({ ok: true });

  // Field checks.
  if (!email || email.length > EMAIL_MAX || !isValidEmail(email)) return json({ error: 'invalid_email' }, 400);
  if (!name || name.length > NAME_MAX || /[<>]|https?:|www\./i.test(name)) return json({ error: 'invalid_name' }, 400);
  if (!isTopic(body?.subject)) return json({ error: 'invalid_message' }, 400);
  if (message.length < MESSAGE_MIN || message.length > MESSAGE_MAX) return json({ error: 'invalid_message' }, 400);
  if ((message.match(LINK_RE) ?? []).length > MAX_LINKS) return json({ error: 'too_many_links' }, 400);

  // Fail closed: without a working reCAPTCHA check, nothing gets through.
  if (!process.env.RECAPTCHA_SECRET_KEY) return json({ error: 'unavailable' }, 503);
  if (!(await verifyRecaptchaToken(body?.recaptchaToken, { action: 'contact', minScore: MIN_SCORE }))) {
    return json({ error: 'bot_check_failed' }, 400);
  }

  if (isRateLimited(`contact-from:${email}`, 3, 60 * 60_000)) return json({ error: 'too_many' }, 429);
  // The same limits across every server instance, per day.
  if (!(await withinLimit(`contact-ip:${ip}`, 10, DAY)) || !(await withinLimit(`contact-from:${email}`, 5, DAY))) {
    return json({ error: 'too_many' }, 429);
  }
  if (!(await hasDeliverableDomainWithTimeout(email))) return json({ error: 'invalid_email' }, 400);

  const app = adminApp();
  if (!app) return json({ error: 'unavailable' }, 503);
  const messages = getFirestore(app).collection('contact_messages');

  // The same text from the same address (a double click, a resend) is kept once.
  const fingerprint = createHash('sha256').update(`${email}\n${message.toLowerCase().replace(/\s+/g, ' ')}`).digest('hex');
  let ref: string;
  try {
    const earlier = await messages.where('fingerprint', '==', fingerprint).limit(5).get();
    if (earlier.docs.some(d => Date.now() - Date.parse(d.get('submittedAt')) < DUPLICATE_WINDOW_MS)) {
      return json({ ok: true, status: 'duplicate' });
    }
    const saved = await messages.add({
      name, email, subject: body!.subject, message,
      submittedAt: new Date().toISOString(), read: false, locale: lang, fingerprint,
    });
    ref = saved.id;
  } catch (err) {
    console.error('[contact] save failed', err);
    return json({ error: 'save_failed' }, 500);
  }

  // The message is saved; emails are best effort from here.
  const msg: ContactMessage = { name, email, message, topic: body!.subject as ContactMessage['topic'], lang, ref, at: new Date() };
  // (sendEmail logs its own failures.)
  await sendEmail(hubNotification(msg));
  // The visitor's receipt: two per address an hour at most (on every
  // instance), within the day's budget for visitor-triggered email.
  if (await withinLimit(`contact-copy:${email}`, 2, HOUR) && await withinEmailBudget()) await sendEmail(senderCopy(msg));
  return json({ ok: true, status: 'sent' });
}
