/* The public site: every page opens in both languages, on phone and desktop. */
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
  // Forms refuse posts from other websites.
  const crossSite = await request.post('/api/contact/send', { data: {}, headers: { origin: 'https://evil.example' } });
  expect(crossSite.status()).toBe(403);
});

test('security headers are sent', async ({ request }) => {
  const res = await request.get('/en');
  const headers = res.headers();
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-powered-by']).toBeUndefined();
});
