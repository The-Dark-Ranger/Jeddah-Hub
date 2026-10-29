/* Output sanitizers for user-supplied values.
 *
 * Text rendered by React is already escaped, and Firestore has no query
 * language to inject into (queries are structured objects, the equivalent
 * of parameterized queries), so the remaining injection points are values
 * that become something other than text: a link's href, or a cell in a
 * spreadsheet a curator downloads. */

/** A user-entered link, only if it's an http(s) URL; anything else
 *  (javascript:, data:, vbscript:, relative paths) becomes undefined so the
 *  link isn't rendered. A bare "www.example.com" is treated as https. */
export function safeExternalUrl(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  const withScheme = /^www\./i.test(v) ? `https://${v}` : v;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

/** A photo for a CSS background, as url("…"), only in the forms this site
 *  stores (an inline image, its own /api/media or /api/img path, or an
 *  https address) and with no character that could close the url() and
 *  add CSS of its own (e.g. a full-page overlay). Anything else gives
 *  undefined, so no background is set. */
export function cssUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();
  const ok = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)
    || /^\/api\/(?:media|img)\/[A-Za-z0-9_./?=&%-]+$/.test(v)
    || /^https:\/\/[^\s"'()\\<>;{}]+$/.test(v);
  return ok ? `url("${v}")` : undefined;
}

/** A value for an exported spreadsheet / CSV cell. Text that starts with
 *  = + - @ (or a tab / carriage return) is read by Excel and Sheets as a
 *  formula, which can run commands or leak data when a curator opens the
 *  file ("CSV injection"); prefixing an apostrophe keeps it plain text.
 *  Non-strings pass through unchanged. */
export function spreadsheetSafe<T>(value: T): T | string {
  if (typeof value !== 'string') return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
