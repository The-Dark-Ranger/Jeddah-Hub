/* The dashboards: changing a password, the Charter, news photos, and proposing
 * and approving a Hub Activity, each followed from start to finish. */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, isInViewport, PEOPLE, signIn, UPLOAD_FILE, watchErrors } from './helpers';

/** Answers "are you sure?" pop-ups with yes. */
const acceptDialogs = (page: Page) => page.on('dialog', d => d.accept());

test.describe('signing in', () => {
  test('a wrong password is cleared and says nothing about the account; Caps Lock is pointed out', async ({ page }) => {
    await page.route('**/api/verify-recaptcha', route => route.fulfill({ json: { ok: true } }));
    await page.goto('/en/login');
    await page.locator('#login-email').fill(PEOPLE.signer.email);
    await page.locator('#login-password').fill('wrong-password');
    // A real Caps Lock can't be switched on in an automated browser: send the key event it produces.
    await page.locator('#login-password').dispatchEvent('keydown', { key: 'A', modifierCapsLock: true });
    await expect(page.getByText('Caps Lock is on.')).toBeVisible();
    await page.locator('#login-password').dispatchEvent('keyup', { key: 'a', modifierCapsLock: false });
    await expect(page.getByText('Caps Lock is on.')).toHaveCount(0);
    await page.waitForTimeout(1_700);
    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page.locator('#login-password')).toHaveValue('');
  });

  test('not keeping the session means it ends with the browser; a signed-in visit to sign in goes to the dashboard', async ({ page }) => {
    await page.route('**/api/verify-recaptcha', route => route.fulfill({ json: { ok: true } }));
    await page.goto('/en/login');
    await page.getByRole('checkbox', { name: /Keep me signed in/ }).uncheck();
    await page.locator('#login-email').fill(PEOPLE.signer.email);
    await page.locator('#login-password').fill(PEOPLE.signer.password);
    await page.waitForTimeout(1_700);
    await page.locator('form button[type="submit"]').click();
    await page.waitForURL(/\/dashboard/);
    const kept = await page.evaluate(() => Object.keys(sessionStorage).some(k => k.startsWith('firebase:authUser')));
    expect(kept).toBe(true);

    await page.goto('/en/login');
    await page.waitForURL(/\/dashboard/);
  });
});

test.describe('changing a password', () => {
  test('My Profile has the form, and no extra button above it', async ({ page }) => {
    await signIn(page, PEOPLE.signer);
    await page.goto('/en/dashboard/shaper/profile');
    await expect(page.getByRole('heading', { name: PEOPLE.signer.name })).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Change password' })).toHaveCount(0);
  });

  test('a one-time password leads straight to the form, and setting one clears the reminder', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await signIn(page, PEOPLE.newcomer);
    await page.waitForURL(/profile#password/);
    await expect.poll(() => isInViewport(page, '#password')).toBe(true);

    // The reminder's own button works too, after scrolling back up.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const banner = page.getByRole('alert').filter({ hasText: 'one-time password' });
    await banner.getByRole('link', { name: 'Change password' }).click();
    await expect.poll(() => isInViewport(page, '#password')).toBe(true);

    await page.locator('#pw-current').fill(PEOPLE.newcomer.password);
    await page.locator('#pw-new').fill('A-new-password-1');
    await page.locator('#pw-confirm').fill('A-new-password-1');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated.')).toBeVisible();
    await expect(banner).toHaveCount(0);
  });
});

