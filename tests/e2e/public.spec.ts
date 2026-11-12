/* The public site: every page opens in both languages, on phone and desktop. */
import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { expectNoSidewaysScroll, PHOTO_PATH, PUBLISHED_POST, watchErrors } from './helpers';

const PAGES = ['', '/about', '/projects', '/projects/green-jeddah', '/news', `/news/${PUBLISHED_POST.slug}`,
  '/become-a-shaper', '/contact', '/login', '/privacy-policy', '/terms-of-use'];
const SCREENS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1366, height: 800 },
];

for (const screen of SCREENS) {
  for (const locale of ['en', 'ar']) {
    test(`public pages open cleanly: ${locale}, ${screen.name}`, async ({ page }) => {
      await page.setViewportSize({ width: screen.width, height: screen.height });
      const errors = watchErrors(page);
      for (const path of PAGES) {
        const res = await page.goto(`/${locale}${path}`, { waitUntil: 'load' });
        expect(res?.status(), `/${locale}${path}`).toBe(200);
        await expect(page.locator('h1').first()).toBeVisible();
        await expectNoSidewaysScroll(page);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('the Initiatives page has no summary strip', async ({ page }) => {
  await page.goto('/en/projects');
  await expect(page.getByRole('link', { name: /Green Jeddah/ })).toBeVisible();
  await expect(page.locator('dl')).toHaveCount(0);
  await expect(page.getByText('Shapers involved')).toHaveCount(0);
  await expect(page.getByText('Focus areas')).toHaveCount(0);
});

test('a news post shows its photos on the list and the post', async ({ page }) => {
  await page.goto('/en/news');
  const card = page.getByRole('link', { name: new RegExp(PUBLISHED_POST.title) });
  await expect(card.locator('img').first()).toHaveAttribute('src', new RegExp(encodeURIComponent(PHOTO_PATH)));

  await card.click();
  await page.waitForURL(`**/news/${PUBLISHED_POST.slug}`);
  await expect(page.locator(`article figure img[src="${PHOTO_PATH}"]`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Gallery' })).toBeVisible();
});

test('a shared news post has its own title and picture, and the share links carry its address', async ({ page }) => {
  await page.goto(`/en/news/${PUBLISHED_POST.slug}`);
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', new RegExp(`news%2F${PUBLISHED_POST.slug}`));
  await expect(page).toHaveTitle(new RegExp(PUBLISHED_POST.title));
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', new RegExp(PHOTO_PATH));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/en/news/${PUBLISHED_POST.slug}`));
});

test('photos are served as images, and bad addresses are refused', async ({ request }) => {
  const ok = await request.get(PHOTO_PATH);
  expect(ok.status()).toBe(200);
  expect(ok.headers()['content-type']).toBe('image/jpeg');
  expect(ok.headers()['x-content-type-options']).toBe('nosniff');
  expect((await request.get('/api/media/not-a-real-id')).status()).toBe(404);
});

test('server routes refuse what they should', async ({ request }) => {
  // Uploading a photo needs a signed-in member.
  expect((await request.post('/api/media', { data: { data: 'x' } })).status()).toBe(401);
  // So does dropping the public pages' cache.
  expect((await request.post('/api/revalidate')).status()).toBe(401);
  // Account routes are for curators.
  expect((await request.post('/api/members/create-account', { data: {} })).status()).toBe(401);
  // Every change sent from another website's page is refused, before any
  // route runs: forms, admin routes, and pages alike.
  const evil = { origin: 'https://evil.example' };
  expect((await request.post('/api/contact/send', { data: {}, headers: evil })).status()).toBe(403);
  expect((await request.post('/api/members/create-account', { data: {}, headers: evil })).status()).toBe(403);
  expect((await request.post('/api/revalidate', { headers: { 'sec-fetch-site': 'cross-site' } })).status()).toBe(403);
  expect((await request.post('/api/media', { data: {}, headers: { 'sec-fetch-site': 'same-site' } })).status()).toBe(403);
  expect((await request.post('/en/contact', { data: {}, headers: evil })).status()).toBe(403);
});

test('the server checks the sign-in form for bots too', async ({ request }) => {
  const attempt = (extra: object) => request.post('/api/verify-recaptcha', { data: { token: 'x', action: 'login', email: 'bot-check@example.org', ...extra } });
  // The hidden field filled in, sent instantly, or with no timing at all.
  expect((await attempt({ website: 'spam', elapsedMs: 5000 })).status()).toBe(403);
  expect((await attempt({ elapsedMs: 200 })).status()).toBe(403);
  expect((await attempt({})).status()).toBe(403);
});

test('the server slows down and then limits sign-in attempts per account, whatever the browser does', async ({ request }) => {
  const attempt = () => request.post('/api/verify-recaptcha', { data: { token: 'x', action: 'login', email: 'target@example.org', website: '', elapsedMs: 5000 } });
  // The first 10 get through to the bot check (refused here: no reCAPTCHA key
  // in tests); from the fourth on, each is answered a second later (up to 5).
  for (let i = 0; i < 10; i++) {
    const started = Date.now();
    expect((await attempt()).status()).not.toBe(429);
    if (i >= 3) expect(Date.now() - started).toBeGreaterThanOrEqual(Math.min(i - 2, 5) * 1000 - 50);
  }
  expect((await attempt()).status()).toBe(429);
  // Other accounts aren't affected.
  const other = await request.post('/api/verify-recaptcha', { data: { token: 'x', action: 'login', email: 'someone@example.org', elapsedMs: 5000 } });
  expect(other.status()).not.toBe(429);
});

test('security headers are sent', async ({ request }) => {
  const res = await request.get('/en');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('on a phone, the open menu stays put: the page does not scroll under it and the bar stays', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en', { waitUntil: 'networkidle' });
  const bar = page.getByRole('navigation', { name: 'Main navigation' });
  // Partway down the page, then up a little so the bar is showing.
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await expect(bar).toHaveClass(/navbarHidden/);
  await page.evaluate(() => window.scrollTo({ top: 850, behavior: 'instant' }));
  await expect(bar).not.toHaveClass(/navbarHidden/);
  await expect.poll(async () => (await bar.boundingBox())?.y).toBe(0);
  const before = await page.evaluate(() => window.scrollY);

  await page.getByRole('button', { name: 'Toggle menu' }).click();
  await expect(page.getByRole('link', { name: 'Member Login' }).last()).toBeVisible();
  // Trying to scroll the page down while the menu is open (this used to
  // move the page and tuck the bar away, leaving a gap above the menu).
  await page.evaluate(() => window.scrollBy({ top: 1200, behavior: 'instant' }));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(0); // pinned: nothing to scroll
  expect((await bar.boundingBox())?.y).toBe(0);

  await page.keyboard.press('Escape');
  // Back exactly where the reader was.
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(Math.round(before));
});

/** The emulator's database, as the server sees it (Admin SDK). */
async function serverDb() {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  const { getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-jeddah-hub' }));
}

test('a newsletter link takes an address off the list, only with its own token', async ({ page, request }) => {
  const db = await serverDb();
  const subscribe = async (email: string, token: string) => {
    const id = createHash('sha256').update(email).digest('hex');
    await db.doc(`newsletter_subscribers/${id}`).set({ email, unsubToken: token, subscribedAt: new Date().toISOString(), locale: 'en' });
    return id;
  };
  const listed = async (id: string) => (await db.doc(`newsletter_subscribers/${id}`).get()).exists;

  const token = 'tok_abcdefghijklmnopqrstuvwx';
  const id = await subscribe('leaving@example.com', token);
  // A wrong token changes nothing, and answers like an address not on the list.
  expect((await request.post('/api/newsletter/unsubscribe', { data: { id, t: 'not_the_right_token_12345' } })).status()).toBe(404);
  // Opening the link (as link scanners do) only leads to the page.
  const opened = await request.get(`/api/newsletter/unsubscribe?id=${id}&t=${token}&l=ar`, { maxRedirects: 0 });
  expect(opened.status()).toBe(303);
  expect(opened.headers().location).toContain(`/ar/unsubscribe?id=${id}&t=${token}`);
  expect(await listed(id)).toBe(true);

  // The page asks first, then takes the address off.
  await page.goto(`/en/unsubscribe?id=${id}&t=${token}`);
  await page.getByRole('button', { name: 'Unsubscribe' }).click();
  await expect(page.getByRole('heading', { name: "You're unsubscribed" })).toBeVisible();
  expect(await listed(id)).toBe(false);
  // The same link again: nothing left to do.
  await page.reload();
  await page.getByRole('button', { name: 'Unsubscribe' }).click();
  await expect(page.getByText("This link doesn't work any more", { exact: false })).toBeVisible();

  // A mail app's own Unsubscribe button (RFC 8058 one-click).
  const id2 = await subscribe('oneclick@example.com', 'tok_zyxwvutsrqponmlkjihgfedc');
  const oneClick = await request.post(`/api/newsletter/unsubscribe?id=${id2}&t=tok_zyxwvutsrqponmlkjihgfedc&l=en`, { form: { 'List-Unsubscribe': 'One-Click' } });
  expect(oneClick.status()).toBe(200);
  expect(await listed(id2)).toBe(false);
});
