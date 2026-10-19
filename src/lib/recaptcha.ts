declare global {
  interface Window { grecaptcha: any; }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

/** Adds Google's reCAPTCHA script to the page, once. It's ~350 KB, so it is
 *  loaded only when a visitor starts using a form that needs it (contact,
 *  sign-in, newsletter) rather than on every page. */
export function preloadRecaptcha() {
  if (!SITE_KEY || typeof document === 'undefined') return;
  if (document.getElementById('recaptcha-script')) return;
  const s = document.createElement('script');
  s.id = 'recaptcha-script';
  s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
  s.async = true;
  document.head.appendChild(s);
}

function waitForGrecaptcha(timeout: number): Promise<void> {
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
  if (!SITE_KEY || typeof window === 'undefined') return null;
  try {
    preloadRecaptcha();
    // Longer wait than before: the script may only start loading now, on a
    // slow phone connection.
    await waitForGrecaptcha(15_000);
    return await new Promise<string | null>(resolve => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(SITE_KEY, { action })
          .then((token: string) => resolve(token))
          .catch(() => resolve(null));
      });
    });
  } catch {
    return null;
  }
}
