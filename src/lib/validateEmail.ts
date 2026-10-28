/** Shared email format check, anywhere the app collects an address before
 *  writing it to Firestore or sending a real email through it. Besides the
 *  basic shape, it refuses characters that could turn one address into
 *  several or into a display name when used as a recipient or reply-to
 *  (commas, semicolons, angle brackets, quotes, parentheses). */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]{2,}$/;

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.trim().length <= 254 && EMAIL_RE.test(email.trim());
}
