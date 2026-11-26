'use client';

/* Calendar: who can add and edit events. Every member can add events: for
 * initiatives they are on, hub events and external events, and edit their own.
 * Initiative leads also edit all their initiatives' events and add deadlines
 * for them; curators, vice curators and impact officers manage everything.
 * Members can invite up to MEMBER_INVITE_LIMIT people per event, so one event
 * can't use up the day's emails. This only decides what the screens offer:
 * firestore.rules (calendar_events) enforces the same thing on every save. */
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/role';
import { useCalendarStore } from './store';
import type { CalendarEvent, CalendarKind } from './types';

const MANAGERS = ['curator', 'vice_curator', 'impact_officer'];
export const MEMBER_INVITE_LIMIT = 15;

export type CalendarRole = 'curator' | 'lead' | 'member';

export function useCalendarAccess() {
  const { user } = useAuth();
  const { initiatives, google } = useCalendarStore();
  const uid = user?.uid ?? '';
  const realRole = normalizeRole(user?.role);
  const manager = MANAGERS.includes(realRole);
  const active = Object.keys(initiatives).filter(id => !initiatives[id].archived);
  const leads = Object.keys(initiatives).filter(id => initiatives[id].leads.includes(uid));
  const memberOf = active.filter(id => initiatives[id].leads.includes(uid) || initiatives[id].team.includes(uid));
  const role: CalendarRole = manager ? 'curator' : leads.length ? 'lead' : 'member';
  return {
    uid,
    role,
    canAdd: !!uid,
    /** Invites go out (and replies come back) once the hub's Google Calendar is linked. */
    invitesLive: google.connected,
    /** Curators and vice curators link the hub's Google account. */
    canLinkGoogle: realRole === 'curator' || realRole === 'vice_curator',
    /** Kinds this person can create. Deadlines are for leads and managers. */
    kinds: (role === 'member' ? ['initiative', 'hub', 'external'] : ['initiative', 'hub', 'external', 'deadline']) as CalendarKind[],
    /** Initiatives this person can put events on: all for managers, otherwise the ones they're on. */
    initiatives: manager ? active : memberOf,
    /** Initiatives this person can add deadlines for (managers can also add hub-wide ones). */
    deadlineInitiatives: manager ? active : leads.filter(id => active.includes(id)),
    /** Most hub members one person can invite to an event; null means no limit.
     *  Leads have no limit on their own initiatives' events. */
    inviteLimit(initiativeId?: string): number | null {
      return manager || (initiativeId && leads.includes(initiativeId)) ? null : MEMBER_INVITE_LIMIT;
    },
    canEdit(e: CalendarEvent): boolean {
      // Invites are edited in the organiser's own calendar, Hub Activities on their page.
      if (e.source !== 'site' || !uid) return false;
      if (manager || e.createdBy === uid) return true;
      return !!e.initiativeId && leads.includes(e.initiativeId);
    },
    /** Curators can hide an imported invite that isn't relevant to the hub. */
    canHide: (e: CalendarEvent) => manager && e.source === 'invite',
  };
}
