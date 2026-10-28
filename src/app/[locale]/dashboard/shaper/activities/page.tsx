'use client';

/* Dashboard > My Hub Activities (initiative leads): propose new activities and
 * changes; a curator approves them before they go live. */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  query, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import ModalPortal from '@/components/ModalPortal';
import {
  type ActivityFormData,
  emptyActivityForm, parseHighlights, highlightsToText, activityToForm, safeColor,
} from '@/lib/activityTypes';
import ActivityFormFields from '@/components/ActivityFormFields';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
// Same page structure/classes as the curator's Activities dashboard, a
// second lead-facing copy of ~250 lines of layout/form CSS would just be
// this file's styles going stale the next time that one changes.
import styles from '../../curator/activities/Activities.module.css';

interface Activity extends ActivityFormData {
  id: string;
  archived?: boolean;
  initiativeId?: string;
}

interface ChangeRequest {
  id: string;
  changeType: 'create' | 'update';
  activityId: string | null;
  initiativeId: string;
  activityTitle: string;
  status: 'pending' | 'approved' | 'declined';
}

interface LedInitiative { id: string; title: string; }

export default function LeadActivitiesPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [ledInitiatives, setLedInitiatives] = useState<LedInitiative[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState(emptyActivityForm());
  const [formInitiativeId, setFormInitiativeId] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const ledSnap = await getDocs(query(collection(db, 'initiatives'), where('leads', 'array-contains', user.uid)));
      const led = ledSnap.docs
        .filter(d => !(d.data() as Record<string, unknown>).type) // real initiatives only, not other leads' hub_activity docs
        .map(d => ({ id: d.id, title: (d.data() as Record<string, unknown>).title as string }));
      setLedInitiatives(led);

      if (led.length > 0) {
        const ledIds = new Set(led.map(l => l.id));
        const [activitySnap, requestSnap] = await Promise.all([
          getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))),
          getDocs(query(collection(db, 'activity_change_requests'), where('proposedBy', '==', user.uid), where('status', '==', 'pending'))),
        ]);
        const mine = activitySnap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }))
          .filter(a => a.initiativeId && ledIds.has(a.initiativeId));
        setActivities(mine);
        setPendingRequests(requestSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChangeRequest, 'id'>) })));
      } else {
        setActivities([]);
        setPendingRequests([]);
      }
    } catch (err) {
      console.error('Failed to load lead activities:', err);
      setActivities([]);
      setPendingRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once on mount
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pendingForActivity = (activityId: string) => pendingRequests.find(r => r.activityId === activityId);

  function openCreate() {
    setEditing(null);
    setForm(emptyActivityForm());
    setFormInitiativeId(ledInitiatives[0]?.id || '');
    setHighlightsText('');
    setModalOpen(true);
  }

  function openEdit(a: Activity) {
    setEditing(a);
    setForm(activityToForm(a));
    setFormInitiativeId(a.initiativeId || ledInitiatives[0]?.id || '');
    setHighlightsText(highlightsToText(a.highlights || []));
    setModalOpen(true);
  }

  async function submitRequest(changeType: 'create' | 'update', activityId: string | null, initiativeId: string, activityTitle: string, payload: Record<string, unknown>) {
    if (!user) return;
    await addDoc(collection(db, 'activity_change_requests'), {
      changeType, activityId, initiativeId, activityTitle, payload,
      proposedBy: user.uid,
      proposedByName: user.displayName || user.email || 'Shaper',
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
  }

  async function handleSave() {
    if (!form.title.trim() || !formInitiativeId) return;
    setSaving(true);
    try {
      const payload = { ...form, highlights: parseHighlights(highlightsText) };
      await submitRequest(
        editing ? 'update' : 'create',
        editing?.id ?? null,
        formInitiativeId,
        form.title,
        payload,
      );
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      console.error('Failed to submit activity change request:', err);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestToggleActive(a: Activity) {
    try {
      await submitRequest('update', a.id, a.initiativeId!, a.title, { active: !a.active });
      fetchAll();
    } catch (err) {
      console.error('Failed to request activity toggle:', err);
      alert(t('saveFailed'));
    }
  }

  // Archiving an activity that's still active also requests it be turned
  // inactive at the same time, same rule the curator's direct-write page
  // applies, so a lead can't archive-but-leave-live and forget to hide it.
  // Leads request the change like any other edit; a curator approves it.
  async function handleRequestToggleForm(a: Activity, key: 'customForm' | 'feedbackForm') {
    const f = a[key];
    if (!f) return;
    try {
      await submitRequest('update', a.id, a.initiativeId!, a.title, {
        [key]: { ...f, closed: !f.closed },
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to request registration toggle:', err);
      alert(t('saveFailed'));
    }
  }

  async function handleRequestToggleArchive(a: Activity) {
    try {
      const archived = !a.archived;
      await submitRequest('update', a.id, a.initiativeId!, a.title, {
        archived,
        ...(archived && a.active ? { active: false } : {}),
      });
      fetchAll();
    } catch (err) {
      console.error('Failed to request activity archive toggle:', err);
      alert(t('saveFailed'));
    }
  }

  async function handleCancelRequest(reqId: string) {
    try {
      await deleteDoc(doc(db, 'activity_change_requests', reqId));
      setPendingRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error('Failed to cancel change request:', err);
      alert(t('saveFailed'));
    }
  }

  if (loading) {
    return <DashSkeleton rows={3} label={t('loading')} />;
  }

  if (ledInitiatives.length === 0) {
    return <p className={styles.empty}>{t('notALeadYet')}</p>;
  }

  const pendingCreateRequests = pendingRequests.filter(r => r.changeType === 'create');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('myActivitiesTitle')}</h1>
          <p className={styles.subtitle}>{t('myActivitiesSubtitle')}</p>
        </div>
        <button className={styles.newBtn} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('proposeActivityBtn')}
        </button>
      </div>

      {pendingCreateRequests.length > 0 && (
        <div className={styles.proposalsSection}>
          <h3 className={styles.proposalsTitle}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('pendingActivityProposals')}
          </h3>
          <div className={styles.proposalsList}>
            {pendingCreateRequests.map(r => (
              <div key={r.id} className={styles.proposalRow}>
                <div className={styles.proposalInfo}>
                  <span className={styles.proposalName}>{r.activityTitle}</span>
                  <span className={styles.proposalMeta}>{t('pendingChangeBadge')}</span>
                </div>
                <div className={styles.proposalActions}>
                  <button className={styles.declineProposalBtn} onClick={() => handleCancelRequest(r.id)}>{t('cancelChangeRequest')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>{t('noActivities')}</p>
          <p className={styles.emptyDesc}>{t('myActivitiesSubtitle')}</p>
        </div>
      ) : (
        <div className={styles.list}>
          {activities.map(a => {
            const pending = pendingForActivity(a.id);
            return (
              <div
                key={a.id}
                className={styles.card + (a.active ? ' ' + styles.cardActive : '')}
                style={safeColor(a.color) ? { '--activity-accent': a.color } as React.CSSProperties : undefined}
              >
                <div className={styles.cardTop}>
                  {a.imageUrl && <img src={a.imageUrl} alt="" className={styles.cardThumb} loading="lazy" />}
                  <div className={styles.cardInfo}>
                    <div className={styles.cardBadgeRow}>
                      <span className={styles.kindBadge + ' ' + (a.kind === 'workshop' ? styles.kindWorkshop : styles.kindActivity)}>
                        {a.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
                      </span>
                      {a.eyebrow && <p className={styles.cardEyebrow}>{a.eyebrow}</p>}
                    </div>
                    <h2 className={styles.cardTitle}>{a.title}</h2>
                    {a.subtitle && <p className={styles.cardSubtitle}>{a.subtitle}</p>}
                    {(a.date || a.location) && (
                      <p className={styles.cardMeta}>{[a.date, a.location].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <span className={styles.badge + ' ' + (a.active ? styles.badgeActive : styles.badgeInactive)}>
                    {a.active ? t('activityActive') : t('activityInactive')}
                  </span>
                  {a.archived && <span className={styles.badge + ' ' + styles.badgeArchived}>{t('filterArchived')}</span>}
                  {a.customForm?.enabled && (
                    <span className={styles.badge + ' ' + (a.customForm.closed ? styles.badgeRegClosed : styles.badgeRegOpen)}>
                      {a.customForm.closed ? t('regBadgeClosed') : t('regBadgeOpen')}
                    </span>
                  )}
                  {a.feedbackForm?.enabled && (
                    <span className={styles.badge + ' ' + (a.feedbackForm.closed ? styles.badgeRegClosed : styles.badgeRegOpen)}>
                      {a.feedbackForm.closed ? t('fbBadgeClosed') : t('fbBadgeOpen')}
                    </span>
                  )}
                </div>
                {a.description && <p className={styles.cardDesc}>{a.description}</p>}
                {pending ? (
                  <p className={styles.proposalMeta}>{t('changeRequestPendingNotice')}</p>
                ) : (
                  <div className={styles.cardActions}>
                    <button className={styles.editBtn} onClick={() => openEdit(a)}>{t('editActivity')}</button>
                    {a.customForm?.enabled && (
                      <button
                        className={styles.toggleBtn + ' ' + (a.customForm.closed ? styles.toggleOn : styles.toggleOff)}
                        onClick={() => handleRequestToggleForm(a, 'customForm')}
                      >
                        {a.customForm.closed ? t('regOpenAction') : t('regCloseAction')}
                      </button>
                    )}
                    {a.feedbackForm?.enabled && (
                      <button
                        className={styles.toggleBtn + ' ' + (a.feedbackForm.closed ? styles.toggleOn : styles.toggleOff)}
                        onClick={() => handleRequestToggleForm(a, 'feedbackForm')}
                      >
                        {a.feedbackForm.closed ? t('fbOpenAction') : t('fbCloseAction')}
                      </button>
                    )}
                    <button
                      className={styles.toggleBtn + ' ' + (a.active ? styles.toggleOff : styles.toggleOn)}
                      onClick={() => handleRequestToggleActive(a)}
                    >
                      {a.active ? t('setHidden') : t('setActive')}
                    </button>
                    <button className={styles.toggleBtn + ' ' + styles.toggleOff} onClick={() => handleRequestToggleArchive(a)}>
                      {a.archived ? t('unarchiveActivity') : t('archiveActivity')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ModalPortal>
        <div className={styles.overlay} onClick={() => { if (confirm(t('confirmDiscardChanges'))) setModalOpen(false); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editing ? t('editActivity') : t('proposeActivityBtn')}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)} aria-label={t('closeModal')}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {ledInitiatives.length > 1 && (
                <div className={styles.field}>
                  <label className={styles.label}>{t('selectInitiativeLabel')} *</label>
                  <select className={styles.input} value={formInitiativeId} onChange={e => setFormInitiativeId(e.target.value)}>
                    {ledInitiatives.map(init => (
                      <option key={init.id} value={init.id}>{init.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <ActivityFormFields form={form} setForm={setForm} highlightsText={highlightsText} setHighlightsText={setHighlightsText} />
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setModalOpen(false)}>{t('cancel')}</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !form.title.trim() || !formInitiativeId}>
                {saving ? t('savingDots') : t('proposeChangesBtn')}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
