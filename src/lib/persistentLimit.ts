/* Rate limits that hold across every server instance (the in-memory ones in
 * rateLimit.ts only see one instance). Each key is a counter in the
 * Firestore `rate_limits` collection, which browsers can't read or write
 * (no rule matches it). Keys are hashed, so no IP or email is stored, and
 * each counter carries `expiresAt`. Firestore's own expiry (TTL) needs a
 * paid plan, so expired counters are removed here, a few at a time. */
import { createHash } from 'node:crypto';
import { after } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { adminApp } from './firebaseAdmin';

export const HOUR = 60 * 60_000;
export const DAY = 24 * HOUR;

/** Counts one use of `key`; false once it has been used `limit` times
 *  within `windowMs`. If the store fails, it allows the request (reCAPTCHA
 *  and the in-memory limits still apply) unless `failClosed` is set, for
 *  limits that guard something costly, such as the email budget. */
export async function withinLimit(
  key: string, limit: number, windowMs: number, { failClosed = false } = {},
): Promise<boolean> {
  const uses = await countUse(key, limit, windowMs);
  return uses === null ? !failClosed : uses <= limit;
}

/** Counts one use of `key` and returns how many uses its window now holds
 *  (limit + 1 once it's over: refused uses aren't stored). 0 when there is
 *  no store configured (local runs); null when the store failed. */
export async function countUse(key: string, limit: number, windowMs: number): Promise<number | null> {
  const app = adminApp();
  if (!app) return 0;
  sweepExpired();
  const db = getFirestore(app);
  const ref = db.collection('rate_limits').doc(createHash('sha256').update(key).digest('hex').slice(0, 40));
  try {
    return await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const start = snap.exists ? Number(snap.get('start')) || 0 : 0;
      const fresh = !snap.exists || now - start >= windowMs;
      const count = fresh ? 1 : (Number(snap.get('count')) || 0) + 1;
      if (!fresh && count > limit) return limit + 1;
      const windowStart = fresh ? now : start;
      tx.set(ref, { start: windowStart, count, expiresAt: Timestamp.fromMillis(windowStart + windowMs) });
      return count;
    });
  } catch (err) {
    console.error('[limit] store unavailable', err);
    return null;
  }
}

/** The day's budget for emails a visitor can trigger (receipts, welcomes,
 *  activity confirmations), so a flood can never use up the email quota
 *  or the domain's reputation. EMAIL_DAILY_LIMIT, default 200. If the
 *  counter can't be read, no email is sent. */
export function withinEmailBudget(): Promise<boolean> {
  const limit = Number(process.env.EMAIL_DAILY_LIMIT) || 200;
  return withinLimit(`email-budget:${new Date().toISOString().slice(0, 10)}`, limit, DAY, { failClosed: true });
}

/** About one call in 25 also deletes up to 50 counters whose window has
 *  ended, after the response has been sent, so the collection doesn't keep
 *  growing. */
function sweepExpired() {
  if (Math.random() > 0.04) return;
  try {
    after(async () => {
      const app = adminApp();
      if (!app) return;
      const db = getFirestore(app);
      const old = await db.collection('rate_limits').where('expiresAt', '<', Timestamp.now()).limit(50).get().catch(() => null);
      if (!old || old.empty) return;
      const batch = db.batch();
      old.docs.forEach(d => batch.delete(d.ref));
      await batch.commit().catch(() => {});
    });
  } catch { /* outside a request: nothing to schedule */ }
}
