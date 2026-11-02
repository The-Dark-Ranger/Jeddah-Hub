'use client';

/* Dashboard > My Hub Activities: any member proposes an activity or workshop
 * with the full form, follows what happened to it, and asks for changes to
 * the ones they proposed or that belong to an initiative they lead. Nothing
 * here touches the live site directly: a reviewer approves each request. */
import { useState, useEffect, useCallback, useId } from 'react';
import {
  collection, getDocs, addDoc, deleteDoc, doc, query, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLocale, useTranslations } from 'next-intl';
import {
  activityToForm, emptyActivityForm,
  type ActivityChangeRequest, type ActivityFormData, type HubActivity,
} from '@/lib/activityTypes';
import { normalizeRole } from '@/lib/role';
import ActivityCard from '@/components/dashboard/ActivityCard';
import ActivityEditorModal from '@/components/dashboard/ActivityEditorModal';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
// Same page structure and classes as the curators' Hub Activities page.
import styles from '../../curator/activities/Activities.module.css';
import { intlLocale } from '@/lib/dates';

interface LedInitiative { id: string; title: string; }

/** What the editor is doing: a new proposal, a change to a live activity,
 *  correcting a request still waiting, or sending a declined one again. */
type EditorTarget =
  | { mode: 'new' }
  | { mode: 'change'; activity: HubActivity }
  | { mode: 'correct' | 'resend'; request: ActivityChangeRequest };

/** How many past decisions stay listed. */
const REVIEWED_SHOWN = 8;

/** A one-click request (hide, archive…) carries only that field, so only a
 *  request with the whole form can be reopened in the editor. */
const hasFullForm = (r: ActivityChangeRequest) => typeof r.payload?.title === 'string';

