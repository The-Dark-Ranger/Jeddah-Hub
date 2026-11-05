'use client';

/* Calendar: one event's details. When and where, who is on it with their
 * replies, any double-booking, where it came from, and what the viewer can do:
 * add it to their own calendar, copy it for WhatsApp, edit or hide it. */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useCalendarAccess } from '@/lib/calendar/access';
import { useCalendarFormat } from '@/lib/calendar/format';
import { dayDiff } from '@/lib/calendar/occurrences';
import { googleCalendarUrl, whatsappText } from '@/lib/calendar/share';
import { calendarActions } from '@/lib/calendar/store';
import type { CalendarPerson, Clash, Occurrence } from '@/lib/calendar/types';
import { Icon } from './Icon';
import Sheet from './Sheet';
import { kindClass } from './Views';
import styles from './Calendar.module.css';

interface Props {
  occ: Occurrence;
  clashes: Clash[];
  onClose: () => void;
  onEdit: () => void;
  onToast: (message: string) => void;
}

export default function EventDetails({ occ, clashes, onClose, onEdit, onToast }: Props) {
  const t = useTranslations('Calendar');
  const f = useCalendarFormat();
  const access = useCalendarAccess();
  const [copyFallback, setCopyFallback] = useState('');
  const [confirmSkip, setConfirmSkip] = useState(false);
  const e = occ.event;
  const multi = occ.date !== occ.endDate;
  const invite = e.source === 'invite';

  const when = multi
    ? `${f.dayShort(occ.date)} – ${f.dayShort(occ.endDate)} · ${t('days', { count: dayDiff(occ.endDate, occ.date) + 1 })}`
    : [f.dayLong(occ.date), e.startTime ? `${f.time(e.startTime)}${e.endTime ? ` – ${f.time(e.endTime)}` : ''}` : e.kind === 'deadline' ? '' : t('allDay')]
      .filter(Boolean).join(' · ');

  const team = e.people.filter(p => p.role === 'team');
  const guests = e.people.filter(p => p.role === 'guest');
  const count = (r: CalendarPerson['reply']) => f.number(e.people.filter(p => p.reply === r).length);

  const clashLines = [...new Map(clashes.map(c => {
    const other = c.a.key === occ.key ? c.b : c.a;
    const whenOther = other.event.startTime && other.date === other.endDate ? f.time(other.event.startTime) : f.dayLong(other.date);
    return [`${c.userId}|${other.key}`, t('alsoAt', { name: f.person(c.userId), event: f.title(other.event), when: whenOther })];
  })).values()];

  async function share() {
    const text = whatsappText({ title: f.title(e), when, location: f.location(e), notes: f.notes(e), footer: t('whatsappFooter') });
    try {
      await navigator.clipboard.writeText(text);
      onToast(t('copied'));
    } catch {
      setCopyFallback(text);
    }
  }

  const person = (p: CalendarPerson) => (
    <li key={p.userId}>
      <span className={styles.avatar} aria-hidden="true">{f.person(p.userId).charAt(0)}</span>
      <span className={styles.personName}>{f.person(p.userId)}</span>
      {/* Replies to someone else's invite aren't visible to the hub. */}
      {!invite && <span className={`${styles.reply} ${styles[p.reply]}`}>{t(`reply.${p.reply}`)}</span>}
    </li>
  );

  const canEdit = access.canEdit(e);
  const canHide = access.canHide(e);
  const third = canEdit || canHide;

  return (
    <Sheet onClose={onClose}>
      <div className={kindClass[e.kind]}>
        <div className={styles.kicker}><i aria-hidden="true" />{f.initiative(e.initiativeId) || t(`kinds.${e.kind}`)}</div>
        <h2 className={styles.detailTitle}>{f.title(e)}</h2>
        <ul className={styles.facts}>
          <li><Icon name="clock" /><span>{when}</span></li>
          {e.weekly && <li><Icon name="repeat" /><span>{t('everyWeek')}</span></li>}
          {f.location(e) && <li><Icon name="pin" /><span>{f.location(e)}</span></li>}
          {!!e.outsideGuests && <li><Icon name="people" /><span>{t('outsideGuests', { count: f.number(e.outsideGuests) })}</span></li>}
        </ul>
        {f.notes(e) && <p className={styles.notes}>{f.notes(e)}</p>}

        <div className={styles.source}>
          {invite ? <><Icon name="mail" size={16} />{t('fromInvite', { name: f.organizer(e) })}</>
            : e.source === 'activity' ? <><Icon name="external" size={16} />{t('fromActivity')}{e.activitySlug ? <> · <Link className={styles.link} href={`/activities/${e.activitySlug}`}>{t('publicPage')}</Link></> : null}</>
            : <><Icon name="calendar" size={16} />{t('fromSite', { name: f.person(e.createdBy ?? '') })}</>}
        </div>

        {clashLines.length > 0 && (
          <div className={styles.notice} role="note"><Icon name="alert" /><div>{clashLines.map((l, i) => <p key={i}>{l}</p>)}</div></div>
        )}

        {e.people.length > 0 && (
          <p className={styles.summary}>
            {invite ? t('inviteRepliesNote') : t('repliesSummary', { yes: count('yes'), maybe: count('maybe'), no: count('no'), none: count('none') })}
          </p>
        )}
        {team.length > 0 && (
          <div className={styles.section}><h3 className={styles.sectionTitle}>{t('team')} · {f.number(team.length)}</h3><ul className={styles.people}>{team.map(person)}</ul></div>
        )}
        {guests.length > 0 && (
          <div className={styles.section}><h3 className={styles.sectionTitle}>{t('invited')} · {f.number(guests.length)}</h3><ul className={styles.people}>{guests.map(person)}</ul></div>
        )}

        <div className={styles.actions} style={{ gridTemplateColumns: `repeat(${third ? 3 : 2}, minmax(0, 1fr))` }}>
          <a className={styles.btn} href={googleCalendarUrl(occ, f.title(e), f.location(e), f.notes(e))} target="_blank" rel="noopener noreferrer">
            <Icon name="calendar" />{t('addToMyCalendar')}
          </a>
          <button type="button" className={styles.btn} onClick={share}><Icon name="share" />{t('copyForWhatsApp')}</button>
          {canEdit && <button type="button" className={styles.btn} onClick={onEdit}><Icon name="edit" />{t('edit')}</button>}
          {canHide && (
            <button type="button" className={styles.btn} onClick={() => { calendarActions.remove(e.id); onToast(t('hidden')); onClose(); }}>
              <Icon name="hide" />{t('hide')}
            </button>
          )}
        </div>

        {copyFallback && (
          <div className={`${styles.field} ${styles.section}`}>
            <label htmlFor="cal-copy">{t('copyHere')}</label>
            <textarea id="cal-copy" readOnly rows={7} value={copyFallback} onFocus={ev => ev.currentTarget.select()} />
          </div>
        )}
        {invite && <p className={`${styles.small} ${styles.center}`}>{t('managedElsewhere', { name: f.organizer(e) })}</p>}
        {canEdit && e.weekly && (
          <p className={styles.center}>
            <button type="button" className={styles.link} onClick={() => {
              if (!confirmSkip) return setConfirmSkip(true);
              calendarActions.skipWeek(e.id, occ.date);
              onClose();
            }}>
              {confirmSkip ? t('confirmSkip', { date: f.dayLong(occ.date) }) : t('skipThisWeek')}
            </button>
          </p>
        )}
      </div>
    </Sheet>
  );
}
