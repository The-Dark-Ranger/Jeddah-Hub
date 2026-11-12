/* The site's own safety helpers, tested directly (no browser needed): what
 * emails do with a name a person typed, and which photo addresses a page
 * will load. */
import { expect, test } from '@playwright/test';
import { inviteRecord, memberInvite } from '../../src/lib/emails/invite';
import { newsletterWelcome } from '../../src/lib/emails/newsletter';
import { safeImageSrc } from '../../src/lib/sanitize';
import { PHOTO_PATH, PHOTO_URI } from './helpers';

test('emails escape a typed name in the HTML and show it as typed in plain text', () => {
  const invite = memberInvite({ lang: 'en', email: 'sam@example.com', name: "O'Brien <b>Sam</b>", role: 'shaper', tempPassword: null });
  expect(invite.html).toContain('Welcome to Jeddah Hub, O&#39;Brien!');
  expect(invite.text).toContain("Welcome to Jeddah Hub, O'Brien!");
  expect(invite.text).toContain('You have been added to the Jeddah Hub dashboard as Global Shaper.');
  expect(invite.text).not.toMatch(/<\/?strong>|&#39;|&amp;/);

  // The hub's record carries the name in its title, hidden preview line and body.
  const record = inviteRecord({
    email: 'x@example.com', name: '<img src=x onerror=alert(1)>', role: 'shaper', lang: 'en',
    withPassword: false, sentBy: 'Cara', inviteCount: 1,
  });
  expect(record.html).not.toContain('<img src=x');
  expect(record.html).toContain('&lt;img src=x onerror=alert(1)&gt;');

  const welcome = newsletterWelcome('en', 'new@example.com');
  expect(welcome.html).toContain('<strong>Jeddah Hub newsletter</strong>');
  expect(welcome.text).toContain('Thank you for joining the Jeddah Hub newsletter.');
  expect(welcome.text).not.toContain('<strong>');
});

test('only photo addresses are loaded as photos', () => {
  for (const ok of [PHOTO_PATH, PHOTO_URI, '/api/img/initiatives/abc/images.2?v=Xy-1', 'https://example.com/a.jpg', 'http://example.com/a.png']) {
    expect(safeImageSrc(ok), ok).toBe(ok);
  }
  expect(safeImageSrc('www.example.com/a.jpg')).toBe('https://www.example.com/a.jpg');
  for (const bad of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=',
    'vbscript:x', '//evil.example/a.png', '/api/other', 'not a url', '', null, 42]) {
    expect(safeImageSrc(bad), String(bad)).toBeUndefined();
  }
});
