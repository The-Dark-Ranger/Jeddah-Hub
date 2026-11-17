/* The site's own safety helpers, tested directly (no browser needed): what
 * emails do with a name a person typed, and which photo addresses a page
 * will load. */
import { expect, test } from '@playwright/test';
import { confirmEmail } from '../../src/lib/emails/confirm';
import { inviteRecord, memberInvite } from '../../src/lib/emails/invite';
import { newsletterConfirm, newsletterWelcome } from '../../src/lib/emails/newsletter';
import { senderCopy } from '../../src/lib/emails/contact';
import { isValidEmail } from '../../src/lib/validateEmail';
import { clientIp } from '../../src/lib/rateLimit';
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

test('the confirmation email comes from the hub, escapes the name, and links to this site', () => {
  const url = 'https://jeddahhub.org/en/login?mode=verifyEmail&oobCode=abc';
  const m = confirmEmail({ lang: 'en', email: 'sam@example.com', name: '<b>Sam</b> Smith', url });
  expect(m.from).toBe('Jeddah Hub <members@jeddahhub.org>');
  expect(m.subject).toBe('Confirm your email address for Jeddah Hub');
  expect(m.html).toContain('Confirm your email address, &lt;b&gt;Sam&lt;/b&gt;');
  expect(m.html).toContain('href="https://jeddahhub.org/en/login?mode=verifyEmail&amp;oobCode=abc"');
  expect(m.html).not.toContain('firebaseapp.com');
  expect(m.text).toContain(url);
  expect(m.text).toContain('You signed in to the Jeddah Hub dashboard as sam@example.com.');
  expect(confirmEmail({ lang: 'ar', email: 'sam@example.com', url }).subject).toBe('أكّد بريدك الإلكتروني في مركز جدة');
});

test('the newsletter welcome offers one-click unsubscribe', () => {
  const links = { page: 'https://jeddahhub.org/en/unsubscribe?id=1&t=2', oneClick: 'https://jeddahhub.org/api/newsletter/unsubscribe?id=1&t=2&l=en' };
  const m = newsletterWelcome('en', 'a@example.com', links);
  expect(m.headers['List-Unsubscribe']).toMatch(/^<https:\/\/jeddahhub\.org\/api\/newsletter\/unsubscribe\?id=1&t=2&l=en>, <mailto:/);
  expect(m.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  expect(m.html).toContain('href="https://jeddahhub.org/en/unsubscribe?id=1&amp;t=2"');
  expect(m.text).toContain(links.page);
  // Without links (older code paths), replying still works.
  expect(newsletterWelcome('en', 'a@example.com').headers['List-Unsubscribe-Post']).toBeUndefined();
});

test('the newsletter confirmation comes from the newsletter address and links to this site', () => {
  const url = 'https://jeddahhub.org/en/newsletter/confirm?id=1&t=2';
  const m = newsletterConfirm('en', 'new@example.com', url);
  expect(m.from).toBe('Jeddah Hub Newsletter <newsletter@jeddahhub.org>');
  expect(m.html).toContain('href="https://jeddahhub.org/en/newsletter/confirm?id=1&amp;t=2"');
  expect(m.text).toContain(url);
  expect(m.text).not.toContain('<strong>');
  // Nothing in it lets someone leave a list they haven't joined yet.
  expect(m.html).not.toContain('unsubscribe');
});

test("the contact receipt doesn't repeat the message, and uses only a short first name", () => {
  const m = senderCopy({
    name: 'Sam Claim your prize now', email: 'sam@example.com', topic: 'general', lang: 'en',
    message: 'Visit example.com to claim your refund', ref: 'abcdefgh1234',
  });
  expect(m.subject).toBe('We received your message (JH-ABCDEFGH)');
  expect(m.text).toContain('Thank you, Sam. We received your message.');
  for (const part of [m.html, m.text]) {
    expect(part).not.toContain('claim your refund');
    expect(part).not.toContain('prize');
  }
});

test('email addresses that could add mailto: fields are refused', () => {
  for (const ok of ['sam@example.com', "o'brien+news@mail.example.co", 'a.b-c_d@example.xn--mgberp4a5d4ar']) expect(isValidEmail(ok), ok).toBe(true);
  for (const bad of ['victim?bcc=me@example.com', 'a&b@example.com', 'a%40b@example.com', 'a/b@example.com', 'a@b', 'a@-b.com', 'a@b.c', 'a b@example.com']) {
    expect(isValidEmail(bad), bad).toBe(false);
  }
});

test('rate limits count an IPv6 client by its /64, not its full address', () => {
  const ip = (real: string) => clientIp(new Request('https://x.test', { headers: { 'x-real-ip': real } }));
  expect(ip('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
  expect(ip('2001:db8:1:2:bbbb:cccc:dddd:eeee')).toBe('2001:db8:1:2::/64');
  expect(ip('2001:db8::1')).toBe('2001:db8:0:0::/64');
  expect(ip('::ffff:203.0.113.9')).toBe('203.0.113.9');
  expect(ip('203.0.113.9')).toBe('203.0.113.9');
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
