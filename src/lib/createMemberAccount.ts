import { auth } from '@/lib/firebase';
import type { CreateAccountResult } from '@/lib/memberAccounts';

/** Asks the server (curators only) to create this member's sign-in account
 *  with the temporary password. See /api/members/create-account. */
export async function createMemberAccount(email: string): Promise<CreateAccountResult> {
  try {
    const idToken = await auth?.currentUser?.getIdToken();
    if (!idToken) return 'failed';
    const res = await fetch('/api/members/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null) as { result?: CreateAccountResult; reason?: string } | null;
    if (data?.reason === 'not-configured') return 'not-configured';
    return data?.result === 'created' || data?.result === 'exists' ? data.result : 'failed';
  } catch {
    return 'failed';
  }
}
