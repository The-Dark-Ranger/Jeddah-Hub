/* Server only. The Firebase Admin SDK app, built from the service account
 * JSON in the FIREBASE_SERVICE_ACCOUNT environment variable (set in Vercel,
 * never committed, never sent to the browser). Used by the API routes that
 * create member accounts and send invites. */
import { randomInt } from 'node:crypto';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { USE_EMULATORS } from './emulators';

let warned = false;
/** A deployed site without the service account silently loses every limit
 *  that holds across servers and every account route, so say so once per
 *  server in its logs. */
function missing(reason: string): null {
  if (!warned && process.env.NODE_ENV === 'production') {
    warned = true;
    console.error(`[firebase-admin] ${reason}: account routes and shared rate limits are off`);
  }
  return null;
}

/** The Admin app, or null when FIREBASE_SERVICE_ACCOUNT isn't configured. */
export function adminApp(): App | null {
  const existing = getApps().find(a => a.name === 'member-admin');
  if (existing) return existing;
  // The emulators need no credentials; the SDK finds them from the environment.
  if (USE_EMULATORS) return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }, 'member-admin');
  // Tolerate a byte-order mark or stray whitespace: values piped in from a
  // Windows shell (e.g. `... | vercel env add`) arrive with a leading BOM.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.replace(/^﻿/, '').trim();
  if (!raw) return missing('FIREBASE_SERVICE_ACCOUNT is not set');
  try {
    const sa = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!sa.client_email || !sa.private_key) return missing('FIREBASE_SERVICE_ACCOUNT lacks client_email or private_key');
    return initializeApp({
      credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key.replace(/\\n/g, '\n') }),
    }, 'member-admin');
  } catch {
    return missing('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
  }
}

// No 0/O, 1/I/L: easy to read out loud or copy by hand.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A fresh one-time password for a new member, e.g. "Tmp-7KQ4-MX9P-R2WD"
 *  (about 59 bits of randomness). The "Tmp-" shape is how the sign-in page
 *  knows to make the member choose their own password (isTemporaryPassword). */
export function generateTempPassword(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `Tmp-${group()}-${group()}-${group()}`;
}
