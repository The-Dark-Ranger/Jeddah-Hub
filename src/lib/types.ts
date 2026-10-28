/* Shapes of the Firestore records the dashboards read and write, shared so
 * every page agrees on them (see firestore.rules for what each may hold). */

/** One person on an initiative's team (initiatives/{id}.members[]).
 *  `role` is display text such as "Lead" or "Member"; real lead rights come
 *  from the initiative's separate `leads` array. */
export interface InitiativeMember {
  userId: string;
  role?: string;
}

/** Very old initiatives stored bare user ids in `members`; newer ones store
 *  InitiativeMember objects. Read both, write objects. */
export type MemberEntry = InitiativeMember | string;

/** The user id of a members[] entry in either shape. */
export function memberId(m: MemberEntry | null | undefined): string {
  return typeof m === 'string' ? m : m?.userId ?? '';
}

/** The roles a person can hold on an initiative's team. Lead and Co-Lead
 *  have the same rights (their uid goes in the initiative's `leads` array). */
export const TEAM_ROLES = ['Member', 'Lead', 'Co-Lead'] as const;
export type TeamRole = typeof TEAM_ROLES[number];

/** True for a team role that carries lead rights: Lead, Co-Lead, and older
 *  free-text roles such as "Initiative Lead". */
export function isLeadRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && /\b(co-?)?lead\b/i.test(role);
}

/** True for a members[] entry whose display role marks a lead. */
export function isLeadEntry(m: MemberEntry): boolean {
  return typeof m !== 'string' && isLeadRole(m.role);
}

/** The closest team role to a stored role text (older free-text lead roles
 *  read as Lead, anything else as Member). */
export function toTeamRole(role: string | null | undefined): TeamRole {
  if (typeof role === 'string' && /^co-?lead$/i.test(role.trim())) return 'Co-Lead';
  return isLeadRole(role) ? 'Lead' : 'Member';
}

/** An initiative's team with one person's role changed (a bare-id entry is
 *  written back as an object). */
export function withTeamRole(members: MemberEntry[], userId: string, role: TeamRole): MemberEntry[] {
  return members.map(m => memberId(m) === userId ? { userId, role } : m);
}

/** join_requests / leave_requests: a member asking to join or leave. */
export interface MembershipRequest {
  id: string;
  initiativeId: string;
  initiativeTitle?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  status: 'pending' | 'accepted' | 'approved' | 'rejected' | 'declined';
  requestedAt?: string;
}

/** removal_requests / member_add_requests: a lead asking to remove or add someone. */
export interface LeadRequest {
  id: string;
  initiativeId: string;
  initiativeTitle?: string;
  targetUserId: string;
  targetUserName?: string;
  requestedByUserId: string;
  requestedByName?: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt?: string;
}

/** role_change_requests: a lead asking the Curator or Vice Curator to change
 *  a teammate's role. */
export interface RoleChangeRequest extends LeadRequest {
  fromRole?: string;
  toRole: TeamRole;
}

/** initiative_requests / activity_requests: a proposal awaiting review.
 *  The proposed content fields vary, so they stay open-ended. */
export interface Proposal extends Record<string, unknown> {
  id: string;
  title?: string;
  proposedBy: string;
  proposedByName?: string;
  status: 'pending' | 'approved' | 'declined';
  requestedAt?: string;
}

/** The parts of users/{uid} the dashboards display. */
export interface UserDoc {
  id: string;
  email?: string;
  displayName?: string;
  displayNameAr?: string;
  photoURL?: string;
  role?: string;
}

/** A short code for an error shown to a curator ("permission-denied", or
 *  the message when there is no code); empty when there is neither. */
export function errorCode(err: unknown): string {
  const e = err as { code?: unknown; message?: unknown } | null;
  return typeof e?.code === 'string' ? e.code : typeof e?.message === 'string' ? e.message : '';
}
