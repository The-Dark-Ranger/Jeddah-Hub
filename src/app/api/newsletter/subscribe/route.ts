/* POST /api/newsletter/subscribe: the only way onto the newsletter list.
 *
 * Browsers can't write to newsletter_subscribers directly (firestore.rules),
 * so every signup passes the bot checks here first:
 *   rate limits → honeypot / fill-time trap → reCAPTCHA → real mail domain.
 * Each address is stored once: the document id is a hash of the address,
 * so a second signup (even two at the same moment) finds it already there.
 * New subscribers then get the welcome email in the language they used. */
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
import { withinLimit, withinEmailBudget, DAY } from '@/lib/persistentLimit';
import { sendEmail } from '@/lib/email';
import { newsletterWelcome } from '@/lib/emails/newsletter';

/** A person needs at least this long to type an address and press Subscribe. */
const MIN_FILL_MS = 2500;
/** Stricter than the site default (0.5): this form is a common bot target. */
const MIN_SCORE = 0.6;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isRateLimited(`newsletter:${ip}`, 5, 10 * 60_000)) return json({ error: 'too_many' }, 429);
  if (await isBlockedBot('newsletter')) return json({ error: 'bot_check_failed' }, 403);

  const body = await readJsonBody(req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const lang = body?.locale === 'ar' ? 'ar' : 'en';

  // Bot traps: answer like a success so the bot learns nothing, save nothing.
  if (isBotSubmission(body, MIN_FILL_MS)) return json({ ok: true, status: 'subscribed' });

  if (!email || email.length > 254 || !isValidEmail(email)) return json({ error: 'invalid_email' }, 400);

  // Fail closed: without a working reCAPTCHA check, nobody gets on the list.
  if (!process.env.RECAPTCHA_SECRET_KEY) return json({ error: 'unavailable' }, 503);
  if (!(await verifyRecaptchaToken(body?.recaptchaToken, { action: 'newsletter_subscribe', minScore: MIN_SCORE }))) {
    return json({ error: 'bot_check_failed' }, 400);
  }

  // A few tries per address an hour, so the form can't be used to probe
  // which addresses are subscribed.
  if (isRateLimited(`newsletter-to:${email}`, 3, 60 * 60_000)) return json({ error: 'too_many' }, 429);
  if (!(await withinLimit(`newsletter-ip:${ip}`, 10, DAY))) return json({ error: 'too_many' }, 429);
  if (!(await hasDeliverableDomainWithTimeout(email))) return json({ error: 'invalid_email' }, 400);

  const app = adminApp();
  if (!app) return json({ error: 'unavailable' }, 503);
  const db = getFirestore(app);
  const subscribers = db.collection('newsletter_subscribers');

  try {
    // Older signups were stored under random ids; check by address too.
    const existing = await subscribers.where('email', '==', email).limit(1).get();
    if (!existing.empty) return json({ ok: true, status: 'already' });

    const id = createHash('sha256').update(email).digest('hex');
    // create() fails if the document exists, so two signups racing each
    // other still end up as one.
    await subscribers.doc(id).create({ email, subscribedAt: new Date().toISOString(), locale: lang });
  } catch (err) {
    if ((err as { code?: number }).code === 6) return json({ ok: true, status: 'already' }); // ALREADY_EXISTS
    console.error('[newsletter] save failed', err);
    return json({ error: 'save_failed' }, 500);
  }

  // The subscription stands even if the welcome email can't be sent
  // (sendEmail logs its own failures) or the day's email budget is used up.
  if (await withinEmailBudget()) await sendEmail(newsletterWelcome(lang, email));
  return json({ ok: true, status: 'subscribed' });
}
