'use client';

/* Calendar views: the agenda list (phones and the This week panel), the
 * phone week strip, the month grid (dots on phones, labelled events on wide
 * screens) and the seven-column week for wide screens. */
import { useTranslations } from 'next-intl';
import { addDays, dayDiff, fromKey, occursOn } from '@/lib/calendar/occurrences';
import { useCalendarFormat, type CalendarFormat } from '@/lib/calendar/format';
import type { CalendarKind, Occurrence } from '@/lib/calendar/types';
import { Icon } from './Icon';
import styles from './Calendar.module.css';

export const kindClass: Record<CalendarKind, string> = {
  initiative: styles.kInitiative, hub: styles.kHub, activity: styles.kActivity, external: styles.kExternal, deadline: styles.kDeadline,
};

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

function useTimeLabel() {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  return (o: Occurrence, day: string, short = false) => {
    if (o.date !== o.endDate) {
      if (!short) return t('dayOf', { n: f.number(dayDiff(day, o.date) + 1), total: f.number(dayDiff(o.endDate, o.date) + 1) });
      return t('allDay');
    }
    if (o.event.kind === 'deadline') return t('due');
    return o.event.startTime ? f.time(o.event.startTime) : t('allDay');
  };
}

function subLine(o: Occurrence, f: CalendarFormat, kindLabel: string) {
  return f.location(o.event) || f.initiative(o.event.initiativeId) || kindLabel;
}

export function EventRow({ occ, day, clash, onOpen }: { occ: Occurrence; day: string; clash: boolean; onOpen: () => void }) {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  const timeLabel = useTimeLabel();
  const e = occ.event;
  return (
    <button type="button" className={cx(styles.row, kindClass[e.kind])} onClick={onOpen}>
      <span className={styles.bar} aria-hidden="true" />
      <span className={styles.time}>{timeLabel(occ, day)}</span>
      <span className={styles.rowMain}>
        <span className={styles.rowTitle}>{f.title(e)}</span>
        <span className={styles.rowSub}>
          {e.source === 'invite' && <span className={styles.inviteMark} aria-hidden="true"><Icon name="mail" size={11} /></span>}
          <span>{subLine(occ, f, t(`kinds.${e.kind}`))}</span>
        </span>
      </span>
      <span className={styles.flag}>{clash && <Icon name="alert" />}</span>
    </button>
  );
}

export function DayGroup({ day, today, rows, clashKeys, onOpen, showLabel = true }: {
  day: string; today: string; rows: Occurrence[]; clashKeys: Set<string>; onOpen: (o: Occurrence) => void; showLabel?: boolean;
}) {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  const n = dayDiff(day, today);
  return (
    <>
      {showLabel && (
        <h3 className={cx(styles.dayLabel, n === 0 && styles.dayLabelToday)}>
          {n === 0 ? t('today') : n === 1 ? t('tomorrow') : f.dayLong(day)}
          {(n === 0 || n === 1) && <span>{f.dayLong(day)}</span>}
        </h3>
      )}
      {rows.length
        ? rows.map(o => <EventRow key={o.key} occ={o} day={day} clash={clashKeys.has(o.key)} onOpen={() => onOpen(o)} />)
        : <p className={styles.empty}>{t('nothingPlanned')}</p>}
    </>
  );
}

