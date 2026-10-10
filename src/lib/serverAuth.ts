import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { normalizeRole } from './role';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

interface VerifiedCaller {
  uid: string;
  email: string | null;
}

/** Verifies a Firebase Auth ID token's signature/claims via Google's public JWKS — no firebase-admin/service-account needed. */
async function verifyIdToken(idToken: string): Promise<VerifiedCaller | null> {
  if (!PROJECT_ID) return null;
  try {
    const { payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
  } catch {
    return null;
  }
}

/**
 * Looks up a verified caller's stored role via the Firestore REST API.
 *
 * users/{uid} is NOT publicly readable (firestore.rules: isOwner(uid) ||
 * isCuratorOrImpact()), so the read is made AS the caller by forwarding their
 * already-verified ID token — reading your own user doc is always allowed.
 * An unauthenticated read here gets a 403, which used to make every role
 * check fail closed (curators could never send invite emails).
 */
async function getCallerRole(uid: string, idToken: string): Promise<string | null> {
  if (!PROJECT_ID) return null;
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.fields?.role?.stringValue;
    return typeof raw === 'string' ? normalizeRole(raw) : null;
  } catch {
    return null;
  }
}

/** Verifies the request's Bearer ID token and checks the caller's stored role is one of `allowedRoles`. */
export async function requireRole(req: NextRequest, allowedRoles: string[]): Promise<VerifiedCaller | null> {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  // Firebase ID tokens are ~1KB; reject anything absurd before verifying.
  if (!idToken || idToken.length > 4096) return null;

  const caller = await verifyIdToken(idToken);
  if (!caller) return null;

  const role = await getCallerRole(caller.uid, idToken);
  if (!role || !allowedRoles.includes(role)) return null;

  return caller;
}
