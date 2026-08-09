/** Turns a title into a URL-safe slug, kept short enough that the combined
 *  "slug-docId" URL stays reasonable. Non-Latin/Arabic characters (emoji,
 *  punctuation) collapse to hyphens rather than being dropped silently. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents (café -> cafe)
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')           // keep ASCII alnum + Arabic block, rest -> hyphen
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Builds the "readable" project URL segment — the initiative's name
 *  followed by its real Firestore doc ID, e.g. "serene-BODjADl9SEAPOVMe".
 *  The ID suffix is what actually gets looked up (see extractDocId); the
 *  slug is just there so the URL reads as the project's name instead of a
 *  bare opaque ID. Always built from the English title so the same URL
 *  works regardless of which language it was shared from. */
export function projectSlugUrl(id: string, title: string): string {
  const slug = slugify(title || '');
  return slug ? `${slug}-${id}` : id;
}

/** Reverses projectSlugUrl() — Firestore auto-generated doc IDs never
 *  contain a hyphen, so the doc ID is always whatever comes after the
 *  LAST hyphen. A bare doc ID with no hyphen (an old bookmarked link, or
 *  a title that produced an empty slug) round-trips unchanged. */
export function extractDocId(param: string): string {
  const idx = param.lastIndexOf('-');
  return idx === -1 ? param : param.slice(idx + 1);
}
