/** Shared email format check — anywhere the app collects an address before
 *  writing it to Firestore or sending a real email through it. */
export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