test.describe('the Community Charter', () => {
  test('a different name must be typed again; the account name and the tick sign it', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, PEOPLE.signer);

    // Read & sign opens the Charter at the top, not at the sign-off.
    await page.getByRole('link', { name: 'Read & sign' }).click();
    await page.waitForURL(/\/dashboard\/shaper\/charter$/);
    await expect(page.locator('#sign')).toBeAttached();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(await isInViewport(page, 'h1')).toBe(true);
    expect(await isInViewport(page, '#sign')).toBe(false);

    const name = page.locator('#charter-name');
    const tick = page.getByRole('checkbox', { name: /read the Community Charter/ });
    const submit = page.getByRole('button', { name: 'Submit confirmation' });

    // The name isn't filled in for them, and both are needed.
    await expect(name).toHaveValue('');
    await expect(submit).toBeDisabled();

    await name.fill('Someone Else');
    await expect(submit).toBeDisabled();
    await tick.check();
    await submit.click();
    await expect(page.getByRole('alert').filter({ hasText: "isn't the name on your account" })).toBeVisible();
    await expect(name).toHaveValue('');
    await expect(name).toBeFocused();

    // Capitals and spacing don't matter.
    await name.fill('  sara   SIGNER ');
    await submit.click();
    await expect(page.getByRole('heading', { name: "You've confirmed the Charter" })).toBeVisible();
    await expect(page.getByText(/Signed as Sara Signer/)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the Arabic account name is accepted too', async ({ page }) => {
    await signIn(page, PEOPLE.shaper);
    await page.goto('/ar/dashboard/shaper/charter');
    await page.locator('#charter-name').fill('سامي شيبر');
    await page.getByRole('checkbox').check();
    await page.locator('form').getByRole('button').last().click();
    await expect(page.locator('#sign svg').first()).toBeVisible();
    await expect(page.locator('#sign')).toContainText('سامي شيبر');
  });

  test('the Curator and Vice Curator download who signed; nobody else can', async ({ browser }) => {
    for (const who of [PEOPLE.curator, PEOPLE.vice]) {
      const page = await (await browser.newContext()).newPage();
      await signIn(page, who);
      await page.goto('/en/dashboard/shaper/charter');
      await expect(page.getByText(/2 of \d+ Shapers signed/)).toBeVisible();

      const csvDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download sign-offs (CSV)' }).click();
      const csv = readFileSync(await (await csvDownload).path(), 'utf8');
      expect(csv).toContain('"Name","Email","Role","Name signed","Signed at (UTC)","Member ID"');
      expect(csv).toMatch(/"Sara Signer","signer@example.org","shaper","Sara Signer","\d{4}-\d{2}-\d{2}T/);
      // Only those who signed.
      expect(csv).not.toContain('Lena Lead');

      const excelDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download sign-offs (Excel)' }).click();
      const excel = await excelDownload;
      expect(excel.suggestedFilename()).toMatch(/\.xlsx$/);
      expect(readFileSync(await excel.path()).subarray(0, 2).toString()).toBe('PK');
    }

    const others = await (await browser.newContext()).newPage();
    await signIn(others, PEOPLE.impact);
    await others.goto('/en/dashboard/shaper/charter');
    await expect(others.locator('#sign')).toBeVisible();
    await expect(others.getByRole('button', { name: /Download sign-offs/ })).toHaveCount(0);
  });
});

test.describe('news photos', () => {
  test('a member adds photos, a curator publishes, and they appear on the News page', async ({ browser }) => {
    const title = 'Our first clean-up day';
    const member = await (await browser.newContext()).newPage();
    const errors = watchErrors(member);
    await signIn(member, PEOPLE.lead);
    await member.goto('/en/dashboard/shaper/blogs');
    await member.getByRole('button', { name: 'New Post' }).click();
    await member.getByLabel('Title *').fill(title);
    await member.getByLabel('Content *').fill('We cleaned the beach together.');

    // The cover, then two more photos.
    await member.locator('input[type="file"]').first().setInputFiles(UPLOAD_FILE);
    await expect(member.locator('img[src^="/api/media/"]').first()).toBeVisible();
    await member.locator('input[type="file"][multiple]').setInputFiles([UPLOAD_FILE, UPLOAD_FILE]);
    await expect(member.locator('img[src^="/api/media/"]')).toHaveCount(3);

    await member.getByLabel('Status').selectOption('pending_review');
    await member.getByRole('button', { name: 'Submit for Review' }).click();
    await expect(member.getByRole('heading', { name: title })).toBeVisible();
    expect(errors).toEqual([]);

    const curator = await (await browser.newContext()).newPage();
    await signIn(curator, PEOPLE.curator);
    await curator.goto('/en/dashboard/curator/blogs');
    const row = curator.locator('div').filter({ has: curator.getByRole('heading', { name: title }) }).last();
    await row.locator('..').getByRole('button', { name: 'Publish' }).click();

    await expect(async () => {
      await curator.goto('/en/news');
      await expect(curator.getByRole('link', { name: new RegExp(title) }).locator('img[src*="api%2Fmedia"]')).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 90_000 });

    await curator.getByRole('link', { name: new RegExp(title) }).click();
    await expect(curator.locator('article figure img[src^="/api/media/"]')).toBeVisible();
    await expect(curator.getByRole('heading', { name: 'Gallery' })).toBeVisible();
  });
});

