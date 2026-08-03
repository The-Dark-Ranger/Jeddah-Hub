const SECRET = process.env.RECAPTCHA_SECRET_KEY;

/** Verifies a reCAPTCHA v3 token server-side. Fails closed: returns false if unconfigured, missing, or low-score. */
export async function verifyRecaptchaToken(token: string | null | undefined, minScore = 0.5): Promise<boolean> {
  if (!SECRET || !token) return false;

  const body = new URLSearchParams({ secret: SECRET, response: token });
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data: { success: boolean; score?: number } = await res.json();
  return data.success && (data.score === undefined || data.score >= minScore);
}
