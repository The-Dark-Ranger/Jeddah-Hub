import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

/* Photos live one-per-document in the `media` collection and are served by
 * /api/media/<id>. Keeping them out of the initiative/activity document means
 * neither the 1 MiB Firestore document limit nor a shared photo budget caps
 * how many — or how sharp — the photos can be. */

const MEDIA_PREFIX = '/api/media/';

export function isMediaUrl(value: string): boolean {
  return value.startsWith(MEDIA_PREFIX);
}

/** Stores a compressed JPEG data URI and returns the URL that serves it.
 *  Throws if the write is refused (e.g. firestore.rules not yet deployed),
 *  so callers can fall back to storing the photo inline. */
export async function uploadMedia(dataUrl: string): Promise<string> {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('not-signed-in');
  const ref = await addDoc(collection(db, 'media'), {
    data: dataUrl,
    contentType: 'image/jpeg',
    uploadedBy: uid,
    createdAt: new Date().toISOString(),
  });
  return MEDIA_PREFIX + ref.id;
}
