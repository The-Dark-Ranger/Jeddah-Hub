/* Charter sign-off: the member types the name on their account and ticks one
 * box saying they have read the Charter and will adhere to it.
 *
 * settings/charter { requireSignature }, curators switch it on or off.
 * charter_signatures/{uid} { uid, name, confirmed, signedAt, signedAtServer },
 * one per member; firestore.rules let a member create only their own, with
 * their own account name, and only curators / impact officers read everyone's.
 * A signature can't be edited: a new signing round deletes them all. */
import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const CHARTER_SETTINGS = { collection: 'settings', id: 'charter' } as const;
/** Roles asked to sign: active Shapers, including the curatorship.
 *  Alumni aren't asked and aren't counted. */
export const SIGNING_ROLES = ['shaper', 'curator', 'vice_curator', 'impact_officer'];
export const SIGNATURES = 'charter_signatures';
/** Fired after a member signs or a curator changes the setting, so the
 *  dashboard banner updates without a reload. */
const CHARTER_EVENT = 'jh-charter-changed';

export interface CharterSignature {
  uid: string;
  name: string;
  confirmed: true;
  /** The device's clock, shown on the page. */
  signedAt: string;
  /** The server's clock, which a device can't change. Older signatures don't have it. */
  signedAtServer?: Timestamp;
}

export async function getRequireSignature(): Promise<boolean> {
  const snap = await getDoc(doc(db, CHARTER_SETTINGS.collection, CHARTER_SETTINGS.id));
  return snap.exists() && snap.data().requireSignature === true;
}

export async function setRequireSignature(value: boolean, by: string | null | undefined) {
  await setDoc(doc(db, CHARTER_SETTINGS.collection, CHARTER_SETTINGS.id), {
    requireSignature: value, updatedAt: new Date().toISOString(), updatedBy: by ?? null,
  });
  window.dispatchEvent(new Event(CHARTER_EVENT));
}

async function getMySignature(uid: string): Promise<CharterSignature | null> {
  const snap = await getDoc(doc(db, SIGNATURES, uid));
  return snap.exists() ? (snap.data() as CharterSignature) : null;
}

/** Ignores what doesn't change a name: spacing, capitals, Arabic vowel marks
 *  and the common spellings of the same letter (أ/إ/آ/ا, ى/ي, ة/ه). */
function comparableName(name: string) {
  return name.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

/** The name on the account (English or Arabic) that `typed` matches, spelled
 *  as the account spells it, or null when it matches neither. */
export function matchAccountName(typed: string, accountNames: (string | null | undefined)[]): string | null {
  const wanted = comparableName(typed);
  if (!wanted) return null;
  return accountNames.find(n => n && comparableName(n) === wanted) ?? null;
}

export async function signCharter(uid: string, accountName: string) {
  await setDoc(doc(db, SIGNATURES, uid), {
    uid, name: accountName, confirmed: true,
    signedAt: new Date().toISOString(), signedAtServer: serverTimestamp(),
  });
  window.dispatchEvent(new Event(CHARTER_EVENT));
}

/** What the dashboard needs to know about the member's Charter sign-off:
 *  whether sign-off is switched on, and this member's own signature.
 *  `failed`: either couldn't be read, so the status is unknown. Nothing may
 *  then ask the member to sign: they may well have signed already, and the
 *  rules refuse a second signature. `retry` reads both again. */
export type CharterStatus = ReturnType<typeof useCharterStatus>;

export function useCharterStatus(uid: string | null | undefined) {
  const [state, setState] = useState<{
    loading: boolean; failed: boolean; required: boolean; signature: CharterSignature | null;
  }>({ loading: true, failed: false, required: false, signature: null });

  const load = useCallback(() => {
    if (!uid) return;
    Promise.all([getRequireSignature(), getMySignature(uid)])
      .then(([required, signature]) => setState({ loading: false, failed: false, required, signature }))
      .catch(err => {
        console.error('Charter status failed to load:', err);
        setState({ loading: false, failed: true, required: false, signature: null });
      });
  }, [uid]);

  useEffect(() => {
    load();
    window.addEventListener(CHARTER_EVENT, load);
    return () => window.removeEventListener(CHARTER_EVENT, load);
  }, [load]);

  // Through the event, so the dashboard banner's copy of the status (the
  // layout reads its own) is read again too.
  const retry = useCallback(() => {
    setState(s => ({ ...s, loading: true }));
    window.dispatchEvent(new Event(CHARTER_EVENT));
  }, []);

  return { ...state, retry };
}
