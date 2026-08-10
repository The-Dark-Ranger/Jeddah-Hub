import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Turns a title into a URL-safe slug. Non-Latin/Arabic characters (emoji,
 *  punctuation) collapse to hyphens rather than being dropped silently. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents (café -> cafe)
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')           // keep ASCII alnum + Arabic block, rest -> hyphen
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Computes a Firestore-unique slug for an initiative's title, called at
 *  create/edit time so it can be persisted as the doc's `slug` field —
 *  that's what lets /projects/{slug} resolve via a direct, cheap query
 *  instead of scanning every initiative to find a title match.
 *
 *  Deterministic for an unchanged title: pass the doc's own id as
 *  `excludeId` on an edit so it doesn't collide with itself and keeps the
 *  same slug run after run. On a genuine collision with a DIFFERENT
 *  initiative, appends "-2", "-3", etc. */
export async function uniqueInitiativeSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title) || 'initiative';
  // The whole collection is small (a few dozen docs at most) — fetching it
  // all and comparing client-side is simpler and less fragile than a
  // Firestore prefix-range query, and this only runs on create/edit saves,
  // not on every page view.
  const snap = await getDocs(query(collection(db, 'initiatives')));
  const taken = new Set(
    snap.docs.filter(d => d.id !== excludeId).map(d => (d.data() as any).slug).filter(Boolean)
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
