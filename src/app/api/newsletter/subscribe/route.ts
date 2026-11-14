/* POST /api/newsletter/subscribe: the first half of joining the newsletter.
 *
 * Browsers can't write to the newsletter collections directly
 * (firestore.rules), so every signup passes the bot checks here first:
 *   rate limits → honeypot / fill-time trap → reCAPTCHA → real mail domain.
 * Nobody goes on the list from here (double opt-in): the address is kept
 * in newsletter_pending with a random token, and the confirmation email's
 * link (../confirm/route.ts) moves it onto the list. So the form can't
 * subscribe someone else's address, and every answer is the same "check
 * your inbox", subscribed already or not, so it can't reveal who is on the
 * list either. The document id is a hash of the address, so the same
 * address is only ever pending once. */
import { createHash, randomBytes } from 'node:crypto';
import { after, type NextRequest } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { requestHost, verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody, siteOrigin } from '@/lib/http';
import { SITE_URL } from '@/lib/seo';
import { json, isBotSubmission, isCrossSite } from '@/lib/formGuard';
import { isBlockedBot } from '@/lib/botCheck';
import { withinLimit, withinEmailBudget, DAY } from '@/lib/persistentLimit';
import { sendEmail } from '@/lib/email';
import { newsletterConfirm } from '@/lib/emails/newsletter';
import { CONFIRM_TTL_MS } from '@/lib/newsletterLinks';

/** A person needs at least this long to type an address and press Subscribe. */
const MIN_FILL_MS = 2500;
/** Stricter than the site default (0.5): this form is a common bot target. */
const MIN_SCORE = 0.6;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (isCrossSite(req)) return json({ error: 'forbidden' }, 403);
  if (isRateLimited(`newsletter:${ip}`, 5, 10 * 60_000)) return json({ error: 'too_many' }, 429);
  if (await isBlockedBot('newsletter')) return json({ error: 'bot_check_failed' }, 403);

  const body = await readJsonBody(req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const lang = body?.locale === 'ar' ? 'ar' : 'en';

  // Bot traps: answer like a success so the bot learns nothing, save nothing.
  if (isBotSubmission(body, MIN_FILL_MS)) return json({ ok: true, status: 'pending' });

  if (!email || email.length > 254 || !isValidEmail(email)) return json({ error: 'invalid_email' }, 400);

  // Fail closed: without a working reCAPTCHA check, nobody gets on the list.
  if (!process.env.RECAPTCHA_SECRET_KEY) return json({ error: 'unavailable' }, 503);
  if (!(await verifyRecaptchaToken(body?.recaptchaToken, { host: requestHost(req), action: 'newsletter_subscribe', minScore: MIN_SCORE }))) {
    return json({ error: 'bot_check_failed' }, 400);
  }

  if (!(await withinLimit(`newsletter-ip:${ip}`, 10, DAY))) return json({ error: 'too_many' }, 429);
  // At most three confirmation emails a day to any one address, on every
  // server, so nobody can use the form to flood someone's inbox.
  if (!(await withinLimit(`newsletter-to:${email}`, 3, DAY))) return json({ error: 'too_many' }, 429);
  if (!(await hasDeliverableDomainWithTimeout(email))) return json({ error: 'invalid_email' }, 400);

  const app = adminApp();
  if (!app) return json({ error: 'unavailable' }, 503);
  const db = getFirestore(app);
  const id = createHash('sha256').update(email).digest('hex');
  sweepPending(db);

  try {
    // Already on the list (older signups were stored under random ids, so
    // check by address too): the same answer, and no email.
    const [byId, byAddress] = await Promise.all([
      db.doc(`newsletter_subscribers/${id}`).get(),
      db.collection('newsletter_subscribers').where('email', '==', email).limit(1).get(),
    ]);
    if (byId.exists || !byAddress.empty) return json({ ok: true, status: 'pending' });
  } catch (err) {
    console.error('[newsletter] lookup failed', err);
    return json({ error: 'save_failed' }, 500);
  }

  // The email is the whole point of this step: without one, say so.
  if (!(await withinEmailBudget())) return json({ error: 'unavailable' }, 503);

  const token = randomBytes(24).toString('base64url');
  try {
    // A new request replaces an older one (and its token) for the address.
    await db.doc(`newsletter_pending/${id}`).set({ email, locale: lang, token, requestedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[newsletter] save failed', err);
    return json({ error: 'save_failed' }, 500);
  }

  const url = `${siteOrigin(req, SITE_URL)}/${lang}/newsletter/confirm?id=${id}&t=${token}`;
  const sent = await sendEmail(newsletterConfirm(lang, email, url));
  if (!sent.ok) return json({ error: 'unavailable' }, 503);
  return json({ ok: true, status: 'pending' });
}

/** About one call in 25 also deletes up to 50 confirmations nobody used in
 *  time, after the response, so the pending list doesn't keep growing. */
function sweepPending(db: FirebaseFirestore.Firestore) {
  if (Math.random() > 0.04) return;
  after(async () => {
    const cutoff = new Date(Date.now() - CONFIRM_TTL_MS).toISOString();
    const old = await db.collection('newsletter_pending').where('requestedAt', '<', cutoff).limit(50).get().catch(() => null);
    if (!old || old.empty) return;
    const batch = db.batch();
    old.docs.forEach(d => batch.delete(d.ref));
    await batch.commit().catch(err => console.error('[newsletter] sweep failed', err));
  });
}
