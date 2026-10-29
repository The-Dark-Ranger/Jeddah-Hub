import { auth } from '@/lib/firebase';

/* Photos live one-per-document in the `media` collection and are served by
 * /api/media/<id>. Keeping them out of the initiative/activity document means
 * neither the 1 MiB Firestore document limit nor a shared photo budget caps
 * how many (or how sharp) the photos can be. Uploads go through POST
 * /api/media, which checks the photo and each member's daily limit. */

const MEDIA_PREFIX = '/api/media/';

export function isMediaUrl(value: string): boolean {
  return value.startsWith(MEDIA_PREFIX);
}

/** Stores a compressed JPEG data URI and returns the URL that serves it.
 *  Throws if the upload is refused (e.g. the daily limit), so callers can
 *  fall back to storing the photo inline. */
export async function uploadMedia(dataUrl: string): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('not-signed-in');
  const res = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ data: dataUrl }),
  });
  const json = await res.json().catch(() => null) as { url?: string } | null;
  if (!res.ok || !json?.url?.startsWith(MEDIA_PREFIX)) throw new Error(`upload-failed-${res.status}`);
  return json.url;
}
