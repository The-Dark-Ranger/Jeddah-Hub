'use client';

/* Calendar data: the events (calendar_events in Firestore) and the names of
 * the members and initiatives they mention. One shared copy feeds the navbar
 * shortcut and the Calendar page, so the database is read once. It starts the
 * first time a signed-in member needs it and then stays live: an event
 * someone else adds appears without reloading. Who may write what is decided
 * by firestore.rules (calendar_events); the screens only offer what the rules
 * allow (see access.ts). After each change the server is asked to copy it to
 * the hub's Google Calendar, which sends the invites (lib/calendarGoogle.ts). */
import { useEffect, useSyncExternalStore } from 'react';
import {
  arrayUnion, collection, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
  type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { memberId, type MemberEntry } from '@/lib/types';
import { addDays, hubToday } from './occurrences';
import type { CalendarEvent, CalendarKind, InviteReply } from './types';

export interface DirectoryPerson { name: string; nameAr?: string; hidden?: boolean }
export interface DirectoryInitiative { title: string; titleAr?: string; team: string[]; leads: string[]; archived: boolean }

/** Whether the hub's Google Calendar is linked (calendar_settings/google). */
export interface GoogleLink { connected: boolean; email?: string; error?: string }

interface State {
  status: 'idle' | 'loading' | 'ready' | 'error';
  google: GoogleLink;
  events: CalendarEvent[];
  people: Record<string, DirectoryPerson>;
  initiatives: Record<string, DirectoryInitiative>;
}

/** How far back the calendar reads: past events older than this aren't shown. */
const HISTORY_DAYS = 180;

const EMPTY: State = { status: 'idle', google: { connected: false }, events: [], people: {}, initiatives: {} };
let state: State = EMPTY;
let stopEvents: Unsubscribe | null = null;
let stopGoogle: Unsubscribe | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach(l => l());
}

const REPLIES: InviteReply[] = ['yes', 'no', 'maybe'];

/** A stored calendar_events document as the screens use it. */
function toEvent(id: string, d: DocumentData): CalendarEvent {
  const replies: Record<string, string> = d.replies ?? {};
  return {
    id,
    title: d.title ?? '',
    kind: d.kind as CalendarKind,
    initiativeId: d.initiativeId || undefined,
    startDate: d.startDate,
    endDate: d.endDate ?? d.startDate,
    startTime: d.startTime || undefined,
    endTime: d.endTime || undefined,
    weekly: !!d.weekly,
    skipDates: d.skipDates ?? [],
    location: d.location || undefined,
    notes: d.notes || undefined,
    people: (d.people ?? []).map((p: { userId: string; role: 'team' | 'guest' }) => ({
      userId: p.userId,
      role: p.role === 'team' ? 'team' : 'guest',
      reply: REPLIES.includes(replies[p.userId] as InviteReply) ? (replies[p.userId] as InviteReply) : 'none',
    })),
    hasReplies: Object.keys(replies).length > 0,
    synced: !!d.google?.hash,
    syncFailed: d.google?.failed === true,
    outsideGuests: typeof d.outsideGuests === 'number' ? d.outsideGuests : undefined,
    source: 'site',
    createdBy: d.createdBy,
  };
}