test.describe('Hub Activities', () => {
  const title = 'Beach clean-up workshop';

  test('a Shaper proposes, a curator declines with a note, and the second try goes live', async ({ browser }) => {
    const shaper = await (await browser.newContext()).newPage();
    const errors = watchErrors(shaper);
    await signIn(shaper, PEOPLE.shaper);
    await shaper.goto('/en/dashboard/shaper/activities');
    await expect(shaper.getByText('Nothing here yet')).toBeVisible();

    // The whole form, as a lead has it.
    await shaper.getByRole('button', { name: 'Propose an activity or workshop' }).first().click();
    const editor = shaper.getByRole('dialog');
    await expect(editor.getByRole('button', { name: 'Send for approval' })).toBeDisabled();
    await editor.getByLabel('Title *').fill(title);
    await editor.getByLabel('Type').selectOption('workshop');
    await editor.getByLabel('Description').fill('Bring gloves.');
    await editor.getByLabel('Date').fill('December 5, 2026');
    await editor.getByLabel('Location').fill('Obhur');
    await editor.locator('input[type="file"]').first().setInputFiles(UPLOAD_FILE);
    await expect(editor.locator('img[src^="/api/media/"]').first()).toBeVisible();

    // A link that can't work is caught here, and one with no https:// is fixed.
    await editor.getByLabel('CTA Button URL').fill('not a link at all');
    await editor.getByRole('button', { name: 'Send for approval' }).click();
    await expect(editor.getByRole('alert')).toContainText("isn't a valid web address");
    await editor.getByLabel('CTA Button URL').fill('example.org/join');
    await editor.getByRole('button', { name: 'Send for approval' }).click();

    await expect(shaper.getByRole('status').filter({ hasText: 'Sent.' })).toBeVisible();
    await expect(shaper.getByText('Awaiting Review')).toBeVisible();
    await expect(shaper.getByText(title)).toBeVisible();

    // An impact officer can read a proposal for the whole hub but not decide it.
    const impact = await (await browser.newContext()).newPage();
    await signIn(impact, PEOPLE.impact);
    await impact.goto('/en/dashboard/curator/activities');
    await expect(impact.getByText(title)).toBeVisible();
    await expect(impact.getByText('Only the Curator or Vice Curator can approve this one.')).toBeVisible();
    await impact.getByRole('button', { name: 'View Details' }).click();
    await expect(impact.getByRole('dialog').getByRole('button', { name: 'Approve' })).toHaveCount(0);

    // The curator sees all of it, and declines with a note.
    const curator = await (await browser.newContext()).newPage();
    acceptDialogs(curator);
    await signIn(curator, PEOPLE.curator);
    await curator.goto('/en/dashboard/curator/activities');
    await curator.getByRole('button', { name: 'Review' }).click();
    const review = curator.getByRole('dialog');
    await expect(review).toContainText('Sami Shaper');
    await expect(review).toContainText('The whole hub');
    await expect(review).toContainText('https://example.org/join');
    await expect(review).toContainText('Bring gloves.');
    await review.getByLabel(/Note to the sender/).fill('Please add a time.');
    await review.getByRole('button', { name: 'Decline' }).click();
    await expect(curator.getByText('Waiting for review')).toHaveCount(0);

    // The Shaper sees why, fixes it and sends it again.
    await shaper.reload();
    await expect(shaper.getByText('Declined')).toBeVisible();
    await expect(shaper.getByText('Please add a time.')).toBeVisible();
    await shaper.getByRole('button', { name: 'Edit and send again' }).click();
    await shaper.getByRole('dialog').getByLabel('Date').fill('December 5, 2026, 9 am');
    await shaper.getByRole('dialog').getByRole('button', { name: 'Send for approval' }).click();
    await expect(shaper.getByText('Awaiting Review')).toBeVisible();

    // A member can't reach the curators' page.
    await shaper.goto('/en/dashboard/curator/activities');
    await expect(shaper.getByText(/restricted/i)).toBeVisible();

    await curator.reload();
    await curator.getByRole('button', { name: 'Review' }).click();
    await curator.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(curator.getByRole('heading', { name: title })).toBeVisible();

    // It's live for visitors, with the proposal's details.
    await expect(async () => {
      const res = await curator.goto('/en/activities/beach-clean-up-workshop');
      expect(res?.status()).toBe(200);
      await expect(curator.getByRole('heading', { name: title })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 90_000 });
    await expect(curator.getByText('Obhur').first()).toBeVisible();

    // The Shaper can now manage it, still through approval.
    await shaper.goto('/en/dashboard/shaper/activities');
    await expect(shaper.getByRole('heading', { name: 'Your activities' })).toBeVisible();
    await shaper.getByRole('button', { name: 'Set Hidden' }).click();
    await expect(shaper.getByText('A change to this activity is awaiting approval.')).toBeVisible();

    await curator.goto('/en/dashboard/curator/activities');
    await curator.getByRole('button', { name: 'Review' }).click();
    const change = curator.getByRole('dialog');
    await expect(change).toContainText('What would change');
    await expect(change).not.toContainText('Bring gloves.');
    await change.getByRole('button', { name: 'Approve' }).click();
    await expect(curator.getByText('Waiting for review')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a lead can tie a proposal to their initiative, and an impact officer can decide that one', async ({ browser }) => {
    const lead = await (await browser.newContext()).newPage();
    await signIn(lead, PEOPLE.lead);
    await lead.goto('/en/dashboard/shaper/activities');
    await lead.getByRole('button', { name: 'Propose an activity or workshop' }).first().click();
    const editor = lead.getByRole('dialog');
    await expect(editor.getByLabel('Who is it for?')).toHaveValue('green-jeddah');
    await editor.getByLabel('Title *').fill('Tree planting day');
    await editor.getByRole('button', { name: 'Send for approval' }).click();
    await expect(lead.getByText('Tree planting day')).toBeVisible();

    const impact = await (await browser.newContext()).newPage();
    await signIn(impact, PEOPLE.impact);
    await impact.goto('/en/dashboard/curator/activities');
    await impact.getByRole('button', { name: 'Review' }).click();
    await expect(impact.getByRole('dialog')).toContainText('Green Jeddah');
    await impact.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(impact.getByRole('heading', { name: 'Tree planting day' })).toBeVisible();
  });

  test('an unsent proposal survives a reload', async ({ page }) => {
    await signIn(page, PEOPLE.signer);
    await page.goto('/en/dashboard/shaper/activities');
    await page.getByRole('button', { name: 'Propose an activity or workshop' }).first().click();
    await page.getByRole('dialog').getByLabel('Title *').fill('Half-written idea');
    await page.waitForTimeout(800);
    await page.reload();
    await page.getByRole('button', { name: 'Propose an activity or workshop' }).first().click();
    await expect(page.getByRole('dialog').getByLabel('Title *')).toHaveValue('Half-written idea');
    await expect(page.getByText('Your unsent proposal was restored.')).toBeVisible();
    await page.getByRole('button', { name: 'Start over' }).click();
    await expect(page.getByRole('dialog').getByLabel('Title *')).toHaveValue('');
  });
});

test.describe('Active Projects', () => {
  for (const screen of [{ width: 390, height: 844 }, { width: 900, height: 800 }, { width: 1366, height: 800 }]) {
    test(`projects have room at ${screen.width}px wide, with the team panel open`, async ({ page }) => {
      await page.setViewportSize(screen);
      await signIn(page, PEOPLE.lead);
      await page.goto('/en/dashboard/shaper/my-projects');
      await expect(page.getByText('Clean Shores')).toBeVisible();

      // Opening the team panel doesn't stretch the project's photo.
      const photo = page.locator('[class*="leadCard"] [class*="cardBanner"]');
      const before = (await photo.boundingBox())!;
      await page.getByRole('button', { name: /^Members/ }).click();
      await expect(page.getByRole('button', { name: /Request to Add a Member/ })).toBeVisible();
      const after = (await photo.boundingBox())!;
      expect(Math.round(after.height)).toBe(Math.round(before.height));

      // Each project uses the whole width of the page instead of a narrow column.
      const widths = await page.locator('main h3').evaluateAll(titles => titles.map(h => {
        const card = h.closest('[class*="leadCard"], [class*="card_"], a')!;
        return card.getBoundingClientRect().width / card.parentElement!.getBoundingClientRect().width;
      }));
      expect(widths.length).toBeGreaterThanOrEqual(2);
      for (const share of widths) expect(share).toBeGreaterThan(0.98);
      await expectNoSidewaysScroll(page);
    });
  }
});

test('a lead finds a member to add by typing, in English or Arabic', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, PEOPLE.lead);
  await page.goto('/en/dashboard/shaper/my-projects');
  await page.getByRole('button', { name: /^Members/ }).click();
  await page.getByRole('button', { name: /Request to Add a Member/ }).click();

  const search = page.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('سامي');
  await expect(page.getByRole('option')).toHaveText([/Sami Shaper/]);
  await search.fill('sara');
  await expect(page.getByRole('option')).toHaveText([/Sara Signer/]);
  // People already on the team aren't offered.
  await search.fill('lena');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect(page.getByText('No matches')).toBeVisible();

  // The results are not cut off at the bottom of the page.
  await search.fill('sa');
  const lastResult = page.getByRole('option').last();
  await lastResult.scrollIntoViewIfNeeded();
  const box = (await lastResult.boundingBox())!;
  const atThatPoint = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[role=option]') !== null, [box.x + 20, box.y + box.height / 2]);
  expect(atThatPoint).toBe(true);

  await search.fill('sara');
  await page.getByRole('option', { name: /Sara Signer/ }).click();
  await page.getByRole('button', { name: 'Send Request' }).click();
  await expect(page.getByText('Sara Signer')).toBeVisible();
  await expectNoSidewaysScroll(page);

  // Asked for once: not offered a second time.
  await page.getByRole('button', { name: /Request to Add a Member/ }).click();
  await page.getByRole('combobox').fill('sara');
  await expect(page.getByRole('option')).toHaveCount(0);
});

