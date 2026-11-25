'use client';

/* Calendar: words and dates in the reader's language. Member and initiative
 * names come from the calendar's data (Arabic where one is set); event times are wall-clock times in Jeddah, so they
 * are printed as written rather than converted. */
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, intlLocale } from '@/lib/dates';
import { fromKey } from './occurrences';
import { useCalendarStore } from './store';
import type { CalendarEvent } from './types';

export function useCalendarFormat() {
  const locale = useLocale();
  const ar = locale === 'ar';
  const t = useTranslations('Calendar');
  const { people, initiatives } = useCalendarStore();
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
    /** A short date range, e.g. "Nov 22 – 28" (the month once when it's the same). */
    range(a: string, b: string) {
      const fmt = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: 'Asia/Riyadh' });
      return fmt.formatRange(fromKey(a), fromKey(b));
    },
    /** "Sara, Omar and you" in the reader's language. */
    list: (items: string[]) => new Intl.ListFormat(intlLocale(locale), { type: 'conjunction' }).format(items),
    title: (e: CalendarEvent) => (ar && e.titleAr) || e.title,
    location: (e: CalendarEvent) => (ar && e.locationAr) || e.location || '',
    notes: (e: CalendarEvent) => (ar && e.notesAr) || e.notes || '',
    organizer: (e: CalendarEvent) => (ar && e.organizerNameAr) || e.organizerName || '',
    initiative: (id?: string) => (id && initiatives[id] ? (ar && initiatives[id].titleAr) || initiatives[id].title : ''),
    /** A member's name; someone without a profile shows as "A member". */
    person: (id: string) => (people[id] && ((ar && people[id].nameAr) || people[id].name)) || t('someMember'),
  };
}

export type CalendarFormat = ReturnType<typeof useCalendarFormat>;
