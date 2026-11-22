'use client';

/* Calendar: who can add and edit events. Every member can add events: for
 * initiatives they are on, hub events and external events. Initiative leads
 * also edit all their initiatives' events and add deadlines; curators, vice
 * curators and impact officers manage everything. Members can invite up to
 * MEMBER_INVITE_LIMIT people per event, so one event can't use up the day's
 * emails. This only decides what the screens offer; when events are stored,
 * firestore.rules will enforce the same thing. */
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/role';
import { PREVIEW_INITIATIVES, PREVIEW_TEAMS } from './preview';
import { useCalendarStore, type PreviewRole } from './store';
import type { CalendarEvent, CalendarKind } from './types';

const MANAGERS = ['curator', 'vice_curator', 'impact_officer'];
export const MEMBER_INVITE_LIMIT = 15;

/** The member's real calendar role, before any preview override. */
function useRealRole(): PreviewRole {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const manager = MANAGERS.includes(role);
  const [leads, setLeads] = useState(false);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid || manager) return;
    let live = true;
    getDocs(query(collection(db, 'initiatives'), where('leads', 'array-contains', uid), limit(1)))
      .then(s => { if (live) setLeads(!s.empty); })
      .catch(() => {});
    return () => { live = false; };
  }, [uid, manager]);
  return manager ? 'curator' : leads ? 'lead' : 'member';
}

export function useCalendarAccess() {
  const real = useRealRole();
  const { previewRole } = useCalendarStore();
  const role = previewRole ?? real;
  const manager = role === 'curator';
  // In the preview, "me" is on the example teams that list "me", and a lead
  // leads the first one.
  const memberOf = Object.keys(PREVIEW_INITIATIVES).filter(id => PREVIEW_TEAMS[id]?.includes('me'));
  const leads = role === 'lead' ? ['preview-tech'] : [];
  return {
    role,
    realRole: real,
    canAdd: true,
    /** Kinds this person can create. Deadlines are for leads and managers. */
    kinds: (role === 'member' ? ['initiative', 'hub', 'external'] : ['initiative', 'hub', 'external', 'deadline']) as CalendarKind[],
    /** Initiatives this person can put events on: all for managers, otherwise the ones they're on. */
    initiatives: manager ? Object.keys(PREVIEW_INITIATIVES) : memberOf,
    /** Most hub members one person can invite to an event; null means no limit. */
    inviteLimit: role === 'member' ? MEMBER_INVITE_LIMIT : null,
    canEdit(e: CalendarEvent): boolean {
      // Invites are edited in the organiser's own calendar, Hub Activities on their page.
      if (e.source !== 'site') return false;
      if (manager || e.createdBy === 'me') return true;
      return !!e.initiativeId && leads.includes(e.initiativeId);
    },
    /** Curators can hide an imported invite that isn't relevant to the hub. */
    canHide: (e: CalendarEvent) => manager && e.source === 'invite',
  };
}
