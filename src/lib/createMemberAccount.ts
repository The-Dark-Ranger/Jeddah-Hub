/* Browser helpers for Role Assignments. Each one calls the curator-only
 * /api/members/create-account route with the signed-in curator's ID token. */
import { auth } from '@/lib/firebase';
import type { CreateAccountResult, MemberRole } from '@/lib/memberAccounts';

async function post(body: Record<string, unknown>) {
  const idToken = await auth?.currentUser?.getIdToken();
  if (!idToken) return null;
  const res = await fetch('/api/members/create-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  return await res.json().catch(() => null) as { result?: string; reason?: string; tempPassword?: string } | null;
}

/** Creates this member's sign-in account and lists them on the Who We Are
 *  page under `role` with `displayName`. A new account comes back with its
 *  one-time password, which the curator sees once. */
export async function createMemberAccount(email: string, displayName: string, role: MemberRole, hideUntilSignIn = false): Promise<{ result: CreateAccountResult; tempPassword?: string }> {
  try {
    const data = await post({ email, displayName, role, hideUntilSignIn });
    if (data?.reason === 'not-configured') return { result: 'not-configured' };
    const result = data?.result === 'created' || data?.result === 'exists' ? data.result : 'failed';
    return { result, tempPassword: data?.tempPassword };
  } catch {
    return { result: 'failed' };
  }
}

/** A new one-time password for a member who has never signed in. 'kept'
 *  means they already have (they keep their own password) or the server
 *  refused (a curator's account, for a vice curator). */
export async function resetTempPassword(email: string): Promise<{ result: 'reset' | 'kept' | 'not-found' | 'failed'; tempPassword?: string }> {
  try {
    const data = await post({ email, action: 'reset-temp' });
    if (data?.result === 'reset' && data.tempPassword) return { result: 'reset', tempPassword: data.tempPassword };
    return { result: data?.result === 'kept' || data?.result === 'not-found' ? data.result : 'failed' };
  } catch {
    return { result: 'failed' };
  }
}

/** When each of these emails last signed in (only those that have).
 *  Curators only; null when the check failed, so nobody is wrongly shown
 *  as never having signed in. */
export async function getSignInStatus(emails: string[]): Promise<Record<string, string> | null> {
  try {
    const data = await post({ action: 'signin-status', emails }) as { result?: string; signedIn?: Record<string, string> } | null;
    return data?.result === 'ok' ? data.signedIn ?? {} : null;
  } catch {
    return null;
  }
}

/** Undoes createMemberAccount for a pending member who has never signed in
 *  (the server keeps anyone who has: 'kept'). */
export async function removePendingMember(email: string): Promise<'removed' | 'kept' | 'not-found' | 'failed'> {
  try {
    const r = (await post({ email, action: 'remove' }))?.result;
    return r === 'removed' || r === 'kept' || r === 'not-found' ? r : 'failed';
  } catch {
    return 'failed';
  }
}

/** Removes a member who already has an account from the Hub entirely
 *  (sign-in, profiles, initiatives, requests). 'kept' means the server
 *  refused (yourself, or a curator removed by a vice curator). */
export async function deleteMember(uid: string): Promise<'removed' | 'kept' | 'not-found' | 'failed'> {
  try {
    const data = await post({ action: 'delete-member', uid });
    const r = data?.result;
    return r === 'removed' || r === 'kept' || r === 'not-found' ? r : 'failed';
  } catch {
    return 'failed';
  }
}
