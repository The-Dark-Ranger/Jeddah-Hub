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
 *  followed by its real doc ID, e.g. "serene--BODjADl9SEAPOVMe". The ID
 *  suffix is what actually gets looked up (see extractDocId); the slug is
 *  just there so the URL reads as the project's name instead of a bare
 *  opaque ID. Always built from the English title so the same URL works
 *  regardless of which language it was shared from.
 *
 *  Uses a double hyphen as the separator, NOT a single one: real Firestore
 *  auto-IDs never contain a hyphen, but the hand-written placeholder
 *  project IDs in src/lib/placeholderProjects.ts do (e.g. "tech-j-shore"),
 *  and slugify() never produces consecutive hyphens — so "--" is the only
 *  boundary that survives every ID shape this app actually uses. */
export function projectSlugUrl(id: string, title: string): string {
  const slug = slugify(title || '');
  return slug ? `${slug}--${id}` : id;
}

/** Reverses projectSlugUrl() — the doc ID is whatever comes after the LAST
 *  "--". A bare doc ID with no "--" (an old bookmarked link, a title that
 *  produced an empty slug, or a placeholder ID visited directly) round-trips
 *  unchanged. */
export function extractDocId(param: string): string {
  const idx = param.lastIndexOf('--');
  return idx === -1 ? param : param.slice(idx + 2);
}
