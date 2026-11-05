'use client';

/* Dashboard > Calendar: everything happening across the hub. Phones open on
 * the week (a strip of days and that week's events); laptops open on a large
 * month grid, made to be shown in meetings, with a seven-column week too.
 * For now it shows example events (see lib/calendar/preview.ts) and saves
 * nothing; "Preview as" switches what the calendar offers each role. */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import InviteAddress from '@/components/calendar/InviteAddress';
import EventDetails from '@/components/calendar/EventDetails';
import EventForm from '@/components/calendar/EventForm';
import { Icon } from '@/components/calendar/Icon';
import Sheet from '@/components/calendar/Sheet';
import { useWide } from '@/components/calendar/useWide';
import { DayGroup, MonthGrid, WeekColumns, WeekStrip, kindClass } from '@/components/calendar/Views';
import styles from '@/components/calendar/Calendar.module.css';
import { useCalendarAccess } from '@/lib/calendar/access';
import { useCalendarFormat } from '@/lib/calendar/format';
import {
  addDays, clashesByOccurrence, expandOccurrences, findClashes, fromKey, hubToday, monthGrid, occursOn, toKey, uniqueClashes, weekStart,
} from '@/lib/calendar/occurrences';
import { calendarActions, useCalendarStore, type PreviewRole } from '@/lib/calendar/store';
import { CALENDAR_KINDS, type CalendarEvent, type CalendarKind, type Occurrence } from '@/lib/calendar/types';

type View = 'week' | 'month';
type Open = { type: 'event'; occ: Occurrence } | { type: 'form'; editing: CalendarEvent | null } | { type: 'day'; day: string } | { type: 'clashes' } | null;

