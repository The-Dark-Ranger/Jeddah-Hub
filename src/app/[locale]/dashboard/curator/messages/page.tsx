'use client';

/* Dashboard > Messages: messages sent through the Contact page. Replies are
 * written in the curator's own email app (a mailto: link); a message is
 * marked as replied only once the curator says the reply went out. */
import { useState, useEffect, useId, useCallback } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLocale, useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import { isValidEmail } from '@/lib/validateEmail';
import { normalizeRole } from '@/lib/role';
import { errorCode } from '@/lib/types';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import LoadFailed from '@/components/dashboard/LoadFailed';
import { useBusy } from '@/components/dashboard/useBusy';
import { useDialog } from '@/components/dashboard/useDialog';
import { useSaveFailed } from '@/components/dashboard/useSaveFailed';
import styles from './Messages.module.css';
import { intlLocale } from '@/lib/dates';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
  read?: boolean;
  replied?: boolean;
  repliedAt?: string;
}

const SUBJECT_COLORS: Record<string, string> = {
  general: '#2563eb', partnership: '#7c3aed',
  join: '#059669', media: '#d97706', other: '#64748b',
};

function formatDate(iso: string, locale: string) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return locale === 'ar' ? 'الآن' : 'just now';
  if (mins  < 60) return locale === 'ar' ? `منذ ${mins}د` : `${mins}m ago`;
  if (hours < 24) return locale === 'ar' ? `منذ ${hours}س` : `${hours}h ago`;
  if (days  < 7)  return locale === 'ar' ? `منذ ${days} أيام` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(intlLocale(locale),
    { month: 'short', day: 'numeric', year: 'numeric' });
}

const SUBJECT_KEYS: Record<string, string> = {
  general: 'subjectGeneral', partnership: 'subjectPartnership',
  join: 'subjectJoin', media: 'subjectMedia', other: 'subjectOther',
};

/** A mailto: link. The address is encoded too, so nothing in it can add
 *  recipients or fields to the link. */
const mailto = (address: string, fields: Record<string, string> = {}) => {
  const params = Object.entries(fields).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `mailto:${encodeURIComponent(address.trim())}${params ? `?${params}` : ''}`;
};

