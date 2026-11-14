/* Server-side checks for API routes: verifies a Firebase ID token and the
 * caller's role. The same session rules as firestore.rules: a confirmed
 * email address, signed in within the last 14 days, and not signed out
 * everywhere since (a new password or a removal, session_revocations). */
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { FIRESTORE_REST, USE_EMULATORS } from './emulators';
import { normalizeRole } from './role';
import { MAX_SESSION_MS } from './sessionPolicy';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

interface VerifiedCaller {
  uid: string;
  email: string | null;
  /** Normalized stored role (set by requireRole). */
  role?: string;
}

/** Verifies a Firebase Auth ID token's signature/claims via Google's public
 *  JWKS, no firebase-admin/service-account needed. Only a confirmed email
 *  address passes, unless `unconfirmed` asks for one that isn't confirmed
 *  yet (the one thing such a session may do: ask for the confirmation link). */
async function verifyIdToken(idToken: string, { unconfirmed = false } = {}): Promise<(VerifiedCaller & { authTime: number }) | null> {
  if (!PROJECT_ID) return null;
  try {
    // The Auth emulator's tokens aren't signed. See emulators.ts: this branch
    // doesn't exist in a production build.
    const payload = USE_EMULATORS
      ? decodeJwt(idToken)
      : (await jwtVerify(idToken, JWKS, {
          issuer: `https://securetoken.google.com/${PROJECT_ID}`,
          audience: PROJECT_ID,
          // Firebase ID tokens are always RS256; refuse anything else outright.
          algorithms: ['RS256'],
        })).payload;
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    // An unconfirmed email address gets nothing (and the link only goes to one).
    if ((payload.email_verified === true) === unconfirmed) return null;
    // Neither does a sign-in older than 14 days.
    const authTime = Number(payload.auth_time);
    if (!Number.isFinite(authTime) || Date.now() - authTime * 1000 > MAX_SESSION_MS) return null;
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null, authTime };
  } catch (err) {
    // A bad or expired token is routine; failing to fetch Google's signing
    // keys is an outage worth seeing in the logs.
    const code = String((err as { code?: unknown } | null)?.code ?? '');
    if (code.startsWith('ERR_JWKS')) console.error('[auth] could not check sign-in tokens:', code);
    return null;
  }
}

/**
 * Looks up a verified caller's stored role via the Firestore REST API.
 *
 * users/{uid} is NOT publicly readable (firestore.rules: isOwner(uid) ||
 * isCuratorOrImpact()), so the read is made AS the caller by forwarding their
 * already-verified ID token, reading your own user doc is always allowed.
 * An unauthenticated read here gets a 403, which used to make every role
 * check fail closed (curators could never send invite emails).
 */
async function getCallerRole(uid: string, idToken: string): Promise<string | null> {
  if (!PROJECT_ID) return null;
  try {
    const res = await fetch(
      `${FIRESTORE_REST}/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      // 403/404: no profile or a revoked session, which is routine. Anything
      // else (429, 5xx) means curators are being refused for an outage.
      if (res.status !== 403 && res.status !== 404) console.error('[auth] role lookup failed', res.status);
      return null;
    }
    const data = await res.json();
    const raw = data?.fields?.role?.stringValue;
    return typeof raw === 'string' ? normalizeRole(raw) : null;
  } catch (err) {
    console.error('[auth] role lookup failed', err);
    return null;
  }
}

/** The request's Bearer ID token, or null. Firebase ID tokens are ~1KB;
 *  anything absurd is refused before verifying. */
function bearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  return idToken && idToken.length <= 4096 ? idToken : null;
}

/** Verifies the request's Bearer ID token for a sign-in whose email address
 *  isn't confirmed yet (the confirmation email route). Null for anything
 *  else, including a confirmed address. */
export async function requireUnconfirmedCaller(req: NextRequest): Promise<{ uid: string; email: string } | null> {
  const idToken = bearerToken(req);
  const caller = idToken ? await verifyIdToken(idToken, { unconfirmed: true }) : null;
  return caller?.email ? { uid: caller.uid, email: caller.email } : null;
}

/** Verifies the request's Bearer ID token and checks the caller's stored role is one of `allowedRoles`. */
export async function requireRole(req: NextRequest, allowedRoles: string[]): Promise<VerifiedCaller | null> {
  const idToken = bearerToken(req);
  if (!idToken) return null;

  const caller = await verifyIdToken(idToken);
  if (!caller) return null;

  // Read as the caller, so firestore.rules also applies its session checks
  // (including a revocation since this sign-in) and refuses a stale one.
  const role = await getCallerRole(caller.uid, idToken);
  if (!role || !allowedRoles.includes(role)) return null;

  return { uid: caller.uid, email: caller.email, role };
}
