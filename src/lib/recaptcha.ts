declare global {
  interface Window { grecaptcha: any; }
}

function waitForGrecaptcha(timeout = 5000): Promise<void> {
  if (typeof window.grecaptcha?.ready === 'function') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (typeof window.grecaptcha?.ready === 'function') resolve();
      else if (Date.now() - start > timeout) reject(new Error('reCAPTCHA script not loaded'));
      else setTimeout(check, 100);
    };
    check();
  });
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || typeof window === 'undefined') return null;
  try {
    await waitForGrecaptcha(5000);
    return await new Promise<string | null>(resolve => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(siteKey, { action })
          .then((token: string) => resolve(token))
          .catch(() => resolve(null));
      });
    });
  } catch {
    return null;
  }
}
