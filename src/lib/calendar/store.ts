'use client';

/* Calendar preview store: the events shown by the navbar shortcut and the
 * Calendar page, kept in memory and shared between them. In the preview,
 * "Preview as" changes only what the calendar's own screens show; it never
 * touches the member's real role or any data. When the calendar is connected
 * to Firestore this file is where the reads and writes will go. */
import { useSyncExternalStore } from 'react';
import { previewEvents } from './preview';
import type { CalendarEvent } from './types';

export type PreviewRole = 'curator' | 'lead' | 'member';

interface State {
  events: CalendarEvent[];
  previewRole: PreviewRole | null;
}

let state: State | null = null;
const listeners = new Set<() => void>();
const EMPTY: State = { events: [], previewRole: null };

function current(): State {
  state ??= { events: previewEvents(), previewRole: null };
  return state;
}

function set(next: Partial<State>) {
  state = { ...current(), ...next };
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useCalendarStore(): State {
  return useSyncExternalStore(subscribe, current, () => EMPTY);
}

export const calendarActions = {
  save(event: CalendarEvent) {
    const list = current().events;
    set({ events: list.some(e => e.id === event.id) ? list.map(e => (e.id === event.id ? event : e)) : [...list, event] });
  },
  remove(id: string) {
    set({ events: current().events.filter(e => e.id !== id) });
  },
  skipWeek(id: string, date: string) {
    set({ events: current().events.map(e => (e.id === id ? { ...e, skipDates: [...(e.skipDates ?? []), date] } : e)) });
  },
  setPreviewRole(previewRole: PreviewRole) {
    set({ previewRole });
  },
};
