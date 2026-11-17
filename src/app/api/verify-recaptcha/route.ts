import { NextRequest, NextResponse } from 'next/server';
import { requestHost, verifyRecaptchaToken } from '@/lib/serverRecaptcha';
import { readJsonBody } from '@/lib/http';
import { isRateLimited, clientIp } from '@/lib/rateLimit';
import { isBlockedBot } from '@/lib/botCheck';
import { isBotSubmission, isCrossSite } from '@/lib/formGuard';
import { countUse, withinLimit, HOUR } from '@/lib/persistentLimit';
import { USE_EMULATORS } from '@/lib/emulators';

const SECRET = process.env.RECAPTCHA_SECRET_KEY;

/* Sign-in attempts through the sign-in page, counted on the server across
 * every instance, so clearing the browser's storage doesn't reset them (the
 * page's own lockout lives in the browser). Per account: 10 tries in 15
 * minutes. Per network: 60 an hour, enough for a hub event where everyone
 * shares one Wi-Fi. The password check itself is Firebase's, which applies
 * its own throttling to anyone who skips this page. */
const LOGIN_PER_ACCOUNT = { limit: 10, windowMs: 15 * 60_000 };
const LOGIN_PER_NETWORK = { limit: 60, windowMs: HOUR };
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
/** The login page's own minimum fill time (its MIN_FILL_MS). */
const LOGIN_MIN_FILL_MS = 1500;
/** Each attempt on an account after the third in its window waits a
 *  second longer before it's answered (up to 5), which slows a script
 *  down without getting in the way of a person who mistyped. */
const FREE_ATTEMPTS = 3;
const MAX_DELAY_MS = 5000;

export async function POST(req: NextRequest) {
  if (isCrossSite(req)) return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
  // Gates login and contact submissions; a real person needs a handful of
  // tries a minute at most.
  if (isRateLimited(`verify-recaptcha:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }
  if (await isBlockedBot('verify-recaptcha')) {
    return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
  }

  const body = await readJsonBody(req);
  // The token must have been issued for the form that's asking.
  const action = body?.action === 'login' || body?.action === 'contact' ? body.action : null;
  if (!action) return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });

  let email = '';
  if (action === 'login') {
    email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email)) return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    // The hidden field filled in, or sent faster than a person could type.
    if (isBotSubmission(body, LOGIN_MIN_FILL_MS)) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }
  }

  const token = body?.token;
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
  }
  if (!SECRET && !USE_EMULATORS) {
    console.warn('[verify-recaptcha] RECAPTCHA_SECRET_KEY not configured, rejecting request');
    return NextResponse.json({ ok: false, error: 'reCAPTCHA not configured' }, { status: 503 });
  }
  if (!(await verifyRecaptchaToken(token, { action, host: requestHost(req) }))) {
    return NextResponse.json({ ok: false, error: 'reCAPTCHA verification failed' }, { status: 400 });
  }

  if (action === 'login') {
    // Counted only once the token has passed, so nobody can lock a member
    // out by sending their address over and over without passing the check.
    // Both are counted on every such attempt, so an attacker spreading
    // guesses over many accounts still meets the per-network limit.
    const [accountUses, networkOk] = await Promise.all([
      countUse(`login-account:${email}`, LOGIN_PER_ACCOUNT.limit, LOGIN_PER_ACCOUNT.windowMs),
      withinLimit(`login-network:${clientIp(req)}`, LOGIN_PER_NETWORK.limit, LOGIN_PER_NETWORK.windowMs),
    ]);
    const uses = accountUses ?? 0;
    if (uses > LOGIN_PER_ACCOUNT.limit || !networkOk) {
      return NextResponse.json({ ok: false, error: 'Too many attempts' }, { status: 429 });
    }
    const delay = Math.min(Math.max(0, uses - FREE_ATTEMPTS) * 1000, MAX_DELAY_MS);
    if (delay) await new Promise(r => setTimeout(r, delay));
  }
  return NextResponse.json({ ok: true });
}
