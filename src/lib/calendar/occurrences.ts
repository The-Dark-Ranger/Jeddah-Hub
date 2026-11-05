/* Calendar date maths: turning events (weekly series, multi-day trips) into
 * the dates they fall on, and finding people booked into two things at once.
 * Pure functions, no React or Firebase, so the same logic can later run on
 * the server. */
import type { CalendarEvent, Clash, Occurrence } from './types';

const HUB_TIME_ZONE = 'Asia/Riyadh';
const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Noon on that day, so time zones can't move it to a neighbouring day. */
export function fromKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(k: string, n: number): string {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** Whole days from b to a. */
export function dayDiff(a: string, b: string): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000);
}

/** Today's date in Jeddah. */
export function hubToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: HUB_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts.slice(0, 10);
}

/** Sunday that starts the week containing the day. */
export function weekStart(k: string): string {
  return addDays(k, -fromKey(k).getDay());
}

export function monthGrid(anchor: string) {
  const a = fromKey(anchor);
  const first = new Date(a.getFullYear(), a.getMonth(), 1, 12);
  const lead = first.getDay();
  const daysIn = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((lead + daysIn) / 7) * 7;
  return {
    cells,
    from: toKey(new Date(a.getFullYear(), a.getMonth(), 1 - lead, 12)),
    to: toKey(new Date(a.getFullYear(), a.getMonth(), cells - lead, 12)),
    monthFrom: toKey(first),
    monthTo: toKey(new Date(a.getFullYear(), a.getMonth(), daysIn, 12)),
  };
}

const minutes = (t?: string) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const KIND_ORDER = { deadline: 0, external: 1, activity: 2, hub: 3, initiative: 4 } as const;

export function expandOccurrences(events: CalendarEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const event of events) {
    const span = Math.max(0, dayDiff(event.endDate, event.startDate));
    const push = (date: string) => {
      const endDate = addDays(date, span);
      if (endDate < from || date > to) return;
      out.push({ event, key: `${event.id}@${date}`, date, endDate });
    };
    if (!event.weekly) { push(event.startDate); continue; }
    let date = event.startDate;
    const gap = dayDiff(from, date) - span;
    if (gap > 7) date = addDays(date, Math.floor(gap / 7) * 7);
    for (let i = 0; i < 600 && date <= to; i++, date = addDays(date, 7)) {
      if (!event.skipDates?.includes(date)) push(date);
    }
  }
  return out.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : (minutes(a.event.startTime) ?? -1) - (minutes(b.event.startTime) ?? -1)
        || KIND_ORDER[a.event.kind] - KIND_ORDER[b.event.kind]);
}

export const occursOn = (o: Occurrence, day: string) => o.date <= day && day <= o.endDate;

function overlaps(a: Occurrence, b: Occurrence): boolean {
  if (a.endDate < b.date || b.endDate < a.date) return false;
  const sa = minutes(a.event.startTime), sb = minutes(b.event.startTime);
  // A trip or an all-day event clashes with anything on those days.
  if (a.date !== a.endDate || b.date !== b.endDate || sa === null || sb === null) return true;
  if (a.date !== b.date) return false;
  const ea = minutes(a.event.endTime) ?? sa + 90, eb = minutes(b.event.endTime) ?? sb + 90;
  return sa < eb && sb < ea;
}

/** People expected at two overlapping things. Someone who declined doesn't count. */
export function findClashes(occs: Occurrence[]): Clash[] {
  const out: Clash[] = [];
  const withPeople = occs.filter(o => o.event.kind !== 'deadline' && o.event.people.length);
  for (let i = 0; i < withPeople.length; i++) {
    for (let j = i + 1; j < withPeople.length; j++) {
      const a = withPeople[i], b = withPeople[j];
      if (a.event.id === b.event.id || !overlaps(a, b)) continue;
      const inB = new Set(b.event.people.filter(p => p.reply !== 'no').map(p => p.userId));
      for (const p of a.event.people) if (p.reply !== 'no' && inB.has(p.userId)) out.push({ userId: p.userId, a, b });
    }
  }
  return out;
}

export function clashesByOccurrence(clashes: Clash[]): Map<string, Clash[]> {
  const map = new Map<string, Clash[]>();
  for (const c of clashes) for (const k of [c.a.key, c.b.key]) map.set(k, [...(map.get(k) ?? []), c]);
  return map;
}

/** Each double-booking once, however many dates it touches. */
export function uniqueClashes(clashes: Clash[]): Clash[] {
  const seen = new Set<string>();
  return clashes.filter(c => {
    const k = `${c.userId}|${[c.a.key, c.b.key].sort().join('|')}`;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
