/* Shared by the browser and the /api/members/create-account route.
 *
 * Curator-created accounts start with DEFAULT_MEMBER_PASSWORD; members are
 * prompted to change it (dashboard banner + My Profile → Change password). */

/** Temporary password for curator-created accounts, until the member changes it. */
export const DEFAULT_MEMBER_PASSWORD = '123456';

/** sessionStorage flag set at sign-in when the default password was used. */
export const DEFAULT_PASSWORD_FLAG = 'jh-default-pw';

/** 'not-configured': the server has no Firebase service account to create accounts with. */
export type CreateAccountResult = 'created' | 'exists' | 'failed' | 'not-configured';
