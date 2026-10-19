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
  return await res.json().catch(() => null) as { result?: string; reason?: string } | null;
}

/** Asks the server (curators only) to create this member's sign-in account
 *  with the temporary password, and to list them on the Who We Are page
 *  under `role` with `displayName`. See /api/members/create-account. */
export async function createMemberAccount(email: string, displayName: string, role: MemberRole): Promise<CreateAccountResult> {
  try {
    const data = await post({ email, displayName, role });
    if (data?.reason === 'not-configured') return 'not-configured';
    return data?.result === 'created' || data?.result === 'exists' ? data.result : 'failed';
  } catch {
    return 'failed';
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
