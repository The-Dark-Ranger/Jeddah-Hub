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

/** Looks up a verified caller's stored role via the Firestore REST API (users/{uid} is publicly readable, so no admin credentials are required). */
async function getCallerRole(uid: string): Promise<string | null> {
  if (!PROJECT_ID) return null;
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
      { cache: 'no-store' }
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
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return null;

  const caller = await verifyIdToken(idToken);
  if (!caller) return null;

  const role = await getCallerRole(caller.uid);
  if (!role || !allowedRoles.includes(role)) return null;

  return caller;
}
