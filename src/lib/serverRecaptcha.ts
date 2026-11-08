const SECRET = process.env.RECAPTCHA_SECRET_KEY;

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
  if (!SECRET || typeof token !== 'string' || !token || token.length > 4096) return false;

  try {
    const body = new URLSearchParams({ secret: SECRET, response: token });
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const data: { success?: boolean; score?: number; action?: string; hostname?: string } = await res.json();
    if (data.success !== true) return false;
    if (typeof data.score === 'number' && data.score < minScore) return false;
    if (action && data.action !== action) return false;
    // The page that asked must be the public site, or the same address this
    // request came to (a preview reached at its own address).
    if (data.hostname && !SITE_HOSTS.has(data.hostname) && data.hostname !== host) return false;
    return true;
  } catch {
    return false;
  }
}
