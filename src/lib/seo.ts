/** Canonical production domain — already the address used throughout the
 *  transactional emails (welcome, invite, newsletter notify), so this is
 *  the single place other SEO code (sitemap, robots, per-page canonical
 *  URLs) should read it from instead of repeating the literal string. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://jeddahhub.org';

export const LOCALES = ['en', 'ar'] as const;

/** `alternates.languages` map for a given path, e.g. alternateLanguages('/about')
 *  → { en: '/en/about', ar: '/ar/about' }. Matches the shape Next's Metadata
 *  API expects directly. */
export function alternateLanguages(path: string): Record<string, string> {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return Object.fromEntries(LOCALES.map(l => [l, `/${l}${clean === '/' ? '' : clean}`]));
}