export default function MyHubActivitiesPage() {
  const formId = useId();
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const locale = useLocale();

  const [ledInitiatives, setLedInitiatives] = useState<LedInitiative[]>([]);
  const [activities, setActivities] = useState<HubActivity[]>([]);
  const [requests, setRequests] = useState<ActivityChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  /** '' means the whole hub rather than one initiative. */
  const [formInitiativeId, setFormInitiativeId] = useState('');
  const [justSent, setJustSent] = useState(false);

  const uid = user?.uid;

  const fetchAll = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    setLoading(true); setLoadFailed(false);
    try {
      const [ledSnap, activitySnap, requestSnap] = await Promise.all([
        getDocs(query(collection(db, 'initiatives'), where('leads', 'array-contains', uid))),
        getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))),
        getDocs(query(collection(db, 'activity_change_requests'), where('proposedBy', '==', uid))),
      ]);
      const led = ledSnap.docs
        .filter(d => !d.data().type) // real initiatives only
        .map(d => ({ id: d.id, title: d.data().title as string }));
      const ledIds = new Set(led.map(l => l.id));
      setLedInitiatives(led);
      setActivities(activitySnap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<HubActivity, 'id'>) }))
        .filter(a => a.proposedBy === uid || (a.initiativeId && ledIds.has(a.initiativeId)))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)));
      setRequests(requestSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<ActivityChangeRequest, 'id'>) }))
        .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '')));
    } catch (err) {
      console.error('Failed to load activities:', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once on mount
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const pending = requests.filter(r => r.status === 'pending');
  const reviewed = requests.filter(r => r.status !== 'pending').slice(0, REVIEWED_SHOWN);
  const pendingForActivity = (id: string) => pending.find(r => r.activityId === id);

  const newRequest = (changeType: 'create' | 'update', activityId: string | null, initiativeId: string, activityTitle: string, payload: Record<string, unknown>) => ({
    changeType, activityId, initiativeId, activityTitle, payload,
    proposedBy: uid,
    proposedByName: user?.displayName || user?.email || '',
    status: 'pending',
    requestedAt: new Date().toISOString(),
  });

  function openNew() {
    setFormInitiativeId(ledInitiatives[0]?.id ?? '');
    setJustSent(false);
    setEditor({ mode: 'new' });
  }

  async function handleSubmit(form: ActivityFormData) {
    if (!editor) return;
    const payload = form as unknown as Record<string, unknown>;
    if (editor.mode === 'new') {
      await addDoc(collection(db, 'activity_change_requests'), newRequest('create', null, formInitiativeId, form.title, payload));
    } else if (editor.mode === 'change') {
      const a = editor.activity;
      await addDoc(collection(db, 'activity_change_requests'), newRequest('update', a.id, a.initiativeId ?? '', form.title, payload));
    } else if (editor.mode === 'correct') {
      await updateDoc(doc(db, 'activity_change_requests', editor.request.id), {
        payload, activityTitle: form.title, requestedAt: new Date().toISOString(),
      });
    } else {
      const old = editor.request;
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'activity_change_requests')), newRequest(old.changeType, old.activityId, old.initiativeId, form.title, payload));
      batch.delete(doc(db, 'activity_change_requests', old.id));
      await batch.commit();
    }
    setEditor(null);
    setJustSent(true);
    fetchAll();
  }

  /** A one-click request on a live activity (hide, archive, open a form…). */
  async function requestChange(a: HubActivity, payload: Record<string, unknown>) {
    try {
      await addDoc(collection(db, 'activity_change_requests'), newRequest('update', a.id, a.initiativeId ?? '', a.title, payload));
      setJustSent(true);
      fetchAll();
    } catch (err) {
      console.error('Failed to send the request:', err);
      alert(t('saveFailed'));
    }
  }

  async function removeRequest(id: string) {
    try {
      await deleteDoc(doc(db, 'activity_change_requests', id));
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to remove the request:', err);
      alert(t('saveFailed'));
    }
  }

  if (loading) return <DashSkeleton rows={3} label={t('loading')} />;
  if (!normalizeRole(user?.role)) return <p className={styles.empty}>{t('accessRestricted')}</p>;

  const dateOf = (iso?: string) => (iso && !isNaN(Date.parse(iso))
    ? new Date(iso).toLocaleDateString(intlLocale(locale), { month: 'short', day: 'numeric', year: 'numeric' })
    : '');
  const typeLabel = (r: ActivityChangeRequest) => (r.changeType === 'create' ? t('changeTypeCreate') : t('changeTypeUpdate'));

  const editorProps = !editor ? null
    : editor.mode === 'new' ? { heading: t('proposeActivityBtn'), initial: emptyActivityForm(), draftKey: `activity-proposal:${uid}` }
    : editor.mode === 'change' ? { heading: t('editActivity'), initial: activityToForm(editor.activity) }
    : { heading: editor.request.activityTitle, initial: activityToForm(editor.request.payload as Partial<ActivityFormData>) };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('myActivitiesTitle')}</h1>
          <p className={styles.subtitle}>{t('myActivitiesSubtitle')}</p>
        </div>
        <button type="button" className={styles.newBtn} onClick={openNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('proposeActivityBtn')}
        </button>
      </div>

      {justSent && <p className={styles.successNote} role="status">{t('proposalSent')}</p>}
      {loadFailed && <p className={styles.modalError} role="alert">{t('activitiesLoadFailed')}</p>}

      {pending.length > 0 && (
        <section className={styles.proposalsSection} aria-labelledby="my-pending-title">
          <h2 className={styles.proposalsTitle} id="my-pending-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('pendingActivityProposals')}
            <span className={styles.proposalsBadge}>{pending.length}</span>
          </h2>
          <div className={styles.proposalsList}>
            {pending.map(r => (
              <div key={r.id} className={styles.proposalRow}>
                <div className={styles.proposalInfo}>
                  <span className={styles.proposalName}>{r.activityTitle}</span>
                  <span className={styles.proposalMeta}>{[typeLabel(r), dateOf(r.requestedAt)].filter(Boolean).join(' · ')}</span>
                </div>
                <div className={styles.proposalActions}>
                  {hasFullForm(r) && (
                    <button type="button" className={styles.viewProposalBtn} onClick={() => { setJustSent(false); setEditor({ mode: 'correct', request: r }); }}>{t('editProposal')}</button>
                  )}
                  <button type="button" className={styles.declineProposalBtn} onClick={() => removeRequest(r.id)}>{t('cancelChangeRequest')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activities.length > 0 ? (
        <section aria-labelledby="my-activities-title">
          <h2 className={styles.sectionHeading} id="my-activities-title">{t('yourActivities')}</h2>
          <div className={styles.list}>
            {activities.map(a => {
              const f = a.customForm, fb = a.feedbackForm;
              return (
                <ActivityCard key={a.id} activity={a}>
                  {pendingForActivity(a.id) ? (
                    <p className={styles.proposalMeta}>{t('changeRequestPendingNotice')}</p>
                  ) : (
                    <>
                      <button type="button" className={styles.editBtn} onClick={() => { setJustSent(false); setEditor({ mode: 'change', activity: a }); }}>{t('editActivity')}</button>
                      {f?.enabled && (
                        <button type="button" className={styles.toggleBtn + ' ' + (f.closed ? styles.toggleOn : styles.toggleOff)}
                          onClick={() => requestChange(a, { customForm: { ...f, closed: !f.closed } })}>
                          {f.closed ? t('regOpenAction') : t('regCloseAction')}
                        </button>
                      )}
                      {fb?.enabled && (
                        <button type="button" className={styles.toggleBtn + ' ' + (fb.closed ? styles.toggleOn : styles.toggleOff)}
                          onClick={() => requestChange(a, { feedbackForm: { ...fb, closed: !fb.closed } })}>
                          {fb.closed ? t('fbOpenAction') : t('fbCloseAction')}
                        </button>
                      )}
                      <button type="button" className={styles.toggleBtn + ' ' + (a.active ? styles.toggleOff : styles.toggleOn)}
                        onClick={() => requestChange(a, { active: !a.active })}>
                        {a.active ? t('setHidden') : t('setActive')}
                      </button>
                      {/* Archiving something still live also asks to hide it, as on the curators' page. */}
                      <button type="button" className={styles.toggleBtn + ' ' + styles.toggleOff}
                        onClick={() => requestChange(a, { archived: !a.archived, ...(!a.archived && a.active ? { active: false } : {}) })}>
                        {a.archived ? t('unarchiveActivity') : t('archiveActivity')}
                      </button>
                    </>
                  )}
                </ActivityCard>
              );
            })}
          </div>
        </section>
      ) : pending.length === 0 && reviewed.length === 0 && !loadFailed && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>{t('noMyActivitiesTitle')}</p>
          <p className={styles.emptyDesc}>{t('noMyActivitiesDesc')}</p>
        </div>
      )}

      {reviewed.length > 0 && (
        <section aria-labelledby="my-reviewed-title">
          <h2 className={styles.sectionHeading} id="my-reviewed-title">{t('reviewedRequests')}</h2>
          <div className={styles.proposalsList}>
            {reviewed.map(r => (
              <div key={r.id} className={styles.proposalRow}>
                <div className={styles.proposalInfo}>
                  <span className={styles.proposalName}>
                    {r.activityTitle}
                    <span className={styles.badge + ' ' + (r.status === 'approved' ? styles.badgeActive : styles.badgeRegClosed)}>
                      {r.status === 'approved' ? t('proposalApproved') : t('proposalDeclined')}
                    </span>
                  </span>
                  <span className={styles.proposalMeta}>{[typeLabel(r), dateOf(r.reviewedAt)].filter(Boolean).join(' · ')}</span>
                  {r.reviewNote && <span className={styles.reviewNote}>{t('reviewNoteFrom')} {r.reviewNote}</span>}
                </div>
                {r.status === 'declined' && (
                  <div className={styles.proposalActions}>
                    {hasFullForm(r) && (
                      <button type="button" className={styles.viewProposalBtn} onClick={() => { setJustSent(false); setEditor({ mode: 'resend', request: r }); }}>{t('editAndResend')}</button>
                    )}
                    <button type="button" className={styles.declineProposalBtn} onClick={() => removeRequest(r.id)}>{t('dismissRequest')}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {editor && editorProps && (
        <ActivityEditorModal
          heading={editorProps.heading}
          submitLabel={t('sendForApproval')}
          initial={editorProps.initial}
          draftKey={editorProps.draftKey}
          onClose={() => setEditor(null)}
          onSubmit={handleSubmit}
        >
          {editor.mode === 'new' && ledInitiatives.length > 0 && (
            <div className={styles.field}>
              <label htmlFor={`${formId}-initiative`} className={styles.label}>{t('selectInitiativeLabel')}</label>
              <select id={`${formId}-initiative`} className={styles.input} value={formInitiativeId} onChange={e => setFormInitiativeId(e.target.value)}>
                {ledInitiatives.map(init => <option key={init.id} value={init.id}>{init.title}</option>)}
                <option value="">{t('forWholeHub')}</option>
              </select>
            </div>
          )}
        </ActivityEditorModal>
      )}
    </div>
  );
}
