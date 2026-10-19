import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/* Charter sign-off, mirroring the hub's Google Form ("Name" + "I confirm
 * compliance with Community Charter").
 *
 * settings/charter { requireSignature } — curators switch it on or off.
 * charter_signatures/{uid} { uid, name, confirmed, signedAt } — one per
 * member; firestore.rules let a member write only their own, and only
 * curators / impact officers read everyone's. */

export const CHARTER_SETTINGS = { collection: 'settings', id: 'charter' } as const;
export const SIGNATURES = 'charter_signatures';
/** Fired after a member signs or a curator changes the setting, so the
 *  dashboard banner updates without a reload. */
export const CHARTER_EVENT = 'jh-charter-changed';

export interface CharterSignature {
  uid: string;
  name: string;
  confirmed: true;
  signedAt: string;
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

export async function getMySignature(uid: string): Promise<CharterSignature | null> {
  const snap = await getDoc(doc(db, SIGNATURES, uid));
  return snap.exists() ? (snap.data() as CharterSignature) : null;
}

export async function signCharter(uid: string, name: string) {
  const sig: CharterSignature = { uid, name: name.trim(), confirmed: true, signedAt: new Date().toISOString() };
  await setDoc(doc(db, SIGNATURES, uid), sig);
  window.dispatchEvent(new Event(CHARTER_EVENT));
  return sig;
}

/** Whether sign-off is switched on, and this member's own signature. */
export function useCharterStatus(uid: string | null | undefined) {
  const [state, setState] = useState<{ loading: boolean; required: boolean; signature: CharterSignature | null }>(
    { loading: true, required: false, signature: null });

  const load = useCallback(() => {
    if (!uid) return;
    Promise.all([getRequireSignature().catch(() => false), getMySignature(uid).catch(() => null)])
      .then(([required, signature]) => setState({ loading: false, required, signature }));
  }, [uid]);

  useEffect(() => {
    load();
    window.addEventListener(CHARTER_EVENT, load);
    return () => window.removeEventListener(CHARTER_EVENT, load);
  }, [load]);

  return state;
}
