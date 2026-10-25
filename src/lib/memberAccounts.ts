/* Shared by the browser and the /api/members/create-account route.
 *
 * Curator-created accounts start with a random one-time password
 * (generateTempPassword in firebaseAdmin.ts). Signing in with one sets
 * MUST_CHANGE_PASSWORD_FLAG, and the dashboard then keeps the member on
 * My Profile until they choose their own password. */

/** Minimum length for a member's own password. */
export const PASSWORD_MIN = 8;

/** sessionStorage flag set at sign-in when the password must be changed. */
export const MUST_CHANGE_PASSWORD_FLAG = 'jh-default-pw';

/** True for a password the member didn't choose: a one-time "Tmp-XXXX-XXXX-XXXX"
 *  password, or anything shorter than the minimum (older accounts were
 *  created with a short shared password). */
export function isTemporaryPassword(pw: string): boolean {
  return /^Tmp-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(pw) || pw.length < PASSWORD_MIN;
}

/** Roles a curator can assign; also the role a new member is listed under on Who We Are. */
export const MEMBER_ROLES = ['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

/** 'not-configured': the server has no Firebase service account to create accounts with. */
export type CreateAccountResult = 'created' | 'exists' | 'failed' | 'not-configured';
