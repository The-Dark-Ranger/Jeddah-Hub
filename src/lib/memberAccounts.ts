/* Sign-in accounts for members a curator pre-assigns a role to.
 *
 * The account is created through Firebase Auth's public sign-up REST endpoint
 * (the same one the client SDK uses) rather than createUserWithEmailAndPassword,
 * which would sign the curator out and into the new account. Nothing new is
 * unlocked by this: the member's role still comes only from the curator's
 * role_assignments document, applied on their first sign-in (src/lib/auth.ts).
 *
 * Every new account starts with DEFAULT_MEMBER_PASSWORD. Members are prompted
 * to change it (dashboard banner + My Profile → Change password). */

/** Temporary password for curator-created accounts, until the member changes it. */
export const DEFAULT_MEMBER_PASSWORD = '123456';

/** sessionStorage flag set at sign-in when the default password was used. */
export const DEFAULT_PASSWORD_FLAG = 'jh-default-pw';

export type CreateAccountResult = 'created' | 'exists' | 'failed';

export async function createMemberAccount(email: string): Promise<CreateAccountResult> {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) return 'failed';
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: DEFAULT_MEMBER_PASSWORD, returnSecureToken: false }),
    });
    if (res.ok) return 'created';
    const data = await res.json().catch(() => null) as { error?: { message?: string } } | null;
    return data?.error?.message?.startsWith('EMAIL_EXISTS') ? 'exists' : 'failed';
  } catch {
    return 'failed';
  }
}
