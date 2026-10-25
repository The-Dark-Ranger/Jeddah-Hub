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

/** True for a members[] entry whose display role marks a lead. */
export function isLeadEntry(m: MemberEntry): boolean {
  return typeof m !== 'string' && typeof m.role === 'string' && m.role.toLowerCase().includes('lead');
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
