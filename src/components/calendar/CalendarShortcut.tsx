'use client';

/* Calendar: the calendar icon in the navbar, shown to signed-in members on
 * every page. The badge counts this week's events; tapping it opens This week
 * without leaving the page, with a link to the full Calendar. */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import ModalPortal from '@/components/ModalPortal';
import { useCalendarFormat } from '@/lib/calendar/format';
import { addDays, clashesByOccurrence, expandOccurrences, findClashes, hubToday, occursOn } from '@/lib/calendar/occurrences';
import { useCalendarStore } from '@/lib/calendar/store';
import type { Occurrence } from '@/lib/calendar/types';
import EventDetails from './EventDetails';
import { Icon } from './Icon';
import Sheet from './Sheet';
import { DayGroup } from './Views';
import styles from './Calendar.module.css';

export const CALENDAR_HREF = '/dashboard/shaper/calendar';

export default function CalendarShortcut() {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  const router = useRouter();
  const { events } = useCalendarStore();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Occurrence | null>(null);
  const [toast, setToast] = useState('');

  const today = hubToday();
  const end = addDays(today, 6);
  const occs = useMemo(() => expandOccurrences(events, today, end), [events, today, end]);
  const clashMap = useMemo(() => clashesByOccurrence(findClashes(occs)), [occs]);
  const clashKeys = useMemo(() => new Set(clashMap.keys()), [clashMap]);
  const days: string[] = [];
  for (let d = today; d <= end; d = addDays(d, 1)) if (occs.some(o => occursOn(o, d))) days.push(d);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };

  return (
    <>
      <button type="button" className={styles.shortcut} onClick={() => setOpen(true)}
        aria-label={`${t('shortcutLabel')}: ${f.number(occs.length)}`} title={t('shortcutLabel')}>
        <Icon name="calendar" size={17} />
        {occs.length > 0 && <span className={styles.count} aria-hidden="true">{f.number(occs.length)}</span>}
      </button>

      {open && !detail && (
        <Sheet title={t('thisWeek')} onClose={() => setOpen(false)}
          footer={<button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => { setOpen(false); router.push(CALENDAR_HREF); }}>
            <Icon name="calendar" />{t('openCalendar')}
          </button>}>
          <div className={styles.agenda}>
            {days.map(d => <DayGroup key={d} day={d} today={today} rows={occs.filter(o => occursOn(o, d))} clashKeys={clashKeys} onOpen={setDetail} />)}
            {!days.length && <p className={styles.empty}>{t('nothingThisWeek')}</p>}
          </div>
        </Sheet>
      )}
      {detail && (
        <EventDetails occ={detail} clashes={clashMap.get(detail.key) ?? []} onClose={() => setDetail(null)}
          onEdit={() => { setDetail(null); setOpen(false); router.push(CALENDAR_HREF); }} onToast={showToast} />
      )}
      {toast && <ModalPortal><div className={styles.toast} role="status">{toast}</div></ModalPortal>}
    </>
  );
}
