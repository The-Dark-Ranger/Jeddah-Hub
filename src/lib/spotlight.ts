import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* The big "Spotlight" card at the top of the public Initiatives page.
 * Exactly one initiative carries `spotlight: true`; curators, vice curators
 * and impact officers pick it from their dashboards. With none picked the
 * page falls back to a featured initiative, then the first active one. */

/** Puts `id` in the spotlight (or clears it with null), taking it off
 *  whichever initiative had it. */
export async function setSpotlight(id: string | null, all: { id: string; spotlight?: boolean }[]) {
  const batch = writeBatch(db);
  for (const i of all) {
    if (i.spotlight && i.id !== id) batch.update(doc(db, 'initiatives', i.id), { spotlight: false });
  }
  if (id) batch.update(doc(db, 'initiatives', id), { spotlight: true, spotlightAt: new Date().toISOString() });
  await batch.commit();
}