/** Reads the names once and starts listening to the events. */
async function start() {
  if (state.status === 'loading' || state.status === 'ready') return;
  set({ status: 'loading' });
  try {
    const [profiles, inits] = await Promise.all([getDocs(collection(db, 'public_profiles')), getDocs(collection(db, 'initiatives'))]);
    const people: State['people'] = {};
    profiles.forEach(p => {
      const d = p.data();
      people[p.id] = { name: d.displayName || '', nameAr: d.displayNameAr || undefined, hidden: d.hidden === true };
    });
    const initiatives: State['initiatives'] = {};
    inits.forEach(i => {
      const d = i.data();
      if (d.type === 'hub_activity') return; // Hub Activities aren't initiatives
      initiatives[i.id] = {
        title: d.title || '',
        titleAr: d.titleAr || undefined,
        team: ((d.members ?? []) as MemberEntry[]).map(memberId).filter(Boolean),
        leads: d.leads ?? [],
        archived: d.status === 'archived' || d.archived === true,
      };
    });
    set({ people, initiatives });
    const from = addDays(hubToday(), -HISTORY_DAYS);
    stopEvents = onSnapshot(
      query(collection(db, 'calendar_events'), where('endDate', '>=', from)),
      // Events marked deleted wait for the server to cancel their invites; they're already gone here.
      snap => set({ status: 'ready', events: snap.docs.filter(e => e.get('deleted') !== true).map(e => toEvent(e.id, e.data())) }),
      () => set({ status: 'error' }),
    );
    stopGoogle = onSnapshot(doc(db, 'calendar_settings', 'google'), snap => {
      const d = snap.data();
      set({ google: { connected: d?.connected === true, email: d?.email, error: d?.error ?? undefined } });
    }, () => {});
    // Catch up anything that didn't reach Google, and read new replies (the server does this at most every few minutes).
    sync();
  } catch {
    set({ status: 'error' });
  }
}

/** Signing out: forget everything, so the next member starts clean. */
function stop() {
  stopEvents?.();
  stopGoogle?.();
  stopEvents = stopGoogle = null;
  set(EMPTY);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The calendar's data, loaded when a signed-in member first needs it. */
export function useCalendarStore(): State {
  const { user } = useAuth();
  const uid = user?.uid;
  useEffect(() => {
    if (uid) start(); else if (state.status !== 'idle') stop();
  }, [uid]);
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** Firestore refuses undefined values, so empty fields are left out. */
function clean(e: CalendarEvent, uid: string): DocumentData {
  const out: DocumentData = {
    title: e.title, kind: e.kind, startDate: e.startDate, endDate: e.endDate,
    weekly: !!e.weekly, skipDates: e.skipDates ?? [],
    people: e.people.map(p => ({ userId: p.userId, role: p.role })),
    createdBy: e.createdBy || uid,
  };
  if (e.initiativeId) out.initiativeId = e.initiativeId;
  if (e.startTime) out.startTime = e.startTime;
  if (e.endTime) out.endTime = e.endTime;
  if (e.location) out.location = e.location;
  if (e.notes) out.notes = e.notes;
  if (e.outsideGuests !== undefined) out.outsideGuests = e.outsideGuests;
  return out;
}

/** Asks the server to copy a change to the hub's Google Calendar. Never fails
 *  the save: if it doesn't get through, the server's next check catches up. */
async function sync(id?: string) {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : {}),
    });
  } catch { /* the next check catches up */ }
}

export const calendarActions = {
  /** A fresh id for a new event. */
  newId: () => doc(collection(db, 'calendar_events')).id,
  /** Adds or replaces an event. `isNew` stamps createdAt; replies are never sent from here. */
  async save(e: CalendarEvent, uid: string, isNew: boolean) {
    const data = clean(e, uid);
    if (isNew) await setDoc(doc(db, 'calendar_events', e.id), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    else await updateDoc(doc(db, 'calendar_events', e.id), { ...data, updatedAt: serverTimestamp() });
    void sync(e.id);
  },
  /** Marks it deleted; the server cancels its invites and removes it. */
  async remove(id: string) {
    await updateDoc(doc(db, 'calendar_events', id), { deleted: true, updatedAt: serverTimestamp() });
    void sync(id);
  },
  async skipWeek(id: string, date: string) {
    await updateDoc(doc(db, 'calendar_events', id), { skipDates: arrayUnion(date), updatedAt: serverTimestamp() });
    void sync(id);
  },
  /** Curators: Google's sign-in page for linking the hub's account. */
  async linkGoogle(locale: string): Promise<string | null> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return null;
    const res = await fetch('/api/calendar/google/link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
    return res.ok ? ((await res.json()).url as string) : null;
  },
};
