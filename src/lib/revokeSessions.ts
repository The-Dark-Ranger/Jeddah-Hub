/* Signs a member out everywhere, at once (server only).
 *
 * Firebase's own revocation stops a session from renewing, but the access
 * token it already holds would still work for up to an hour. So the time is
 * also written to session_revocations/{uid}, which firestore.rules checks on
 * every read and write: any sign-in from before it is refused straight away.
 * Browsers can't read or change that collection (no rule matches it). */
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export async function revokeSessions(app: App, uid: string): Promise<void> {
  // Seconds, like the token's auth_time: a sign-in in a later second passes.
  const at = Math.floor(Date.now() / 1000);
  await getFirestore(app).doc(`session_revocations/${uid}`).set({ at });
  try {
    await getAuth(app).revokeRefreshTokens(uid);
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== 'auth/user-not-found') throw err;
  }
}
