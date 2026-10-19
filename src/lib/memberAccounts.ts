/* Shared by the browser and the /api/members/create-account route.
 *
 * Curator-created accounts start with DEFAULT_MEMBER_PASSWORD; members are
 * prompted to change it (dashboard banner + My Profile → Change password). */

/** Temporary password for curator-created accounts, until the member changes it. */
export const DEFAULT_MEMBER_PASSWORD = '[removed]';

/** sessionStorage flag set at sign-in when the default password was used. */
export const DEFAULT_PASSWORD_FLAG = 'jh-default-pw';

/** Roles a curator can assign; also the role a new member is listed under on Who We Are. */
export const MEMBER_ROLES = ['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni'] as const;
export type MemberRole = typeof MEMBER_ROLES[number];

/** 'not-configured': the server has no Firebase service account to create accounts with. */
export type CreateAccountResult = 'created' | 'exists' | 'failed' | 'not-configured';
