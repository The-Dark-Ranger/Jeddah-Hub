'use client';

/* Calendar: adding or editing an event. Type and initiative are limited to
 * what the person may manage; picking people warns about anyone already
 * booked at that time. In the preview, saving keeps the event in memory only
 * and sends nothing. */
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCalendarAccess } from '@/lib/calendar/access';
import { useCalendarFormat } from '@/lib/calendar/format';
import { addDays, dayDiff, expandOccurrences } from '@/lib/calendar/occurrences';
import { PREVIEW_INITIATIVES, PREVIEW_PEOPLE, PREVIEW_TEAMS } from '@/lib/calendar/preview';
import { calendarActions, useCalendarStore } from '@/lib/calendar/store';
import type { CalendarEvent, CalendarKind, CalendarPerson } from '@/lib/calendar/types';
import { Icon } from './Icon';
import Sheet from './Sheet';
import styles from './Calendar.module.css';

interface Props {
  editing: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

type Role = CalendarPerson['role'];

export default function EventForm({ editing, defaultDate, onClose, onSaved }: Props) {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  const access = useCalendarAccess();
  const { events } = useCalendarStore();
  const initiativeIds = access.initiatives ?? Object.keys(PREVIEW_INITIATIVES);

  const [title, setTitle] = useState(editing ? f.title(editing) : '');
  const [kind, setKind] = useState<CalendarKind>(editing?.kind ?? (initiativeIds.length ? 'initiative' : 'hub'));
  const [initiativeId, setInitiativeId] = useState(editing?.initiativeId ?? (initiativeIds.length === 1 ? initiativeIds[0] : ''));
  const [startDate, setStartDate] = useState(editing?.startDate ?? defaultDate);
  const [endDate, setEndDate] = useState(editing?.endDate ?? defaultDate);
  const [startTime, setStartTime] = useState(editing?.startTime ?? '');
  const [endTime, setEndTime] = useState(editing?.endTime ?? '');
  const [weekly, setWeekly] = useState(!!editing?.weekly);
  const [location, setLocation] = useState(editing ? f.location(editing) : '');
  const [notes, setNotes] = useState(editing ? f.notes(editing) : '');
  const [people, setPeople] = useState<Record<string, Role>>(() => Object.fromEntries((editing?.people ?? []).map(p => [p.userId, p.role])));
  const [guests, setGuests] = useState(editing?.outsideGuests ? String(editing.outsideGuests) : '');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Fixed once per form, so the draft keeps the same id while it's edited.
  const [newId] = useState(() => `new-${crypto.randomUUID()}`);

  const multiDay = endDate > startDate;
  const timed = !multiDay && kind !== 'deadline';

  const draft: CalendarEvent = {
    id: editing?.id ?? newId,
    title: title.trim(),
    kind,
    initiativeId: kind === 'initiative' ? initiativeId || undefined : undefined,
    startDate,
    endDate: endDate < startDate ? startDate : endDate,
    startTime: timed ? startTime || undefined : undefined,
    endTime: timed && startTime ? endTime || undefined : undefined,
    weekly: timed && weekly,
    skipDates: editing?.skipDates,
    location: location.trim() || undefined,
    notes: notes.trim() || undefined,
    people: kind === 'deadline' ? [] : Object.entries(people).map(([userId, role]) => ({
      userId, role, reply: editing?.people.find(p => p.userId === userId)?.reply ?? (userId === 'me' ? 'yes' : 'none'),
    })),
    outsideGuests: guests ? Math.max(0, parseInt(guests, 10) || 0) : undefined,
    source: 'site',
    createdBy: editing?.createdBy ?? 'me',
  };

  // Who is already booked then (the next eight weeks, for a weekly event).
  const busy = useMemo(() => {
    const map = new Map<string, string>();
    if (!startDate || kind === 'deadline') return map;
    const horizon = draft.weekly ? addDays(startDate, 56) : draft.endDate;
    const mine = expandOccurrences([draft], startDate, horizon);
    const others = expandOccurrences(events.filter(e => e.id !== draft.id && e.kind !== 'deadline'), startDate, horizon);
    const mins = (x?: string) => (x ? Number(x.slice(0, 2)) * 60 + Number(x.slice(3)) : null);
    for (const a of mine) for (const b of others) {
      if (a.endDate < b.date || b.endDate < a.date) continue;
      const sa = mins(a.event.startTime), sb = mins(b.event.startTime);
      if (a.date === a.endDate && b.date === b.endDate && sa !== null && sb !== null) {
        if (a.date !== b.date) continue;
        const ea = mins(a.event.endTime) ?? sa + 90, eb = mins(b.event.endTime) ?? sb + 90;
        if (!(sa < eb && sb < ea)) continue;
      }
      for (const p of b.event.people) if (p.reply !== 'no' && !map.has(p.userId)) map.set(p.userId, f.title(b.event));
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft is rebuilt every render; these are its inputs
  }, [events, startDate, endDate, startTime, endTime, weekly, kind]);

  const q = search.trim().toLowerCase();
  const allIds = Object.keys(PREVIEW_PEOPLE);
  const picked = allIds.filter(id => people[id]);
  const list = q ? allIds.filter(id => PREVIEW_PEOPLE[id].en.toLowerCase().includes(q) || PREVIEW_PEOPLE[id].ar.includes(q)) : picked;

  function toggle(id: string, role: Role) {
    setPeople(prev => {
      const next = { ...prev };
      if (next[id] === role) delete next[id]; else next[id] = role;
      return next;
    });
  }

  function addTeam() {
    setPeople(prev => {
      const next = { ...prev };
      for (const id of PREVIEW_TEAMS[initiativeId] ?? []) next[id] ??= 'team';
      return next;
    });
  }

  function save() {
    if (!draft.title) return setError(t('errTitle'));
    if (kind === 'initiative' && !initiativeId) return setError(t('errInitiative'));
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) return setError(t('errTime'));
    calendarActions.save({ ...draft, titleAr: undefined, locationAr: undefined, notesAr: undefined });
    onSaved(t('savedPreview'));
  }

  const footer = (
    <>
      {editing && (
        <button type="button" className={`${styles.btn} ${styles.danger} ${styles.slim}`}
          onClick={() => { if (!confirmDelete) return setConfirmDelete(true); calendarActions.remove(editing.id); onClose(); }}>
          {confirmDelete ? t('confirmDelete') : t('delete')}
        </button>
      )}
      <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={save}>{editing ? t('save') : t('create')}</button>
    </>
  );

  return (
    <Sheet title={editing ? t('editEvent') : t('newEvent')} onClose={onClose} footer={footer} variant="form">
      <div className={styles.form}>
        {access.role === 'lead' && <p className={styles.small}>{t('leadHint')}</p>}

        <div className={styles.field}>
          <label htmlFor="cal-title">{t('fieldTitle')}</label>
          <input id="cal-title" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className={styles.field}>
          <label htmlFor="cal-kind">{t('fieldType')}</label>
          <select id="cal-kind" value={kind} onChange={e => setKind(e.target.value as CalendarKind)}>
            {access.kinds.filter(k => k !== 'initiative' || initiativeIds.length).map(k => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
          </select>
        </div>

        {kind === 'initiative' && (
          <div className={styles.field}>
            <label htmlFor="cal-initiative">{t('fieldInitiative')}</label>
            <select id="cal-initiative" value={initiativeId} onChange={e => setInitiativeId(e.target.value)}>
              <option value="">{t('chooseInitiative')}</option>
              {initiativeIds.map(id => <option key={id} value={id}>{f.initiative(id)}</option>)}
            </select>
          </div>
        )}

        <div className={styles.pair}>
          <div className={styles.field}>
            <label htmlFor="cal-start">{multiDay ? t('fieldFrom') : t('fieldDate')}</label>
            <input id="cal-start" type="date" value={startDate} onChange={e => {
              const v = e.target.value;
              const span = endDate > startDate ? dayDiff(endDate, startDate) : 0;
              setStartDate(v);
              setEndDate(v && span ? addDays(v, span) : v);
            }} />
          </div>
          <div className={styles.field}>
            <label htmlFor="cal-end">{t('fieldUntil')}</label>
            <input id="cal-end" type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value || startDate)} />
          </div>
        </div>

        {timed && (
          <>
            <div className={styles.pair}>
              <div className={styles.field}>
                <label htmlFor="cal-from">{t('fieldStarts')}</label>
                <input id="cal-from" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="cal-to">{t('fieldEnds')}</label>
                <input id="cal-to" type="time" value={endTime} disabled={!startTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>
            <label className={styles.toggle}>
              {t('repeatsWeekly')}
              <input type="checkbox" checked={weekly} onChange={e => setWeekly(e.target.checked)} />
            </label>
          </>
        )}
        {multiDay && <p className={styles.small}>{t('multiDayHint')}</p>}

        <div className={styles.field}>
          <label htmlFor="cal-location">{t('fieldLocation')}</label>
          <input id="cal-location" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div className={styles.field}>
          <label htmlFor="cal-notes">{t('fieldNotes')}</label>
          <textarea id="cal-notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {kind !== 'deadline' && (
          <div>
            <div className={styles.labelRow}>
              <span className={styles.label}>{t('people')} · {f.number(picked.length)}</span>
              {kind === 'initiative' && initiativeId && <button type="button" className={styles.link} onClick={addTeam}>{t('addInitiativeTeam')}</button>}
            </div>
            <div className={styles.field}>
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('searchMembers')} aria-label={t('searchMembers')} />
            </div>
            <ul className={`${styles.people} ${styles.pick}`}>
              {list.map(id => (
                <li key={id}>
                  <span className={styles.avatar} aria-hidden="true">{f.person(id).charAt(0)}</span>
                  <span className={styles.personName}>
                    {f.person(id)}
                    {people[id] && busy.has(id) && <span className={styles.busy}>{t('busyAt', { event: busy.get(id)! })}</span>}
                  </span>
                  <span className={styles.miniSeg} role="group" aria-label={f.person(id)}>
                    <button type="button" aria-pressed={people[id] === 'team'} onClick={() => toggle(id, 'team')}>{t('roleTeam')}</button>
                    <button type="button" aria-pressed={people[id] === 'guest'} onClick={() => toggle(id, 'guest')}>{t('roleInvite')}</button>
                  </span>
                </li>
              ))}
              {!q && !picked.length && <li className={styles.small}>{t('noPeopleYet')}</li>}
              {q && !list.length && <li className={styles.small}>{t('noMatches', { query: search })}</li>}
            </ul>
            <div className={styles.field} style={{ marginTop: '0.75rem' }}>
              <label htmlFor="cal-guests">{t('fieldOutsideGuests')}</label>
              <input id="cal-guests" type="number" inputMode="numeric" min={0} value={guests} onChange={e => setGuests(e.target.value)} />
            </div>
            <p className={styles.info} style={{ marginTop: '0.75rem' }}><Icon name="mail" />{t('invitesNote')}</p>
          </div>
        )}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