export default function MessagesPage() {
  const formId = useId();
  const titleId = useId();
  const { run, isBusy } = useBusy();
  const saveFailed = useSaveFailed();
  const { user } = useAuth();
  const locale   = useLocale();
  const t  = useTranslations('Dashboard');
  const tc = useTranslations('ContactPage');
  const subjectLabel = (subject: string) => {
    const key = SUBJECT_KEYS[subject];
    return key ? tc(key) : subject;
  };
  const [messages, setMessages]       = useState<ContactMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadFailed, setLoadFailed]   = useState(false);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filter, setFilter]           = useState('all');
  const [status, setStatus]           = useState<'all' | 'unread' | 'replied' | 'awaiting'>('all');
  const [search, setSearch]           = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo]     = useState('');
  const [composeSubj, setComposeSubj] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyingId, setReplyingId]   = useState<string | null>(null);
  /** What the compose window opened with, to tell whether closing loses anything. */
  const [composeStart, setComposeStart] = useState('');
  /** The email app was opened for a reply: now asking whether it was sent. */
  const [askSent, setAskSent]         = useState(false);

  const normRole  = normalizeRole(user?.role);
  const isCurator = normRole === 'curator' || normRole === 'vice_curator';

  const load = useCallback(async () => {
    setLoading(true); setLoadFailed(false);
    try {
      const snap = await getDocs(query(collection(db, 'contact_messages'), orderBy('submittedAt', 'desc')));
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactMessage)));
    } catch (err) {
      // Never "No messages yet" after a failed load: there may be many.
      console.error('Failed to load messages:', errorCode(err));
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once the role is known
    if (isCurator) load();
  }, [isCurator, load]);

  const closeCompose = () => { setComposeOpen(false); setReplyingId(null); setAskSent(false); };
  /** Escape and a click outside ask first, but only when a draft would be lost. */
  const requestCloseCompose = () => {
    const dirty = !askSent && JSON.stringify([composeTo, composeSubj, composeBody]) !== composeStart;
    if (dirty && !confirm(t('confirmDiscardChanges'))) return;
    closeCompose();
  };
  const dialogRef = useDialog(composeOpen, requestCloseCompose);

  if (!isCurator) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;

  const handleExpand = async (msg: ContactMessage) => {
    if (expandedId === msg.id) { setExpandedId(null); return; }
    setExpandedId(msg.id);
    if (!msg.read) {
      try {
        await updateDoc(doc(db, 'contact_messages', msg.id), { read: true });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
      } catch (err) {
        // Best-effort, the expand itself already succeeded, so a failed
        // read-flag write just leaves the unread badge stale rather than
        // blocking anything; an alert() here would be a false alarm for
        // an action the curator didn't explicitly take.
        console.error('Failed to mark the message as read:', errorCode(err));
      }
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm(t('confirmDeleteMessage'))) return;
    void run(`delete:${id}`, async () => {
      try {
        await deleteDoc(doc(db, 'contact_messages', id));
        setMessages(prev => prev.filter(m => m.id !== id));
        if (expandedId === id) setExpandedId(null);
      } catch (err) {
        console.error('Failed to delete the message:', errorCode(err));
        alert(saveFailed(err));
      }
    });
  };

  const openCompose = (to = '', subj = '', body = '', replyTo: string | null = null) => {
    setComposeTo(to); setComposeSubj(subj); setComposeBody(body);
    setComposeStart(JSON.stringify([to, subj, body]));
    setReplyingId(replyTo);
    setAskSent(false);
    setComposeOpen(true);
  };

  const openReply = (msg: ContactMessage) => {
    const quote = `\n\n---\nOn ${new Date(msg.submittedAt).toLocaleDateString()}, ${msg.name} wrote:\n"${msg.message}"`;
    openCompose(msg.email, `Re: ${subjectLabel(msg.subject)}`, quote, msg.id);
  };

  const handleSend = () => {
    if (!isValidEmail(composeTo)) { alert(t('invalidEmail')); return; }
    try {
      window.open(mailto(composeTo, { subject: composeSubj, body: composeBody }));
    } catch (err) {
      console.error('Failed to open the email app:', errorCode(err));
      alert(t('openMailFailed'));
      return;
    }
    // Only the curator knows whether the reply actually went out.
    if (replyingId) setAskSent(true);
    else closeCompose();
  };

  const markReplied = (id: string) => run(`replied:${id}`, async () => {
    const repliedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'contact_messages', id), { replied: true, repliedAt });
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, replied: true, repliedAt } : m)));
      closeCompose();
    } catch (err) {
      console.error('Failed to mark the message as replied:', errorCode(err));
      alert(saveFailed(err));
    }
  });

  const filtered = messages.filter(m =>
    (filter === 'all' || m.subject === filter)
    && (status === 'all'
      || (status === 'unread' && !m.read)
      || (status === 'replied' && m.replied)
      || (status === 'awaiting' && !m.replied))
    && matchesQuery(search, m.name, m.email, m.message, subjectLabel(m.subject)));
  const unreadCount = messages.filter(m => !m.read).length;
  const FILTERS     = ['all', 'general', 'partnership', 'join', 'media', 'other'];

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('contactMessages')}</h2>
          <p className={styles.pageSubtitle}>
            {t('messagesCount', { count: messages.length })}
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount} {t('unreadSuffix')}</span>}
          </p>
        </div>
        <button className={styles.composeBtn} onClick={() => openCompose()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('composeEmail')}
        </button>
      </div>

      {/* At a glance, each count also filters the list */}
      <div className={styles.summary}>
        {([
          ['all', t('filterAll'), messages.length],
          ['unread', t('statusUnread'), unreadCount],
          ['awaiting', t('statusAwaiting'), messages.filter(m => !m.replied).length],
          ['replied', t('repliedLabel'), messages.filter(m => m.replied).length],
        ] as const).map(([key, label, n]) => (
          <button
            key={key}
            type="button"
            className={styles.summaryItem + (status === key ? ' ' + styles.summaryActive : '')}
            onClick={() => setStatus(key)}
            aria-pressed={status === key}
          >
            <span className={styles.summaryValue}>{n}</span>
            <span className={styles.summaryLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <DashSearch
          value={search}
          onChange={setSearch}
          placeholder={t('searchMessagesPh')}
          resultLabel={t('resultsCount', { count: filtered.length })}
        />
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        {FILTERS.map(f => (
          <button key={f} className={styles.filterBtn + (filter === f ? ' ' + styles.filterBtnActive : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? t('filterAll') : subjectLabel(f)}
            <span className={styles.filterCount}>
              {f === 'all' ? messages.length : messages.filter(m => m.subject === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Message list */}
      {loading ? (
        <DashSkeleton rows={5} header={false} label={t('loading')} />
      ) : loadFailed ? (
        <LoadFailed onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <p>{search || status !== 'all' || filter !== 'all' ? t('noMatches') : t('noMessages')}</p>
        </div>
      ) : (
        <div className={styles.messageList}>
          {filtered.map(msg => {
            const isExpanded = expandedId === msg.id;
            const color      = SUBJECT_COLORS[msg.subject] || '#64748b';
            return (
              <div key={msg.id} className={styles.messageCard + (msg.read ? '' : ' ' + styles.unreadCard)}>

                <button className={styles.messageRow} onClick={() => handleExpand(msg)}>
                  <span className={styles.unreadDot + (msg.read ? ' ' + styles.unreadDotHidden : '')} />
                  <span className={styles.senderAvatar} style={{ background: color + '1f', color }} aria-hidden="true">
                    {(msg.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <div className={styles.messageInfo}>
                    <span className={styles.senderName}>{msg.name}</span>
                    <span className={styles.subjectBadge} style={{ color, borderColor: color + '50', background: color + '12' }}>
                      {subjectLabel(msg.subject)}
                    </span>
                    {msg.replied && (
                      <span className={styles.repliedBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        {t('repliedLabel')}
                      </span>
                    )}
                  </div>
                  <span className={styles.messageDate}>{formatDate(msg.submittedAt, locale)}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={styles.chevron + (isExpanded ? ' ' + styles.chevronOpen : '')}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {!isExpanded && (
                  <p className={styles.messagePreview}>
                    {msg.message.slice(0, 140)}{msg.message.length > 140 ? '…' : ''}
                  </p>
                )}

                {isExpanded && (
                  <div className={styles.messageExpanded}>
                    <a href={mailto(msg.email)} className={styles.senderEmail}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
                      </svg>
                      {msg.email}
                    </a>
                    <p className={styles.messageBody}>{msg.message}</p>
                    {msg.repliedAt && (
                      <p className={styles.repliedNote}>
                        {t('repliedOnLabel', { date: new Date(msg.repliedAt).toLocaleDateString(intlLocale(locale), { month: 'long', day: 'numeric', year: 'numeric' }) })}
                      </p>
                    )}
                    <div className={styles.messageActions}>
                      <button className={styles.replyBtn} onClick={() => openReply(msg)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 17 4 12 9 7"/>
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                        </svg>
                        {t('replyByEmail')}
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(msg.id)} disabled={isBusy(`delete:${msg.id}`)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                        {t('deleteMessage')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compose / Reply modal */}
      {composeOpen && (
        <ModalPortal>
        <div className={styles.overlay} onClick={requestCloseCompose}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 id={titleId} className={styles.modalTitle}>{replyingId ? t('replyModalTitle') : t('newMessageModalTitle')}</h3>
              <button className={styles.modalClose} onClick={closeCompose} aria-label={t('closeModal')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            {askSent && replyingId ? (<>
            <div className={styles.modalBody}>
              <p className={styles.mailtoNote} role="status">{t('replySentQuestion')}</p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeCompose}>{t('notSentYet')}</button>
              <button className={styles.sendBtn} onClick={() => void markReplied(replyingId)} disabled={isBusy(`replied:${replyingId}`)}>
                {t('markAsReplied')}
              </button>
            </div>
            </>) : (<>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label htmlFor={`${formId}-composeTo`} className={styles.modalLabel}>{t('toLabel')}</label>
                <input id={`${formId}-composeTo`} className={styles.modalInput} type="email" value={composeTo}
                  onChange={e => setComposeTo(e.target.value)} placeholder={t('phRecipientEmail')} />
              </div>
              <div className={styles.modalField}>
                <label htmlFor={`${formId}-composeSubj`} className={styles.modalLabel}>{t('subjectLabel')}</label>
                <input id={`${formId}-composeSubj`} className={styles.modalInput} value={composeSubj}
                  onChange={e => setComposeSubj(e.target.value)} placeholder={t('phSubjectLine')} />
              </div>
              <div className={styles.modalField}>
                <label htmlFor={`${formId}-composeBody`} className={styles.modalLabel}>{t('messageLabel')}</label>
                <textarea id={`${formId}-composeBody`} className={styles.modalTextarea} value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder={replyingId ? t('phWriteReply') : t('phWriteMessage')} rows={7} />
              </div>
              <p className={styles.mailtoNote}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {t('mailtoNoteConfirm')}
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeCompose}>{t('cancel')}</button>
              <button className={styles.sendBtn} onClick={handleSend} disabled={!composeTo}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                {replyingId ? t('sendReply') : t('send')}
              </button>
            </div>
            </>)}
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
