import { USE_EMULATORS } from './emulators';

const SECRET = process.env.RECAPTCHA_SECRET_KEY;

/** In local test runs only (USE_EMULATORS, which a production build can never
 *  turn on), this token passes, so the tests can reach what comes after the
 *  check, such as the sign-in limits. */
export const TEST_PASS_TOKEN = 'emulator-test-pass';

/** The public site's addresses (Google reports the hostname of the page that
 *  made the token). Tokens minted on a local page count only in development. */
const SITE_HOSTS = new Set(['jeddahhub.org', 'www.jeddahhub.org',
  ...(process.env.NODE_ENV === 'production' ? [] : ['localhost'])]);

/** The address a request was sent to, without its port. Vercel only delivers
 *  requests for this project's own addresses, so a preview is recognised by
 *  where it is reached rather than by a list of preview addresses here. */
export function requestHost(req: Request): string {
  return (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
}

/**
 * Verifies a reCAPTCHA v3 token server-side. Fails closed: returns false if
 * unconfigured, missing, malformed, low-score, issued for a different form
 * (`action`) or a different site, or if Google can't be reached in time.
 * Never throws, so callers can't turn a verification hiccup into a 500 (or,
 * worse, an accidental pass). Google itself rejects reused tokens.
 */
export async function verifyRecaptchaToken(
  token: unknown,
  { minScore = 0.5, action, host }: { minScore?: number; action?: string; host?: string } = {},
): Promise<boolean> {
  if (USE_EMULATORS && token === TEST_PASS_TOKEN) return true;
  if (!SECRET || typeof token !== 'string' || !token || token.length > 4096) return false;

  try {
    const body = new URLSearchParams({ secret: SECRET, response: token });
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[recaptcha] siteverify answered', res.status);
      return false;
    }
    const data: { success?: boolean; score?: number; action?: string; hostname?: string; 'error-codes'?: string[] } = await res.json();
    // A refusal is logged with its reason (a wrong secret key, a new domain
    // not added to the key, or a low score), so a broken setup shows up in
    // the logs instead of as every form failing. Only Google's verdict is
    // logged, never the token.
    const refuse = (reason: string) => {
      console.warn('[recaptcha] refused:', reason, { action: data.action, hostname: data.hostname, score: data.score, errors: data['error-codes'] });
      return false;
    };
    if (data.success !== true) return refuse('not successful');
    if (typeof data.score === 'number' && data.score < minScore) return refuse('low score');
    if (action && data.action !== action) return refuse('wrong action');
    // The page that asked must be the public site, or the same address this
    // request came to (a preview reached at its own address).
    if (data.hostname && !SITE_HOSTS.has(data.hostname) && data.hostname !== host) return refuse('wrong host');
    return true;
  } catch (err) {
    console.error('[recaptcha] verification failed', err);
    return false;
  }
}