export default function CalendarPage() {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  const wide = useWide();
  const access = useCalendarAccess();
  const { events } = useCalendarStore();
  const today = hubToday();

  const [viewChoice, setView] = useState<View | null>(null);
  const view: View = viewChoice ?? (wide ? 'month' : 'week');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [kinds, setKinds] = useState<CalendarKind[]>([]);
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [toast, setToast] = useState('');

  const grid = monthGrid(anchor);
  const wStart = weekStart(anchor);
  const range = view === 'month' ? { from: grid.from, to: grid.to } : { from: wStart, to: addDays(wStart, 6) };
  const period = view === 'month' ? { from: grid.monthFrom, to: grid.monthTo } : range;
  const inPeriod = period.from <= today && today <= period.to;

  const all = useMemo(() => expandOccurrences(events, range.from, range.to), [events, range.from, range.to]);
  const clashes = useMemo(() => findClashes(all), [all]);
  const clashMap = useMemo(() => clashesByOccurrence(clashes), [clashes]);
  const clashKeys = useMemo(() => new Set(clashMap.keys()), [clashMap]);
  const periodClashes = uniqueClashes(clashes.filter(c => c.a.date <= period.to && c.a.endDate >= period.from));

  const occs = all.filter(o => (!kinds.length || kinds.includes(o.event.kind)) && (!mine || o.event.people.some(p => p.userId === 'me')));

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400); };
  function shift(n: number) {
    setAnchor(a => (view === 'month' ? toKey(new Date(fromKey(a).getFullYear(), fromKey(a).getMonth() + n, 1, 12)) : addDays(a, 7 * n)));
    setSelected(null);
  }
  function pickDay(d: string) {
    if (wide) return setOpen({ type: 'day', day: d });
    setSelected(s => (s === d ? null : d));
  }
  const openEvent = (occ: Occurrence) => setOpen({ type: 'event', occ });
  const newEvent = () => setOpen({ type: 'form', editing: null });

  // Phone agenda: the chosen day, or the rest of the week or month.
  const agendaDays: string[] = [];
  if (selected) agendaDays.push(selected);
  else for (let d = inPeriod ? today : period.from; d <= period.to; d = addDays(d, 1)) if (occs.some(o => occursOn(o, d))) agendaDays.push(d);

  const title = view === 'month' ? f.date(anchor, { month: 'long', year: 'numeric' }) : `${f.dayShort(wStart)} – ${f.dayShort(addDays(wStart, 6))}`;

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>{t('title')}</h1>
          <p className={styles.pageSubtitle}>{t('subtitle')}</p>
        </div>
        {access.canAdd && <button type="button" className={`${styles.btn} ${styles.primary} ${styles.addWide}`} onClick={newEvent}><Icon name="plus" />{t('addEvent')}</button>}
      </div>

      <div className={styles.preview}>
        <span><strong>{t('previewBanner')}</strong></span>
        <span className={styles.previewAs}>
          {t('previewAs')}
          <span className={styles.seg} role="group" aria-label={t('previewAs')}>
            {(['curator', 'lead', 'member'] as PreviewRole[]).map(r => (
              <button key={r} type="button" aria-pressed={access.role === r} onClick={() => calendarActions.setPreviewRole(r)}>{t(`previewRoles.${r}`)}</button>
            ))}
          </span>
        </span>
        {access.role === 'member' && <span>{t('memberNote')}</span>}
      </div>

      <div className={styles.toolbar}>
        <span className={styles.period}>{title}</span>
        <span className={styles.seg} role="group" aria-label={t('views')}>
          <button type="button" aria-pressed={view === 'week'} onClick={() => { setView('week'); setSelected(null); }}>{t('week')}</button>
          <button type="button" aria-pressed={view === 'month'} onClick={() => { setView('month'); setSelected(null); }}>{t('month')}</button>
        </span>
        <span className={styles.navArrows}>
          <button type="button" className={styles.iconBtn} onClick={() => shift(-1)} aria-label={t('previous')}><span className={styles.flip}><Icon name="left" size={20} /></span></button>
          <button type="button" className={styles.iconBtn} onClick={() => shift(1)} aria-label={t('next')}><span className={styles.flip}><Icon name="right" size={20} /></span></button>
        </span>
        {!inPeriod && <button type="button" className={styles.btn} onClick={() => { setAnchor(today); setSelected(null); }}>{t('today')}</button>}
      </div>

      <div className={styles.chips} role="group" aria-label={t('filters')}>
        <button type="button" className={styles.chip} aria-pressed={!kinds.length && !mine} onClick={() => { setKinds([]); setMine(false); }}>{t('filterAll')}</button>
        <button type="button" className={styles.chip} aria-pressed={mine} onClick={() => setMine(m => !m)}>{t('filterMine')}</button>
        {CALENDAR_KINDS.map(k => (
          <button key={k} type="button" className={`${styles.chip} ${kindClass[k]}`} aria-pressed={kinds.includes(k)}
            onClick={() => setKinds(list => (list.includes(k) ? list.filter(x => x !== k) : [...list, k]))}>
            <i aria-hidden="true" />{t(`kinds.${k}`)}
          </button>
        ))}
      </div>

      {periodClashes.length > 0 && (
        <div><button type="button" className={styles.warn} onClick={() => setOpen({ type: 'clashes' })}><Icon name="alert" size={16} />{t('clashes', { count: periodClashes.length })}</button></div>
      )}

      {view === 'month'
        ? <MonthGrid from={grid.from} cells={grid.cells} month={fromKey(anchor).getMonth()} today={today} occs={occs} selected={selected} clashKeys={clashKeys} onSelectDay={pickDay} onOpen={openEvent} />
        : wide
          ? <WeekColumns start={wStart} today={today} occs={occs} clashKeys={clashKeys} onOpen={openEvent} />
          : <WeekStrip start={wStart} today={today} occs={occs} selected={selected} onSelect={pickDay} />}

      {!wide && (
        <div className={styles.agenda}>
          {agendaDays.map(d => <DayGroup key={d} day={d} today={today} rows={occs.filter(o => occursOn(o, d))} clashKeys={clashKeys} onOpen={openEvent} />)}
          {!selected && !agendaDays.length && (
            <p className={styles.empty}>{kinds.length || mine ? t('nothingMatches') : inPeriod ? (view === 'week' ? t('nothingElseWeek') : t('nothingElseMonth')) : t('nothingPlanned')}</p>
          )}
          {selected && <p><button type="button" className={styles.link} onClick={() => setSelected(null)}>{view === 'week' ? t('showWholeWeek') : t('showWholeMonth')}</button></p>}
        </div>
      )}

      <InviteAddress />

      {access.canAdd && <button type="button" className={styles.fab} onClick={newEvent} aria-label={t('addEvent')}><Icon name="plus" size={26} /></button>}

      {open?.type === 'event' && (
        <EventDetails occ={open.occ} clashes={clashMap.get(open.occ.key) ?? []} onClose={() => setOpen(null)}
          onEdit={() => setOpen({ type: 'form', editing: open.occ.event })} onToast={showToast} />
      )}
      {open?.type === 'form' && (
        <EventForm editing={open.editing} defaultDate={selected && selected >= today ? selected : today}
          onClose={() => setOpen(null)} onSaved={m => { setOpen(null); showToast(m); }} />
      )}
      {open?.type === 'day' && (
        <Sheet title={f.dayLong(open.day)} onClose={() => setOpen(null)}>
          <div className={styles.agenda}>
            <DayGroup day={open.day} today={today} rows={occs.filter(o => occursOn(o, open.day))} clashKeys={clashKeys} onOpen={openEvent} showLabel={false} />
          </div>
        </Sheet>
      )}
      {open?.type === 'clashes' && (
        <Sheet title={t('clashesTitle')} onClose={() => setOpen(null)}>
          <ul className={styles.people}>
            {periodClashes.map((c, i) => (
              <li key={i}><span className={styles.personName}>{t('clashLine', { name: f.person(c.userId), a: f.title(c.a.event), b: f.title(c.b.event) })}<br /><small>{f.dayLong(c.a.date)}</small></span></li>
            ))}
          </ul>
        </Sheet>
      )}
      {toast && <ModalPortal><div className={styles.toast} role="status">{toast}</div></ModalPortal>}
    </div>
  );
}
