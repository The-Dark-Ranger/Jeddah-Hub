/* POST /api/invite (curators only): emails a member their invitation
 * (src/lib/emails/invite.ts) in the curator's dashboard language, with a
 * fresh one-time password if they have never signed in. With
 * `newPassword: true` (Role Assignments → Members) it also gives a member
 * who has signed in before a new one-time password and signs them out
 * everywhere, e.g. one who lost theirs. The password only ever goes to the
 * member's own inbox; the curator never sees it. */
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
import { memberInvite, inviteRecord } from '@/lib/emails/invite';
import { getFirestore } from 'firebase-admin/firestore';
import { withinLimit, DAY } from '@/lib/persistentLimit';

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
  let displayName = asString(body?.displayName, 120);
  // Only known roles ever reach the email subject/body.
  const rawRole = typeof body?.role === 'string' ? normalizeRole(body.role) : '';
  let role = KNOWN_ROLES.has(rawRole) ? rawRole : 'shaper';
  if (!(await withinLimit(`invite:${caller.uid}`, 100, DAY))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
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
  // The saved assignment decides the role and name the email shows, not
  // what the browser sent.
  const assignment = await getFirestore(app).doc(`role_assignments/${email.toLowerCase()}`).get().catch(() => null);
  if (assignment?.exists) {
    const saved = normalizeRole(String(assignment.get('role') ?? ''));
    if (KNOWN_ROLES.has(saved)) role = saved;
    displayName = asString(assignment.get('displayName'), 120) ?? displayName;
  }
  const newPassword = body?.newPassword === true;
  let record;
  try {
    record = await getAuth(app).getUserByEmail(email);
  } catch {
    // No login yet: the dashboard creates one before inviting, so this
    // only happens if it was removed in between.
    return NextResponse.json({ error: 'no_account' }, { status: 409 });
  }
  const signedInBefore = !!record.metadata.lastSignInTime;
  if (newPassword && signedInBefore) {
    // Not for your own account (My Profile changes it), and only the
    // Curator can do it for a curator, as with every curator record.
    if (record.uid === caller.uid) return NextResponse.json({ error: 'self' }, { status: 400 });
    const target = await getFirestore(app).doc(`users/${record.uid}`).get().catch(() => null);
    const targetRole = normalizeRole(String(target?.get('role') ?? ''));
    if (targetRole === 'curator' && caller.role !== 'curator') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    if (KNOWN_ROLES.has(targetRole)) role = targetRole;
  }
  let tempPassword: string | null = null;
  if (!signedInBefore || newPassword) {
    tempPassword = generateTempPassword();
    await getAuth(app).updateUser(record.uid, { password: tempPassword });
    // Whoever had their session (or old password) is signed out everywhere.
    if (signedInBefore) await getAuth(app).revokeRefreshTokens(record.uid);
  }

  const lang = body?.locale === 'ar' ? 'ar' : 'en';
  const result = await sendEmail(memberInvite({ lang, email, name: displayName, role, tempPassword, newPassword: newPassword && signedInBefore }));
  if (!result.ok) return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });

  // Record it: on the assignment (shown in Role Assignments) and as an
  // email to the hub inbox. Best effort; the invite itself has gone out.
  const at = new Date();
  let inviteCount = 1;
  let sentBy = caller.email || caller.uid;
  try {
    const db = getFirestore(app);
    const ref = db.doc(`role_assignments/${email.toLowerCase()}`);
    const [me, count] = await Promise.all([
      db.doc(`users/${caller.uid}`).get(),
      db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists) return 1;
        const n = (Number(snap.get('inviteCount')) || 0) + 1;
        tx.update(ref, { lastInvitedAt: at.toISOString(), inviteCount: n });
        return n;
      }),
    ]);
    inviteCount = count;
    const name = me.get('displayName');
    if (typeof name === 'string' && name) sentBy = `${name} (${caller.email ?? caller.uid})`;
  } catch (err) {
    console.error('[invite] could not record the invite', err);
  }
  await sendEmail(inviteRecord({ email, name: displayName, role, lang, withPassword: !!tempPassword, sentBy, inviteCount, at, newPassword: newPassword && signedInBefore }));

  return NextResponse.json({ ok: true, withPassword: !!tempPassword, lastInvitedAt: at.toISOString(), inviteCount });
}
