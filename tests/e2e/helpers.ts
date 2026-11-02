/* What the browser tests share: the made-up people and content, signing in,
 * and the checks every page should pass. */
import { expect, type Page } from '@playwright/test';

const person = (key: string, name: string, role: string, extra: { nameAr?: string; password?: string } = {}) => ({
  uid: `test-${key}`, email: `${key}@example.org`, password: extra.password ?? 'Test-password-1', name, role, nameAr: extra.nameAr,
});

export const PEOPLE = {
  curator: person('curator', 'Cara Curator', 'curator'),
  vice: person('vice', 'Vic Vice', 'vice_curator'),
  impact: person('impact', 'Ima Impact', 'impact_officer'),
  lead: person('lead', 'Lena Lead', 'shaper'),
  shaper: person('shaper', 'Sami Shaper', 'shaper', { nameAr: 'سامي شيبر' }),
  signer: person('signer', 'Sara Signer', 'shaper'),
  newcomer: person('newcomer', 'Nour Newcomer', 'shaper', { password: 'Tmp-ABCD-EFGH-JKMN' }),
};

export const PHOTO_ID = 'AbCdEfGhIjKlMnOpQrSt';
/** The smallest valid JPEG: enough for the photo route and an <img> to accept it. */
export const PHOTO_URI = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
export const PHOTO_PATH = `/api/media/${PHOTO_ID}`;

export const PUBLISHED_POST = {
  title: 'Trees along the corniche',
  slug: 'trees-along-the-corniche',
  content: 'We planted a hundred trees.\n\nEveryone came to help.',
  excerpt: 'We planted a hundred trees.',
  tags: ['Environment'],
  imageUrl: PHOTO_PATH,
  images: [PHOTO_PATH],
};

/** A real image file to upload through the page's photo buttons. */
export const UPLOAD_FILE = 'public/logo.png';

/** Signs in through the real page. Only the Google bot check is answered for
 *  the test (it can't run without a real site key). */
export async function signIn(page: Page, who: { email: string; password: string }) {
  await page.route('**/api/verify-recaptcha', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/en/login');
  await page.locator('#login-email').fill(who.email);
  await page.locator('#login-password').fill(who.password);
  // The page refuses a form sent faster than a person could fill it (1.5 s).
  await page.waitForTimeout(1_700);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/);
}

/** Collects the browser errors a page reports while the test runs. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(`page error: ${e.message}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Analytics, BotID and reCAPTCHA need Vercel or Google, which a local run lacks.
    if (/_vercel|va\.vercel|Failed to load resource|recaptcha|botid|hydrat.*extension/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

/** Nothing wider than the screen: a page must never scroll sideways. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `page is ${overflow}px wider than the screen`).toBeLessThanOrEqual(1);
}

/** Whether an element is on screen right now, not somewhere further down. */
export async function isInViewport(page: Page, selector: string) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.top < window.innerHeight;
  });
}
