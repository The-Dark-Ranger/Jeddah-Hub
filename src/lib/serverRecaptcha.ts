const SECRET = process.env.RECAPTCHA_SECRET_KEY;

/** Sites a token may come from (Google reports the page's hostname). */
const ALLOWED_HOSTS = new Set(['jeddahhub.org', 'www.jeddahhub.org', 'jeddah-hub.vercel.app', 'localhost']);
/** This project's own Vercel preview deployments (not any *.vercel.app site). */
const isOwnPreview = (host: string) => /^jeddah-[a-z0-9-]+-mohammed-alshawis-projects\.vercel\.app$/.test(host);

/**
 * Verifies a reCAPTCHA v3 token server-side. Fails closed: returns false if
 * unconfigured, missing, malformed, low-score, issued for a different form
 * (`action`) or a different site, or if Google can't be reached in time.
 * Never throws, so callers can't turn a verification hiccup into a 500 (or,
 * worse, an accidental pass). Google itself rejects reused tokens.
 */
export async function verifyRecaptchaToken(
  token: unknown,
  { minScore = 0.5, action }: { minScore?: number; action?: string } = {},
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
    if (data.hostname && !ALLOWED_HOSTS.has(data.hostname) && !isOwnPreview(data.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