test.describe('every dashboard page on a phone and a desktop', () => {
  const ROLE_PAGES = {
    curator: ['', '/shaper/profile', '/shaper/my-projects', '/curator/members', '/curator/initiatives', '/curator/roster',
      '/curator/blogs', '/curator/messages', '/curator/activities', '/curator/exports', '/shaper/charter'],
    impact: ['', '/impact/projects', '/impact/blogs', '/curator/activities', '/shaper/charter'],
    shaper: ['', '/shaper/profile', '/shaper/my-projects', '/shaper/activities', '/shaper/initiatives', '/shaper/blogs', '/shaper/charter'],
  } as const;

  for (const [role, paths] of Object.entries(ROLE_PAGES)) {
    for (const screen of [{ width: 390, height: 844 }, { width: 1366, height: 800 }]) {
      test(`${role}, ${screen.width}px wide`, async ({ page }) => {
        await page.setViewportSize(screen);
        const errors = watchErrors(page);
        await signIn(page, PEOPLE[role as keyof typeof ROLE_PAGES]);
        for (const path of paths) {
          await page.goto(`/en/dashboard${path}`, { waitUntil: 'load' });
          await expect(page.locator('main').first()).toBeVisible();
          // Give the page's data a moment to arrive before measuring it.
          await page.waitForTimeout(1_200);
          await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
          await expectNoSidewaysScroll(page);
        }
        expect(errors).toEqual([]);
      });
    }
  }
});
