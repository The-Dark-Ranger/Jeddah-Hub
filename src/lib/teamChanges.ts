/* Adding someone to an initiative's team or taking them off it, together with
 * the request that asked for it, in one transaction: the team is read fresh
 * (a page's copy may be minutes old, and writing it back would undo changes
 * made since), and the team and the request's outcome are saved together, so
 * a failure or a retry can't apply one without the other. */
import { arrayRemove, arrayUnion, doc, runTransaction, type DocumentReference, type Transaction } from 'firebase/firestore';
import { db } from './firebase';
import { memberId, type MemberEntry } from './types';

/** Settles the request in the same transaction (marks it, or deletes it). */
type Settle = (tx: Transaction) => void;

/** Adds someone as a Member. False when they were already on the team (the
 *  request is settled either way). */
export function addToTeam(initiativeId: string, userId: string, settle?: Settle): Promise<boolean> {
  const ref = doc(db, 'initiatives', initiativeId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const members = (snap.data()?.members || []) as MemberEntry[];
    const add = snap.exists() && !members.some(m => memberId(m) === userId);
    if (add) tx.update(ref, { members: arrayUnion({ userId, role: 'Member' }) });
    settle?.(tx);
    return add;
  });
}

/** Takes someone off the team and out of `leads`, the array firestore.rules
 *  checks for lead rights, so a former lead keeps no write access. Leads
 *  can't change `leads` (or remove another lead), so their approvals pass
 *  `keepLeads`. False when they weren't on the team. */
export function removeFromTeam(
  initiativeId: string, userId: string,
  { keepLeads = false, settle }: { keepLeads?: boolean; settle?: Settle } = {},
): Promise<boolean> {
  const ref = doc(db, 'initiatives', initiativeId);
  return runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    // Every stored entry for them, in whichever shape it was saved.
    const entries = ((snap.data()?.members || []) as MemberEntry[]).filter(m => memberId(m) === userId);
    if (snap.exists() && (entries.length > 0 || !keepLeads)) {
      tx.update(ref, {
        ...(entries.length > 0 ? { members: arrayRemove(...entries) } : {}),
        ...(keepLeads ? {} : { leads: arrayRemove(userId) }),
      });
    }
    settle?.(tx);
    return entries.length > 0;
  });
}

/** Runs an approval only while its request is still pending, together with
 *  marking it approved: a double click, a second reviewer, or a retry after
 *  a reply that never arrived can't apply it twice. False when the request
 *  had already been decided. */
export function approveOnce(
  request: DocumentReference, outcome: Record<string, unknown>, apply: (tx: Transaction) => void,
): Promise<boolean> {
  return runTransaction(db, async tx => {
    if ((await tx.get(request)).data()?.status !== 'pending') return false;
    apply(tx);
    tx.update(request, { ...outcome, status: 'approved' });
    return true;
  });
}
