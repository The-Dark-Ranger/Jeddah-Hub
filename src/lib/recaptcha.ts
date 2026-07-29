declare global {
  interface Window { grecaptcha: any; }
}

export function getRecaptchaToken(action: string): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || typeof window === 'undefined') return Promise.resolve(null);
  return new Promise(resolve => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(siteKey, { action })
        .then((token: string) => resolve(token))
        .catch(() => resolve(null));
    });
  });
}
