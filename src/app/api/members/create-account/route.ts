import { NextRequest, NextResponse } from 'next/server';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireRole } from '@/lib/serverAuth';
import { readJsonBody } from '@/lib/http';
import { isValidEmail } from '@/lib/validateEmail';
import { isRateLimited } from '@/lib/rateLimit';
import { MEMBER_ROLES, type MemberRole } from '@/lib/memberAccounts';
import { adminApp, generateTempPassword } from '@/lib/firebaseAdmin';

/* Creates a member's Firebase sign-in account with the temporary password,
 * and lists them on the public Who We Are page straight away.
 *
 * Public sign-up is (rightly) disabled on the Firebase project, so accounts
 * can only be created with admin rights: this route uses the Admin SDK with
 * the service account in FIREBASE_SERVICE_ACCOUNT, and only for a signed-in
 * curator or vice curator.
 *
 * Alongside the account it writes users/{uid} (role + name) and the public
 * mirror public_profiles/{uid} (name + role only, never email, see
 * firestore.rules), so the member appears under their role without having
 * to fill in their own profile first. A member who already has a users doc
 * keeps their role and any name they set themselves; only blanks are filled.
 *
 * `action: 'remove'` undoes this for a pending member removed from Role
 * Assignments, but only if they have never signed in, so it can never
 * delete a real member's account or profile. */

/** Fills in users/{uid} and public_profiles/{uid} for a newly added member. */
async function upsertProfile(app: App, uid: string, email: string, displayName: string, role: MemberRole) {
  const db = getFirestore(app);
  const userRef = db.doc(`users/${uid}`);
  const publicRef = db.doc(`public_profiles/${uid}`);
  await db.runTransaction(async tx => {
    const [userSnap, publicSnap] = await Promise.all([tx.get(userRef), tx.get(publicRef)]);
    const existing = userSnap.data() ?? {};
    const effectiveRole = (existing.role as string | undefined) || role;
    const name = (existing.displayName as string | undefined) || displayName;

    if (!userSnap.exists) {
      tx.set(userRef, { uid, email, role, displayName: displayName || null, createdAt: new Date().toISOString() });
    } else {
      const fill: Record<string, string> = {};
      if (!existing.role) fill.role = role;
      if (!existing.displayName && displayName) fill.displayName = displayName;
      if (Object.keys(fill).length) tx.set(userRef, fill, { merge: true });
    }

    const pub: Record<string, string> = { role: effectiveRole };
    if (!publicSnap.data()?.displayName && name) pub.displayName = name;
    tx.set(publicRef, pub, { merge: true });
  });
}

/** Removes a never-signed-in member's account and profile. */
async function removePending(app: App, email: string, callerRole: string | undefined): Promise<'removed' | 'kept' | 'not-found'> {
  const auth = getAuth(app);
  let record;
  try {
    record = await auth.getUserByEmail(email);
  } catch {
    return 'not-found';
  }
  if (record.metadata.lastSignInTime) return 'kept';
  const db = getFirestore(app);
  // Only the Curator may remove a curator's account.
  const target = (await db.doc(`users/${record.uid}`).get()).data();
  if (target?.role === 'curator' && callerRole !== 'curator') return 'kept';
  await Promise.all([db.doc(`public_profiles/${record.uid}`).delete(), db.doc(`users/${record.uid}`).delete()]);
  await auth.deleteUser(record.uid);
  return 'removed';
}

/** Gives a never-signed-in member a new one-time password (e.g. the first
 *  one was lost). Anyone who has signed in keeps their own password. */
async function resetTempPassword(app: App, email: string, callerRole: string | undefined): Promise<{ result: 'reset' | 'kept' | 'not-found'; tempPassword?: string }> {
  const auth = getAuth(app);
  let record;
  try {
    record = await auth.getUserByEmail(email);
  } catch {
    return { result: 'not-found' };
  }
  if (record.metadata.lastSignInTime) return { result: 'kept' };
  const target = (await getFirestore(app).doc(`users/${record.uid}`).get()).data();
  if (target?.role === 'curator' && callerRole !== 'curator') return { result: 'kept' };
  const tempPassword = generateTempPassword();
  await auth.updateUser(record.uid, { password: tempPassword });
  return { result: 'reset', tempPassword };
}

/** Removes a member from the Hub entirely: their sign-in account, private
 *  and public profile, pending role assignment, charter signature, any
 *  initiative they belong to or lead, and their open join/leave requests.
 *  Never the caller themselves; only the Curator can remove a curator. */
async function deleteMember(app: App, uid: string, caller: { uid: string; role?: string }): Promise<'removed' | 'kept' | 'not-found'> {
  if (uid === caller.uid) return 'kept';
  const db = getFirestore(app);
  const userRef = db.doc(`users/${uid}`);
  const user = (await userRef.get()).data();
  let email = (user?.email as string | undefined)?.toLowerCase();
  const auth = getAuth(app);
  try {
    email ??= (await auth.getUser(uid)).email?.toLowerCase();
  } catch { /* no sign-in account */ }
  if (!user && !email) return 'not-found';
  if (user?.role === 'curator' && caller.role !== 'curator') return 'kept';

  // Initiatives: drop them from `leads` and from the `members` list.
  const initiatives = await db.collection('initiatives').get();
  const batch = db.batch();
  for (const d of initiatives.docs) {
    const data = d.data();
    const leads = Array.isArray(data.leads) ? data.leads as string[] : [];
    const members = Array.isArray(data.members) ? data.members as { userId?: string }[] : [];
    if (leads.includes(uid) || members.some(m => m?.userId === uid)) {
      batch.update(d.ref, {
        leads: leads.filter(l => l !== uid),
        members: members.filter(m => m?.userId !== uid),
      });
    }
  }
  for (const coll of ['join_requests', 'leave_requests']) {
    const reqs = await db.collection(coll).where('userId', '==', uid).get();
    reqs.docs.forEach(r => batch.delete(r.ref));
  }
  batch.delete(userRef);
  batch.delete(db.doc(`public_profiles/${uid}`));
  batch.delete(db.doc(`charter_signatures/${uid}`));
  if (email) batch.delete(db.doc(`role_assignments/${email}`));
  await batch.commit();

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if ((err as { code?: string } | null)?.code !== 'auth/user-not-found') throw err;
  }
  return 'removed';
}

