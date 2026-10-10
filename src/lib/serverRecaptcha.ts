const SECRET = process.env.RECAPTCHA_SECRET_KEY;

/**
 * Verifies a reCAPTCHA v3 token server-side. Fails closed: returns false if
 * unconfigured, missing, malformed, low-score, or if Google can't be reached
 * in time — never throws, so callers can't turn a verification hiccup into a
 * 500 (or, worse, an accidental pass).
 */
export async function verifyRecaptchaToken(token: unknown, minScore = 0.5): Promise<boolean> {
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
    const data: { success?: boolean; score?: number } = await res.json();
    return data.success === true && (data.score === undefined || data.score >= minScore);
  } catch {
    return false;
  }
}
