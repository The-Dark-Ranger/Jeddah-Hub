/* POST /api/invite (curators only): emails a member their invitation
 * (src/lib/emails/invite.ts) in the curator's dashboard language, with a
 * fresh one-time password if they have never signed in. */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/serverAuth';
import { isValidEmail } from '@/lib/validateEmail';
import { hasDeliverableDomainWithTimeout } from '@/lib/emailDeliverability';
import { readJsonBody, asString } from '@/lib/http';
import { isRateLimited } from '@/lib/rateLimit';
import { normalizeRole } from '@/lib/role';
import { getAuth } from 'firebase-admin/auth';
import { adminApp, generateTempPassword } from '@/lib/firebaseAdmin';
import { sendEmail, emailConfigured } from '@/lib/email';
import { memberInvite } from '@/lib/emails/invite';

const KNOWN_ROLES = new Set(['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni']);


export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator']);
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Even authenticated curators can only fire a bounded number of invite
  // emails, protects the Resend quota if a session is ever misused.
  if (isRateLimited(`invite:${caller.uid}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await readJsonBody(req);
  const email = body?.email;
  if (typeof email !== 'string' || !isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  const displayName = asString(body?.displayName, 120);
  // Only known roles ever reach the email subject/body.
  const rawRole = typeof body?.role === 'string' ? normalizeRole(body.role) : '';
  const role = KNOWN_ROLES.has(rawRole) ? rawRole : 'shaper';
  if (!(await hasDeliverableDomainWithTimeout(email))) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'No RESEND_API_KEY configured' });
  }

  // A member who has never signed in gets a fresh one-time password with
  // the invite (nothing is stored; this email is the only copy). Anyone who
  // has signed in already has their own password and is just reminded.
  const app = adminApp();
  if (!app) return NextResponse.json({ error: 'Accounts not configured' }, { status: 503 });
  let tempPassword: string | null = null;
  try {
    const record = await getAuth(app).getUserByEmail(email);
    if (!record.metadata.lastSignInTime) {
      tempPassword = generateTempPassword();
      await getAuth(app).updateUser(record.uid, { password: tempPassword });
    }
  } catch {
    // No login yet: the dashboard creates one before inviting, so this
    // only happens if it was removed in between.
    return NextResponse.json({ error: 'no_account' }, { status: 409 });
  }

  const lang = body?.locale === 'ar' ? 'ar' : 'en';
  const result = await sendEmail(memberInvite({ lang, email, name: displayName, role, tempPassword }));
  if (!result.ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  return NextResponse.json({ ok: true, withPassword: !!tempPassword });
}
