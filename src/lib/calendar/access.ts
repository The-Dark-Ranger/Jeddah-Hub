'use client';

/* Calendar: who can add and edit events. Curators, vice curators and impact
 * officers manage everything; initiative leads manage their own initiatives'
 * events and can add hub-wide ones; everyone else views. This only decides
 * what the screens offer. When events are stored, firestore.rules will
 * enforce the same thing. */
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/role';
import { useCalendarStore, type PreviewRole } from './store';
import type { CalendarEvent, CalendarKind } from './types';

const MANAGERS = ['curator', 'vice_curator', 'impact_officer'];

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
  /** In the preview, a lead leads the first example initiative. */
  const ledInitiatives = role === 'lead' ? ['preview-tech'] : [];
  return {
    role,
    realRole: real,
    canAdd: role !== 'member',
    /** Kinds this person can create. */
    kinds: (role === 'curator' ? ['initiative', 'hub', 'activity', 'external', 'deadline'] : ['initiative', 'hub', 'deadline']) as CalendarKind[],
    /** Initiatives this person can put events on; null means all. */
    initiatives: role === 'curator' ? null : ledInitiatives,
    canEdit(e: CalendarEvent): boolean {
      if (e.source === 'invite') return false; // edited in the organiser's own calendar
      if (role === 'curator') return true;
      if (role !== 'lead') return false;
      return e.initiativeId ? ledInitiatives.includes(e.initiativeId) : e.createdBy === 'me';
    },
    /** Curators can hide an imported invite that isn't relevant to the hub. */
    canHide: (e: CalendarEvent) => role === 'curator' && e.source === 'invite',
  };
}
