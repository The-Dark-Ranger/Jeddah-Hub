import { NextRequest, NextResponse } from 'next/server';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { requireRole } from '@/lib/serverAuth';
import { readJsonBody } from '@/lib/http';
import { isValidEmail } from '@/lib/validateEmail';
import { isRateLimited } from '@/lib/rateLimit';
import { DEFAULT_MEMBER_PASSWORD } from '@/lib/memberAccounts';

/* Creates a member's Firebase sign-in account with the temporary password.
 *
 * Public sign-up is (rightly) disabled on the Firebase project, so accounts
 * can only be created with admin rights: this route uses the Admin SDK with
 * the service account in FIREBASE_SERVICE_ACCOUNT, and only for a signed-in
 * curator or vice curator. The member's role still comes solely from their
 * role_assignments document, applied on first sign-in. */

function adminApp(): App | null {
  const existing = getApps().find(a => a.name === 'member-admin');
  if (existing) return existing;
  // Tolerate a byte-order mark or stray whitespace: values piped in from a
  // Windows shell (e.g. `... | vercel env add`) arrive with a leading BOM.
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.replace(/^﻿/, '').trim();
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!sa.client_email || !sa.private_key) return null;
    return initializeApp({
      credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key.replace(/\\n/g, '\n') }),
    }, 'member-admin');
  } catch {
    console.error('create-account: FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    return null;
  }
}

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator']);
  if (!caller) return NextResponse.json({ result: 'failed', reason: 'unauthorized' }, { status: 401 });
  if (isRateLimited(`create-account:${caller.uid}`, 30, 60_000)) {
    return NextResponse.json({ result: 'failed', reason: 'rate-limited' }, { status: 429 });
  }

  const body = await readJsonBody(req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) return NextResponse.json({ result: 'failed', reason: 'invalid-email' }, { status: 400 });

  const app = adminApp();
  if (!app) return NextResponse.json({ result: 'failed', reason: 'not-configured' }, { status: 503 });

  try {
    await getAuth(app).createUser({ email, password: DEFAULT_MEMBER_PASSWORD, emailVerified: false });
    return NextResponse.json({ result: 'created' });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'auth/email-already-exists') return NextResponse.json({ result: 'exists' });
    console.error('create-account failed:', code);
    return NextResponse.json({ result: 'failed', reason: code ?? 'unknown' }, { status: 500 });
  }
}
