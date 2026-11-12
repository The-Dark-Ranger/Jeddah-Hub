/* POST /api/members/confirm-email: emails a signed-in member whose address
 * isn't confirmed yet the link that confirms it (src/lib/emails/confirm.ts),
 * from jeddahhub.org and in the language of the sign-in page.
 *
 * Only ever to the caller's own address, which their sign-in token proves.
 * The link carries Firebase's one-time code to this site's sign-in page
 * (/{locale}/login?mode=verifyEmail&oobCode=…), which applies it, so the
 * email has no firebaseapp.com address in it.
 *
 * Answers 503 when the email can't be sent from here (no Resend key, no
 * service account, the day's budget used up): the page then asks Firebase
 * to send its own, plainer email instead, so nobody is left without a link. */
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireUnconfirmedCaller } from '@/lib/serverAuth';
import { readJsonBody, siteOrigin } from '@/lib/http';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { withinLimit, withinEmailBudget, DAY } from '@/lib/persistentLimit';
import { adminApp } from '@/lib/firebaseAdmin';
import { emailConfigured, sendEmail } from '@/lib/email';
import { confirmEmail } from '@/lib/emails/confirm';
import { SITE_URL } from '@/lib/seo';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

export async function POST(req: NextRequest) {
  const caller = await requireUnconfirmedCaller(req);
  if (!caller) return json({ error: 'unauthorized' }, 401);
  // The sign-in page sends one at sign-in and lets the member ask again
  // once a minute; a few more is someone clicking, more than that a script.
  if (isRateLimited(`confirm-email:${caller.uid}`, 3, 10 * 60_000) || isRateLimited(`confirm-email-ip:${clientIp(req)}`, 10, 10 * 60_000)) {
    return json({ error: 'too_many' }, 429);
  }
  if (!(await withinLimit(`confirm-email:${caller.uid}`, 8, DAY))) return json({ error: 'too_many' }, 429);

  const app = adminApp();
  if (!app || !emailConfigured() || !(await withinEmailBudget())) return json({ error: 'unavailable' }, 503);

  const body = await readJsonBody(req);
  const lang = body?.locale === 'ar' ? 'ar' : 'en';
  try {
    const auth = getAuth(app);
    // Confirmed meanwhile (another tab, another device): nothing to send.
    if ((await auth.getUser(caller.uid)).emailVerified) return json({ ok: true, status: 'already' });

    const code = new URL(await auth.generateEmailVerificationLink(caller.email)).searchParams.get('oobCode');
    if (!code) return json({ error: 'unavailable' }, 503);
    const url = `${siteOrigin(req, SITE_URL)}/${lang}/login?mode=verifyEmail&oobCode=${encodeURIComponent(code)}`;
    const name = await getFirestore(app).doc(`users/${caller.uid}`).get()
      .then(d => (lang === 'ar' && d.get('displayNameAr')) || d.get('displayName'))
      .catch(() => null);

    const sent = await sendEmail(confirmEmail({ lang, email: caller.email, name: typeof name === 'string' ? name : null, url }));
    return sent.ok ? json({ ok: true, status: 'sent' }) : json({ error: 'unavailable' }, 503);
  } catch (err) {
    console.error('[confirm-email] failed:', (err as { code?: string } | null)?.code);
    return json({ error: 'unavailable' }, 503);
  }
}
