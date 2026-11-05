/* Calendar: an "add to my calendar" link and a ready-to-paste WhatsApp
 * message for one occurrence of an event. */
import { addDays } from './occurrences';
import type { CalendarEvent, Occurrence } from './types';

const compact = (k: string) => k.replaceAll('-', '');
const hhmm = (t: string) => t.replace(':', '');

function plus90(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const total = Math.min(h * 60 + m + 90, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function googleCalendarUrl(o: Occurrence, title: string, location: string, notes: string): string {
  const e: CalendarEvent = o.event;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title });
  if (!e.startTime || o.date !== o.endDate) {
    p.set('dates', `${compact(o.date)}/${compact(addDays(o.endDate, 1))}`);
  } else {
    const end = e.endTime && e.endTime > e.startTime ? e.endTime : plus90(e.startTime);
    p.set('dates', `${compact(o.date)}T${hhmm(e.startTime)}00/${compact(o.date)}T${hhmm(end)}00`);
    p.set('ctz', 'Asia/Riyadh');
  }
  if (e.weekly) p.set('recur', 'RRULE:FREQ=WEEKLY');
  if (location) p.set('location', location);
  if (notes) p.set('details', notes);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function whatsappText(lines: { title: string; when: string; location: string; notes: string; footer: string }): string {
  const out = [`📅 *${lines.title}*`, lines.when];
  if (lines.location) out.push(`📍 ${lines.location}`);
  if (lines.notes) out.push('', lines.notes);
  out.push('', `— ${lines.footer}`);
  return out.join('\n');
}
