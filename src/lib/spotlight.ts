import { doc, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/* The big "Spotlight" card at the top of the public Initiatives page.
 * At most one initiative carries `spotlight: true`; curators, vice curators
 * and impact officers pick it from their dashboards. With none picked the
 * page shows no Spotlight card. */

/** Asks the server to drop the public pages' cached data so the change
 *  shows on the next visit. Best-effort: otherwise it shows within a minute. */
export async function refreshPublicPages() {
  try {
    const idToken = await auth?.currentUser?.getIdToken();
    if (!idToken) return;
    await fetch('/api/revalidate', { method: 'POST', headers: { Authorization: `Bearer ${idToken}` } });
  } catch { /* best-effort */ }
}

/** Puts `id` in the spotlight (or clears it with null), taking it off
 *  whichever initiative had it. */
export async function setSpotlight(id: string | null, all: { id: string; spotlight?: boolean }[]) {
  const batch = writeBatch(db);
  for (const i of all) {
    if (i.spotlight && i.id !== id) batch.update(doc(db, 'initiatives', i.id), { spotlight: false });
  }
  if (id) batch.update(doc(db, 'initiatives', id), { spotlight: true, spotlightAt: new Date().toISOString() });
  await batch.commit();
  await refreshPublicPages();
}
