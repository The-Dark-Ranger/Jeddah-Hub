'use client';

/* Calendar: words and dates in the reader's language. Names in the preview
 * come in both languages; event times are wall-clock times in Jeddah, so they
 * are printed as written rather than converted. */
import { useLocale } from 'next-intl';
import { formatDate, intlLocale } from '@/lib/dates';
import { fromKey } from './occurrences';
import { PREVIEW_INITIATIVES, PREVIEW_PEOPLE } from './preview';
import type { CalendarEvent } from './types';

export function useCalendarFormat() {
  const locale = useLocale();
  const ar = locale === 'ar';
  const date = (k: string, o: Intl.DateTimeFormatOptions) => formatDate(fromKey(k), locale, o);
  return {
    locale,
    date,
    dayLong: (k: string) => date(k, { weekday: 'short', day: 'numeric', month: 'short' }),
    dayShort: (k: string) => date(k, { day: 'numeric', month: 'short' }),
    time(t?: string) {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      return new Date(2000, 0, 1, h, m).toLocaleTimeString(intlLocale(locale), { hour: 'numeric', minute: m ? '2-digit' : undefined });
    },
    number: (n: number) => new Intl.NumberFormat(intlLocale(locale)).format(n),
    title: (e: CalendarEvent) => (ar && e.titleAr) || e.title,
    location: (e: CalendarEvent) => (ar && e.locationAr) || e.location || '',
    notes: (e: CalendarEvent) => (ar && e.notesAr) || e.notes || '',
    organizer: (e: CalendarEvent) => (ar && e.organizerNameAr) || e.organizerName || '',
    initiative: (id?: string) => (id ? PREVIEW_INITIATIVES[id]?.[ar ? 'ar' : 'en'] ?? '' : ''),
    person: (id: string) => PREVIEW_PEOPLE[id]?.[ar ? 'ar' : 'en'] ?? id,
  };
}

export type CalendarFormat = ReturnType<typeof useCalendarFormat>;
