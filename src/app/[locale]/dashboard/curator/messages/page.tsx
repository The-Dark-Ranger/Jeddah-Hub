'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from 'next-intl';
import styles from './Messages.module.css';

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

const SUBJECT_LABELS: Record<string, string> = {
  general: 'General Inquiry', partnership: 'Partnership',
  join: 'Joining the Hub', media: 'Media & Press', other: 'Other',
};
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
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US',
    { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const locale   = useLocale();
  const [messages, setMessages]       = useState<ContactMessage[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filter, setFilter]           = useState('all');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo]     = useState('');
  const [composeSubj, setComposeSubj] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending]         = useState(false);
  const [replyingId, setReplyingId]   = useState<string | null>(null);

  const isCurator = user?.role?.toLowerCase() === 'curator' || user?.role?.toLowerCase() === 'vice_curator';

  useEffect(() => {
    if (!isCurator) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'contact_messages'), orderBy('submittedAt', 'desc')));
        setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContactMessage)));
      } catch { /* not configured */ }
      setLoading(false);
    })();
  }, [isCurator]);

  if (!isCurator) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Access restricted to Curators.</div>;

  const handleExpand = async (msg: ContactMessage) => {
    if (expandedId === msg.id) { setExpandedId(null); return; }
    setExpandedId(msg.id);
    if (!msg.read) {
      await updateDoc(doc(db, 'contact_messages', msg.id), { read: true });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this message?')) return;
    await deleteDoc(doc(db, 'contact_messages', id));
    setMessages(prev => prev.filter(m => m.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const openReply = (msg: ContactMessage) => {
    const subjLabel = SUBJECT_LABELS[msg.subject] || msg.subject;
    const quote = `\n\n---\nOn ${new Date(msg.submittedAt).toLocaleDateString()}, ${msg.name} wrote:\n"${msg.message}"`;
    setComposeTo(msg.email);
    setComposeSubj(`Re: ${subjLabel}`);
    setComposeBody(quote);
    setReplyingId(msg.id);
    setComposeOpen(true);
  };

  const openCompose = (to = '', subj = '', body = '') => {
    setComposeTo(to); setComposeSubj(subj); setComposeBody(body);
    setReplyingId(null);
    setComposeOpen(true);
  };

  const handleSend = async () => {
    if (!composeTo) return;
    setSending(true);
    const mailUrl = `mailto:${composeTo}?subject=${encodeURIComponent(composeSubj)}&body=${encodeURIComponent(composeBody)}`;
    window.open(mailUrl);

    if (replyingId) {
      await updateDoc(doc(db, 'contact_messages', replyingId), {
        replied: true, repliedAt: new Date().toISOString(),
      });
      setMessages(prev => prev.map(m =>
        m.id === replyingId ? { ...m, replied: true, repliedAt: new Date().toISOString() } : m
      ));
    }

    setSending(false);
    setComposeOpen(false);
    setReplyingId(null);
  };

  const filtered    = filter === 'all' ? messages : messages.filter(m => m.subject === filter);
  const unreadCount = messages.filter(m => !m.read).length;
  const FILTERS     = ['all', 'general', 'partnership', 'join', 'media', 'other'];

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Contact Messages</h2>
          <p className={styles.pageSubtitle}>
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount} unread</span>}
          </p>
        </div>
        <button className={styles.composeBtn} onClick={() => openCompose()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Compose
        </button>
      </div>

      {/* Filter bar */}
      <div className={styles.filterBar}>
        {FILTERS.map(f => (
          <button key={f} className={styles.filterBtn + (filter === f ? ' ' + styles.filterBtnActive : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : SUBJECT_LABELS[f]}
            <span className={styles.filterCount}>
              {f === 'all' ? messages.length : messages.filter(m => m.subject === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* Message list */}
      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <p>No messages yet.</p>
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
                  <div className={styles.messageInfo}>
                    <span className={styles.senderName}>{msg.name}</span>
                    <span className={styles.subjectBadge} style={{ color, borderColor: color + '50', background: color + '12' }}>
                      {SUBJECT_LABELS[msg.subject] || msg.subject}
                    </span>
                    {msg.replied && (
                      <span className={styles.repliedBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Replied
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
                    <a href={`mailto:${msg.email}`} className={styles.senderEmail}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
                      </svg>
                      {msg.email}
                    </a>
                    <p className={styles.messageBody}>{msg.message}</p>
                    {msg.repliedAt && (
                      <p className={styles.repliedNote}>
                        Replied on {new Date(msg.repliedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    <div className={styles.messageActions}>
                      <button className={styles.replyBtn} onClick={() => openReply(msg)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 17 4 12 9 7"/>
                          <path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                        </svg>
                        Reply
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(msg.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                        Delete
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
        <div className={styles.overlay} onClick={() => setComposeOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{replyingId ? 'Reply' : 'New Message'}</h3>
              <button className={styles.modalClose} onClick={() => setComposeOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>To</label>
                <input className={styles.modalInput} type="email" value={composeTo}
                  onChange={e => setComposeTo(e.target.value)} placeholder="recipient@email.com" />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Subject</label>
                <input className={styles.modalInput} value={composeSubj}
                  onChange={e => setComposeSubj(e.target.value)} placeholder="Subject line" />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Message</label>
                <textarea className={styles.modalTextarea} value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder={replyingId ? 'Write your reply…' : 'Write your message…'} rows={7} />
              </div>
              <p className={styles.mailtoNote}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Will open your email client to send. The message will be marked as replied.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setComposeOpen(false)}>Cancel</button>
              <button className={styles.sendBtn} onClick={handleSend} disabled={!composeTo || sending}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                {sending ? 'Opening…' : replyingId ? 'Send Reply' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