export function WeekStrip({ start, today, occs, selected, onSelect }: {
  start: string; today: string; occs: Occurrence[]; selected: string | null; onSelect: (d: string) => void;
}) {
  const f = useCalendarFormat();
  return (
    <div className={styles.strip}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const kinds = [...new Set(occs.filter(o => occursOn(o, d)).map(o => o.event.kind))].slice(0, 3);
        return (
          <button key={d} type="button" className={cx(styles.sday, d === today && styles.isToday, selected === d && styles.isSel)}
            onClick={() => onSelect(d)} aria-pressed={selected === d} aria-label={f.dayLong(d)}>
            <span className={styles.dow}>{f.date(d, { weekday: 'narrow' })}</span>
            <span className={styles.num}>{f.date(d, { day: 'numeric' })}</span>
            <span className={styles.dots} aria-hidden="true">{kinds.map(k => <i key={k} className={kindClass[k]} />)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MonthGrid({ from, cells, month, today, occs, selected, clashKeys, onSelectDay, onOpen }: {
  from: string; cells: number; month: number; today: string; occs: Occurrence[]; selected: string | null;
  clashKeys: Set<string>; onSelectDay: (d: string) => void; onOpen: (o: Occurrence) => void;
}) {
  const f = useCalendarFormat();
  return (
    <div className={styles.grid}>
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={styles.wd} aria-hidden="true">
          <span className={styles.wdShort}>{f.date(addDays(from, i), { weekday: 'narrow' })}</span>
          <span className={styles.wdLong}>{f.date(addDays(from, i), { weekday: 'short' })}</span>
        </span>
      ))}
      {Array.from({ length: cells }, (_, i) => {
        const d = addDays(from, i);
        const rows = occs.filter(o => occursOn(o, d));
        const kinds = [...new Set(rows.map(o => o.event.kind))].slice(0, 3);
        return (
          <div key={d} className={cx(styles.mday, fromKey(d).getMonth() !== month && styles.isOut, d === today && styles.isToday, selected === d && styles.isSel)}>
            <button type="button" className={styles.hit} onClick={() => onSelectDay(d)} aria-pressed={selected === d} aria-label={f.dayLong(d)} />
            <span className={styles.num}>{f.date(d, { day: 'numeric' })}</span>
            <span className={styles.dots} aria-hidden="true">{kinds.map(k => <i key={k} className={kindClass[k]} />)}</span>
            <span className={styles.chipCol}>
              {rows.slice(0, 3).map(o => (
                <button key={o.key} type="button" className={cx(styles.evChip, kindClass[o.event.kind])} onClick={() => onOpen(o)}>
                  <span className={styles.evChipText}>
                    {o.event.startTime && o.date === o.endDate && <b>{f.time(o.event.startTime)}</b>}
                    {f.title(o.event)}{clashKeys.has(o.key) ? ' ⚠' : ''}
                  </span>
                </button>
              ))}
              {rows.length > 3 && <button type="button" className={styles.more} onClick={() => onSelectDay(d)}>+{f.number(rows.length - 3)}</button>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function WeekColumns({ start, today, occs, clashKeys, onOpen }: {
  start: string; today: string; occs: Occurrence[]; clashKeys: Set<string>; onOpen: (o: Occurrence) => void;
}) {
  const f = useCalendarFormat();
  const timeLabel = useTimeLabel();
  return (
    <div className={styles.cols}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const rows = occs.filter(o => occursOn(o, d));
        return (
          <section key={d} className={cx(styles.col, d === today && styles.colToday)}>
            <h3 className={styles.colHead}><span>{f.date(d, { weekday: 'short' })}</span><b>{f.date(d, { day: 'numeric' })}</b></h3>
            {rows.map(o => (
              <button key={o.key} type="button" className={cx(styles.card, kindClass[o.event.kind])} onClick={() => onOpen(o)}>
                <span className={styles.cardTime}>
                  {timeLabel(o, d)}
                  {clashKeys.has(o.key) && <span className={styles.flag}><Icon name="alert" size={14} /></span>}
                  {o.event.source === 'invite' && <span className={styles.inviteMark} aria-hidden="true"><Icon name="mail" size={11} /></span>}
                </span>
                <span className={styles.cardTitle}>{f.title(o.event)}</span>
                {(f.location(o.event) || o.event.initiativeId) && <span className={styles.cardPlace}>{f.location(o.event) || f.initiative(o.event.initiativeId)}</span>}
              </button>
            ))}
            {!rows.length && <p className={styles.colEmpty}>—</p>}
          </section>
        );
      })}
    </div>
  );
}
