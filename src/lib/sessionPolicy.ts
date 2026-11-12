/* How long a member's sign-in lasts, shared by the browser, the server
 * (serverAuth.ts) and, as the same numbers, firestore.rules.
 *
 *  - Every sign-in ends 14 days after the password was typed, whatever the
 *    device. The database and the server refuse an older session, so this
 *    holds even if the page's own check is bypassed.
 *  - "Keep me signed in" unticked (a shared computer): the session also ends
 *    after 30 minutes without any activity, and when the browser closes.
 *  - A curator sending a new password, or removing a member, ends that
 *    member's sessions everywhere at once (session_revocations in the
 *    database, checked by the rules on every read and write). */
const MAX_SESSION_DAYS = 14;
export const MAX_SESSION_MS = MAX_SESSION_DAYS * 24 * 60 * 60_000;
export const IDLE_LIMIT_MS = 30 * 60_000;

/** The "Keep me signed in" choice, remembered on this device (not a secret). */
export const KEEP_KEY = 'jh-keep-signed-in';
/** When this device last saw the member do something (any tab). */
const LAST_ACTIVE_KEY = 'jh-last-active';
/** Why the session was just ended, for the login page to explain. */
const REASON_KEY = 'jh-signout-reason';

export type SignOutReason = 'idle' | 'expired' | 'revoked';

/** Ticked unless this device chose otherwise. On the server (no storage
 *  there; newer Node versions warn when it is touched) always ticked. */
export function readKeep(): boolean {
  if (typeof window === 'undefined') return true;
  try { return localStorage.getItem(KEEP_KEY) !== '0'; } catch { return true; }
}

export function markActive() {
  try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch { /* storage blocked */ }
}

export function lastActive(): number {
  try { return Number(localStorage.getItem(LAST_ACTIVE_KEY)) || 0; } catch { return 0; }
}

export function setSignOutReason(reason: SignOutReason) {
  try { sessionStorage.setItem(REASON_KEY, reason); } catch { /* storage blocked */ }
}

/** A kept session ended without the member signing out: Firebase found it
 *  cut off (a new password, a removal). Noted unless a reason is already. */
export function noteEndedElsewhere() {
  try { if (!sessionStorage.getItem(REASON_KEY)) sessionStorage.setItem(REASON_KEY, 'revoked'); } catch { /* storage blocked */ }
}

/** Reads and forgets the reason, so it's shown once. A second read straight
 *  after (React runs effects twice in development) gets the same answer. */
let lastTaken: { reason: SignOutReason | null; at: number } = { reason: null, at: 0 };
export function takeSignOutReason(): SignOutReason | null {
  if (Date.now() - lastTaken.at < 1000) return lastTaken.reason;
  let reason: SignOutReason | null = null;
  try {
    const r = sessionStorage.getItem(REASON_KEY);
    sessionStorage.removeItem(REASON_KEY);
    reason = r === 'idle' || r === 'expired' || r === 'revoked' ? r : null;
  } catch { /* storage blocked */ }
  lastTaken = { reason, at: Date.now() };
  return reason;
}