export async function POST(req: NextRequest) {
  const caller = await requireRole(req, ['curator', 'vice_curator']);
  if (!caller) return NextResponse.json({ result: 'failed', reason: 'unauthorized' }, { status: 401 });
  if (isRateLimited(`create-account:${caller.uid}`, 30, 60_000)) {
    return NextResponse.json({ result: 'failed', reason: 'rate-limited' }, { status: 429 });
  }

  const body = await readJsonBody(req);

  // Which of these assignment emails have signed in, and when, so Role
  // Assignments can move them out of Pending. Only the sign-in time is
  // returned, nothing else about the account.
  if (body?.action === 'signin-status') {
    const emails = Array.isArray(body.emails)
      ? [...new Set(body.emails.filter((e): e is string => typeof e === 'string' && isValidEmail(e)).map(e => e.toLowerCase()))].slice(0, 500)
      : [];
    const app = adminApp();
    if (!app) return NextResponse.json({ result: 'failed', reason: 'not-configured' }, { status: 503 });
    const signedIn: Record<string, string> = {};
    try {
      for (let i = 0; i < emails.length; i += 100) {
        const { users } = await getAuth(app).getUsers(emails.slice(i, i + 100).map(email => ({ email })));
        for (const u of users) {
          if (u.email && u.metadata.lastSignInTime) signedIn[u.email.toLowerCase()] = new Date(u.metadata.lastSignInTime).toISOString();
        }
      }
    } catch (err) {
      console.error('signin-status failed:', (err as { code?: string } | null)?.code);
      return NextResponse.json({ result: 'failed' }, { status: 500 });
    }
    return NextResponse.json({ result: 'ok', signedIn });
  }

  // Remove a member who already has an account (Members list).
  if (body?.action === 'delete-member') {
    const uid = typeof body.uid === 'string' && /^[A-Za-z0-9]{6,128}$/.test(body.uid) ? body.uid : '';
    const app = adminApp();
    if (!app) return NextResponse.json({ result: 'failed', reason: 'not-configured' }, { status: 503 });
    if (!uid) return NextResponse.json({ result: 'failed', reason: 'invalid-uid' }, { status: 400 });
    try {
      return NextResponse.json({ result: await deleteMember(app, uid, caller) });
    } catch (err) {
      console.error('delete-member failed:', (err as { code?: string } | null)?.code);
      return NextResponse.json({ result: 'failed' }, { status: 500 });
    }
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidEmail(email)) return NextResponse.json({ result: 'failed', reason: 'invalid-email' }, { status: 400 });

  const app = adminApp();
  if (!app) return NextResponse.json({ result: 'failed', reason: 'not-configured' }, { status: 503 });

  if (body?.action === 'reset-temp') {
    try {
      return NextResponse.json(await resetTempPassword(app, email, caller.role));
    } catch (err) {
      console.error('reset-temp failed:', (err as { code?: string } | null)?.code);
      return NextResponse.json({ result: 'failed' }, { status: 500 });
    }
  }

  if (body?.action === 'remove') {
    try {
      return NextResponse.json({ result: await removePending(app, email, caller.role) });
    } catch (err) {
      console.error('remove-pending failed:', (err as { code?: string } | null)?.code);
      return NextResponse.json({ result: 'failed' }, { status: 500 });
    }
  }

  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 100) : '';
  const role = MEMBER_ROLES.find(r => r === body?.role);
  if (!role) return NextResponse.json({ result: 'failed', reason: 'invalid-role' }, { status: 400 });
  // Only the Curator can make someone a curator (matches firestore.rules).
  if (role === 'curator' && caller.role !== 'curator') {
    return NextResponse.json({ result: 'failed', reason: 'forbidden-role' }, { status: 403 });
  }

  const auth = getAuth(app);
  let uid: string;
  let result: 'created' | 'exists';
  // Shown once to the curator (and sent with the invite); never stored.
  let tempPassword: string | undefined = generateTempPassword();
  try {
    uid = (await auth.createUser({ email, password: tempPassword, emailVerified: false })).uid;
    result = 'created';
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code !== 'auth/email-already-exists') {
      console.error('create-account failed:', code);
      return NextResponse.json({ result: 'failed', reason: code ?? 'unknown' }, { status: 500 });
    }
    uid = (await auth.getUserByEmail(email)).uid;
    result = 'exists';
    tempPassword = undefined;
  }

  // The account exists either way; a profile failure is reported but
  // doesn't undo it (the member's own first sign-in also fills these in).
  let listed = true;
  try {
    await upsertProfile(app, uid, email, displayName, role);
  } catch (err) {
    listed = false;
    console.error('create-account: profile write failed:', (err as { code?: string } | null)?.code);
  }
  return NextResponse.json({ result, listed, tempPassword });
}
