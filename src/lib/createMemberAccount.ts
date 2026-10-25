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
export async function createMemberAccount(email: string, displayName: string, role: MemberRole): Promise<{ result: CreateAccountResult; tempPassword?: string }> {
  try {
    const data = await post({ email, displayName, role });
    if (data?.reason === 'not-configured') return { result: 'not-configured' };
    const result = data?.result === 'created' || data?.result === 'exists' ? data.result : 'failed';
    return { result, tempPassword: data?.tempPassword };
  } catch {
    return { result: 'failed' };
  }
}

/** A new one-time password for a member who has never signed in; null when
 *  they already have (they keep their own) or on any failure. */
export async function resetTempPassword(email: string): Promise<string | null> {
  try {
    const data = await post({ email, action: 'reset-temp' });
    return data?.result === 'reset' && data.tempPassword ? data.tempPassword : null;
  } catch {
    return null;
  }
}

/** When each of these emails last signed in (only those that have).
 *  Curators only; empty on any failure. */
export async function getSignInStatus(emails: string[]): Promise<Record<string, string>> {
  try {
    const data = await post({ action: 'signin-status', emails }) as { signedIn?: Record<string, string> } | null;
    return data?.signedIn ?? {};
  } catch {
    return {};
  }
}

/** Undoes createMemberAccount for a pending member who has never signed in
 *  (the server keeps anyone who has). Best-effort. */
export async function removePendingMember(email: string): Promise<void> {
  try { await post({ email, action: 'remove' }); } catch { /* best-effort */ }
}
