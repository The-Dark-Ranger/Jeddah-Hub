/** Shared email format check, anywhere the app collects an address before
 *  writing it to Firestore or sending a real email through it. The part
 *  before the @ is limited to letters, digits and `. _ + ' -`: that covers
 *  real addresses, and refuses anything that could turn one address into
 *  several, into a display name, or (`? & = % /`) into extra fields of a
 *  mailto: link, such as `name?bcc=someone@else.com`. The domain must be
 *  ordinary labels with a letter TLD (or a punycode one). */
const EMAIL_RE = /^[A-Za-z0-9._+'-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})$/;

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.trim().length <= 254 && EMAIL_RE.test(email.trim());
}
