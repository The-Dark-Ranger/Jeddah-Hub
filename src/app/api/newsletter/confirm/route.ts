/* /api/newsletter/confirm: the second half of joining the newsletter.
 *
 * POST, from the button on /{locale}/newsletter/confirm (the page the
 * confirmation email links to), moves a pending signup onto the list and
 * sends the welcome email with its unsubscribe links. GET only forwards to
 * that page: link scanners open every link in an email, and must not
 * confirm anyone by doing so.
 *
 * `id` is the pending signup's document id and `t` its random token. A
 * wrong token, an expired link and an unknown id get the same answer. */
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminApp } from '@/lib/firebaseAdmin';
import { readJsonBody, siteOrigin } from '@/lib/http';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { withinEmailBudget } from '@/lib/persistentLimit';
import { CONFIRM_TTL_MS, LINK_ID_RE, LINK_TOKEN_RE, sameToken } from '@/lib/newsletterLinks';
import { SITE_URL } from '@/lib/seo';
import { sendEmail } from '@/lib/email';
import { newsletterWelcome } from '@/lib/emails/newsletter';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const lang = q.get('l') === 'ar' ? 'ar' : 'en';
  const page = new URL(`/${lang}/newsletter/confirm`, req.nextUrl.origin);
  for (const k of ['id', 't']) { const v = q.get(k); if (v) page.searchParams.set(k, v); }
  return NextResponse.redirect(page, 303);
}

export async function POST(req: NextRequest) {
  if (isRateLimited(`newsletter-confirm:${clientIp(req)}`, 20, 10 * 60_000)) return json({ error: 'too_many' }, 429);
  const body = await readJsonBody(req);
  const id = String(body?.id ?? '');
  const token = String(body?.t ?? '');
  if (!LINK_ID_RE.test(id) || !LINK_TOKEN_RE.test(token)) return json({ error: 'not_found' }, 404);

  const app = adminApp();
  if (!app) return json({ error: 'unavailable' }, 503);
  const db = getFirestore(app);
  const pendingRef = db.doc(`newsletter_pending/${id}`);
  const subscriberRef = db.doc(`newsletter_subscribers/${id}`);
  const unsubToken = randomBytes(24).toString('base64url');

  let joined: { email: string; lang: 'en' | 'ar'; isNew: boolean } | null;
  try {
    // One transaction, so pressing the button twice adds the address once.
    joined = await db.runTransaction(async tx => {
      const [pending, existing] = await Promise.all([tx.get(pendingRef), tx.get(subscriberRef)]);
      if (!pending.exists || !sameToken(pending.get('token'), token)) return null;
      const requestedAt = Date.parse(String(pending.get('requestedAt') ?? ''));
      if (!(Date.now() - requestedAt < CONFIRM_TTL_MS)) return null;
      const email = String(pending.get('email'));
      const lang: 'en' | 'ar' = pending.get('locale') === 'ar' ? 'ar' : 'en';
      tx.delete(pendingRef);
      if (!existing.exists) {
        const now = new Date().toISOString();
        tx.create(subscriberRef, { email, locale: lang, unsubToken, subscribedAt: now, confirmedAt: now });
      }
      return { email, lang, isNew: !existing.exists };
    });
  } catch (err) {
    console.error('[newsletter] confirm failed', err);
    return json({ error: 'unavailable' }, 503);
  }
  if (!joined) return json({ error: 'not_found' }, 404);

  // Only a new subscriber gets the welcome. The subscription stands even if
  // it can't be sent (sendEmail logs its own failures).
  if (joined.isNew && await withinEmailBudget()) {
    const origin = siteOrigin(req, SITE_URL);
    const leave = `id=${id}&t=${unsubToken}`;
    await sendEmail(newsletterWelcome(joined.lang, joined.email, {
      page: `${origin}/${joined.lang}/unsubscribe?${leave}`,
      oneClick: `${origin}/api/newsletter/unsubscribe?${leave}&l=${joined.lang}`,
    }));
  }
  return json({ ok: true });
}
