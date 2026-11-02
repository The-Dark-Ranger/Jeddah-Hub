'use client';

/* Dashboard > Hub Activities (curators, impact officers): create and edit
 * activities, open and close their forms, read their responses, and review
 * what members send for approval. */
import { useState, useEffect } from 'react';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc,
  query, serverTimestamp, where, getCountFromServer, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLocale, useTranslations } from 'next-intl';
import { uniqueInitiativeSlug } from '@/lib/slug';
import {
  pickActivityFields, emptyActivityForm as emptyForm, emptyCustomForm,
  activityToForm, changedActivityFields,
  type ActivityChangeRequest, type ActivityFormData, type HubActivity,
} from '@/lib/activityTypes';
import { refreshPublicPages } from '@/lib/spotlight';
import { normalizeRole } from '@/lib/role';
import { omitKeys } from '@/lib/omitKeys';
import ActivityCard from '@/components/dashboard/ActivityCard';
import ActivityEditorModal from '@/components/dashboard/ActivityEditorModal';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import ActivityResponsesModal from './ActivityResponsesModal';
import ActivityReview from './ActivityReview';
import styles from './Activities.module.css';
import type { Proposal } from '@/lib/types';
import { intlLocale } from '@/lib/dates';

const RETREAT_PREFILL: Partial<ActivityFormData> = {
  eyebrow: 'Annual Gathering',
  title: 'Jeddah Retreat 2026',
  subtitle: 'Where Cultures Meet',
  description: 'A 2.5-day cultural and connection-focused gathering hosted by the Jeddah Hub for Shapers from the Kingdom and around the world.',
  date: 'April 23–25, 2026',
  location: 'Jeddah, Saudi Arabia',
  ctaText: 'Explore the Retreat',
  ctaUrl: 'https://jeddahretreat.com',
  highlights: [
    { name: 'Al-Balad', tag: 'Heritage District' },
    { name: 'teamLab', tag: 'Immersive Art' },
    { name: 'Marbat Dhaban', tag: 'Coastal Experience' },
    { name: 'Corniche', tag: 'Waterfront' },
    { name: 'Red Sea Museum', tag: 'Museum' },
    { name: 'Taibat Alhijaz', tag: 'Restaurant' },
  ],
  active: true,
  kind: 'activity',
};

type ArchiveFilter = 'active' | 'archived' | 'all';

/** What's open in the review window: a current request, or a proposal from
 *  the retired form (activity_requests) that was already waiting. */
type ReviewTarget = { kind: 'change'; request: ActivityChangeRequest } | { kind: 'legacy'; proposal: Proposal };

export default function ActivitiesPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const locale = useLocale();

  const [activities, setActivities] = useState<HubActivity[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  const [search, setSearch] = useState('');
  /** null: closed. Otherwise the activity being edited, or none for a new one. */
  const [editor, setEditor] = useState<{ editing: HubActivity | null; initial: ActivityFormData } | null>(null);
  const [responsesFor, setResponsesFor] = useState<HubActivity | null>(null);

  const [legacyProposals, setLegacyProposals] = useState<Proposal[]>([]);
  const [changeRequests, setChangeRequests] = useState<ActivityChangeRequest[]>([]);
  /* initiativeId -> title, so the queue names the initiative, not its id. */
  const [initiativeTitles, setInitiativeTitles] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<ReviewTarget | null>(null);

  const role = normalizeRole(user?.role);
  const isCurator = role === 'curator' || role === 'vice_curator';
  const canEdit = isCurator || role === 'impact_officer';
  /** The Curator or Vice Curator decide everything; impact officers only
   *  requests tied to an initiative (firestore.rules says the same). */
  const canDecide = (req: ActivityChangeRequest) => isCurator || !!req.initiativeId;

  async function fetchAll() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity')));
      const sorted = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<HubActivity, 'id'>) }))
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setActivities(sorted);

      // Which activities have new responses to check, without opening each one.
      const withForms = sorted.filter(a => a.customForm?.enabled || a.feedbackForm?.enabled);
      const counts = await Promise.all(withForms.map(a =>
        getCountFromServer(query(collection(db, 'activity_responses'),
          where('activityId', '==', a.id), where('read', '==', false)))
          .then(c => [a.id, c.data().count] as const)
          .catch(() => [a.id, 0] as const)
      ));
      setResponseCounts(Object.fromEntries(counts));
    } catch (err) {
      console.error('Failed to load activities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }

    // A review queue that fails to load shouldn't blank the list above it.
    try {
      const proposalSnap = await getDocs(query(collection(db, 'activity_requests'), where('status', '==', 'pending')));
      setLegacyProposals(proposalSnap.docs.map(d => ({ id: d.id, ...d.data() } as Proposal)));
    } catch {
      setLegacyProposals([]);
    }

    try {
      const changeSnap = await getDocs(query(collection(db, 'activity_change_requests'), where('status', '==', 'pending')));
      const reqs = changeSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<ActivityChangeRequest, 'id'>) }))
        .sort((a, b) => (a.requestedAt ?? '').localeCompare(b.requestedAt ?? ''));
      setChangeRequests(reqs);

      const uniqueIds = Array.from(new Set(reqs.map(r => r.initiativeId).filter(Boolean)));
      const titleEntries = await Promise.all(uniqueIds.map(async id => {
        try {
          const s = await getDoc(doc(db, 'initiatives', id));
          return [id, (s.data()?.title as string) || id] as const;
        } catch {
          return [id, id] as const;
        }
      }));
      setInitiativeTitles(Object.fromEntries(titleEntries));
    } catch {
      setChangeRequests([]);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once on mount
  useEffect(() => { fetchAll(); }, []);

  /** Runs a change to a live activity; on failure says so and leaves the list as it is. */
  async function applyChange(what: string, change: () => Promise<unknown>) {
    try {
      await change();
      void refreshPublicPages();
      fetchAll();
    } catch (err) {
      console.error(`Failed to ${what}:`, err);
      alert(t('saveFailed'));
    }
  }

  async function handleSave(form: ActivityFormData) {
    const editing = editor?.editing;
    const slug = await uniqueInitiativeSlug(form.title, editing?.id);
    const payload = { ...form, type: 'hub_activity', slug };
    if (editing) {
      await updateDoc(doc(db, 'initiatives', editing.id), { ...payload, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'initiatives'), { ...payload, createdAt: serverTimestamp() });
    }
    setEditor(null);
    void refreshPublicPages();
    fetchAll();
  }

  // Archived is a separate axis from active/hidden: a past retreat can be both
  // hidden and tucked out of the default list. The one link between them:
  // archiving something still live also hides it, so it can't stay on the
  // homepage by accident. Unarchiving never brings it back by itself.
  const toggleArchive = (a: HubActivity) => {
    const archived = !a.archived;
    return updateDoc(doc(db, 'initiatives', a.id), { archived, ...(archived && a.active ? { active: false } : {}) });
  };

  const handleDelete = (a: HubActivity) => {
    if (!confirm(t('deleteActivityConfirm'))) return;
    void applyChange('delete activity', () => deleteDoc(doc(db, 'initiatives', a.id)));
  };

  /** The review's outcome on the request: who decided, and their note. */
  const reviewFields = (status: 'approved' | 'declined', note: string) => ({
    status, reviewedAt: new Date().toISOString(), reviewedBy: user?.uid,
    ...(note ? { reviewNote: note } : {}),
  });

  const finishReview = () => {
    setReviewing(null);
    void refreshPublicPages();
    fetchAll();
  };

  // Applied through an explicit field allowlist (pickActivityFields), so a
  // payload can't carry an unexpected field onto the live activity even if a
  // reviewer just clicks Approve. The activity and the request's new status
  // are saved together, so a failure can't create the activity twice.
  async function approveRequest(req: ActivityChangeRequest, note: string) {
    const fields = pickActivityFields(req.payload);
    const batch = writeBatch(db);
    if (req.changeType === 'create') {
      const slug = await uniqueInitiativeSlug(String(fields.title || req.activityTitle || ''));
      batch.set(doc(collection(db, 'initiatives')), {
        eyebrow: '', subtitle: '', date: '', location: '', ctaText: '', ctaUrl: '',
        highlights: [], active: true, kind: 'activity', customForm: emptyCustomForm(),
        ...fields,
        type: 'hub_activity',
        ...(req.initiativeId ? { initiativeId: req.initiativeId } : {}),
        // Lets the member who proposed it ask for changes later.
        proposedBy: req.proposedBy,
        createdAt: serverTimestamp(),
        slug,
      });
    } else if (req.activityId) {
      batch.update(doc(db, 'initiatives', req.activityId), { ...fields, updatedAt: serverTimestamp() });
    }
    batch.update(doc(db, 'activity_change_requests', req.id), reviewFields('approved', note));
    await batch.commit();
    finishReview();
  }

  async function declineRequest(req: ActivityChangeRequest, note: string) {
    await updateDoc(doc(db, 'activity_change_requests', req.id), reviewFields('declined', note));
    finishReview();
  }

  async function approveLegacy(req: Proposal) {
    const fields = omitKeys(req, ['id', 'proposedBy', 'proposedByName', 'status', 'requestedAt']);
    const slug = await uniqueInitiativeSlug(String(fields.title || ''));
    const batch = writeBatch(db);
    batch.set(doc(collection(db, 'initiatives')), {
      eyebrow: '', subtitle: '', date: '', location: '', ctaText: '', ctaUrl: '',
      ...fields,
      type: 'hub_activity',
      active: true,
      highlights: [],
      customForm: emptyCustomForm(),
      createdAt: serverTimestamp(),
      slug,
    });
    batch.update(doc(db, 'activity_requests', req.id), { status: 'approved', reviewedAt: new Date().toISOString() });
    await batch.commit();
    finishReview();
  }

  async function declineLegacy(req: Proposal) {
    await updateDoc(doc(db, 'activity_requests', req.id), { status: 'declined', reviewedAt: new Date().toISOString() });
    finishReview();
  }

  if (!canEdit) {
    return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</p>;
  }

  const matching = activities.filter(a => matchesQuery(search, a.title, a.subtitle, a.eyebrow, a.location, a.date));
  const inTab = (f: ArchiveFilter) => matching.filter(a => (f === 'all' ? true : f === 'archived' ? !!a.archived : !a.archived));
  const visible = inTab(archiveFilter);
  const waiting = legacyProposals.length + changeRequests.length;

  const scopeOf = (req: ActivityChangeRequest) =>
    req.initiativeId ? `${t('forInitiative')} ${initiativeTitles[req.initiativeId] || req.initiativeId}` : t('forWholeHub');
  const sentOn = (iso?: string) => (iso && !isNaN(Date.parse(iso))
    ? new Date(iso).toLocaleDateString(intlLocale(locale), { month: 'short', day: 'numeric' })
    : '');

  /** Everything the review window shows for the open request. */
  function reviewWindow(target: ReviewTarget) {
    if (target.kind === 'legacy') {
      const p = target.proposal;
      return (
        <ActivityReview
          heading={p.title ?? ''}
          details={p.proposedByName ? [{ label: t('by'), value: p.proposedByName }] : []}
          fields={p}
          canDecide
          allowNote={false}
          onClose={() => setReviewing(null)}
          onApprove={() => approveLegacy(p)}
          onDecline={() => declineLegacy(p)}
        />
      );
    }
    const req = target.request;
    const live = req.changeType === 'update' ? activities.find(a => a.id === req.activityId) : undefined;
    return (
      <ActivityReview
        heading={req.activityTitle}
        details={[
          { label: t('changeTypeLabel'), value: req.changeType === 'create' ? t('changeTypeCreate') : t('changeTypeUpdate') },
          { label: t('reviewScope'), value: scopeOf(req) },
          ...(req.proposedByName ? [{ label: t('by'), value: req.proposedByName }] : []),
        ]}
        fields={live ? changedActivityFields(req.payload, live) : req.payload}
        changesOnly={!!live}
        canDecide={canDecide(req)}
        allowNote
        onClose={() => setReviewing(null)}
        onApprove={note => approveRequest(req, note)}
        onDecline={note => declineRequest(req, note)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('activitiesTitle')}</h1>
          <p className={styles.subtitle}>{t('activitiesSubtitle')}</p>
        </div>
        <button type="button" className={styles.newBtn} onClick={() => setEditor({ editing: null, initial: emptyForm() })}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('newActivityBtn')}
        </button>
      </div>

      {waiting > 0 && (
        <section className={styles.proposalsSection} aria-labelledby="activity-queue-title">
          <h2 className={styles.proposalsTitle} id="activity-queue-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {t('waitingForReview')}
            <span className={styles.proposalsBadge}>{waiting}</span>
          </h2>
          <div className={styles.proposalsList}>
            {changeRequests.map(req => (
              <div key={req.id} className={styles.proposalRow}>
                <div className={styles.proposalInfo}>
                  <span className={styles.proposalName}>{req.activityTitle}</span>
                  <span className={styles.proposalMeta}>
                    {[
                      req.changeType === 'create' ? t('changeTypeCreate') : t('changeTypeUpdate'),
                      scopeOf(req),
                      req.proposedByName && `${t('by')} ${req.proposedByName}`,
                      sentOn(req.requestedAt),
                    ].filter(Boolean).join(' · ')}
                  </span>
                  {!canDecide(req) && <span className={styles.queueHint}>{t('curatorOnlyApproval')}</span>}
                </div>
                <div className={styles.proposalActions}>
                  <button type="button" className={styles.viewProposalBtn} onClick={() => setReviewing({ kind: 'change', request: req })}>
                    {canDecide(req) ? t('reviewBtn') : t('viewDetails')}
                  </button>
                </div>
              </div>
            ))}
            {legacyProposals.map(req => (
              <div key={req.id} className={styles.proposalRow}>
                <div className={styles.proposalInfo}>
                  <span className={styles.proposalName}>{req.title}</span>
                  <span className={styles.proposalMeta}>
                    {req.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
                    {req.proposedByName && <> · {t('by')} {req.proposedByName}</>}
                  </span>
                </div>
                <div className={styles.proposalActions}>
                  <button type="button" className={styles.viewProposalBtn} onClick={() => setReviewing({ kind: 'legacy', proposal: req })}>{t('reviewBtn')}</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activities.length > 0 && (
        <div className={styles.toolbar}>
          <DashSearch value={search} onChange={setSearch} placeholder={t('searchActivitiesPh')}
            resultLabel={t('resultsCount', { count: visible.length })} />
          <div className={styles.archiveTabs}>
            {(['active', 'archived', 'all'] as const).map(f => (
              <button
                key={f}
                type="button"
                aria-pressed={archiveFilter === f}
                className={styles.archiveTab + (archiveFilter === f ? ' ' + styles.archiveTabActive : '')}
                onClick={() => setArchiveFilter(f)}
              >
                {f === 'active' ? t('filterActive') : f === 'archived' ? t('filterArchived') : t('filterAll')}
                <span className={styles.archiveTabCount}>{inTab(f).length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <DashSkeleton rows={3} header={false} label={t('loading')} />
      ) : activities.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>{t('noActivities')}</p>
          <p className={styles.emptyDesc}>{t('createFirstActivity')}</p>
          <button type="button" className={styles.prefillBtn} onClick={() => setEditor({ editing: null, initial: activityToForm(RETREAT_PREFILL) })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            {t('prefillRetreat')}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>{search ? t('noMatches') : t('noArchivedActivities')}</p>
      ) : (
        <div className={styles.list}>
          {visible.map(a => (
            <ActivityCard key={a.id} activity={a}>
              <button type="button" className={styles.editBtn} onClick={() => setEditor({ editing: a, initial: activityToForm(a) })}>{t('editActivity')}</button>
              {a.customForm?.enabled && (
                <button
                  type="button"
                  className={styles.toggleBtn + ' ' + (a.customForm.closed ? styles.toggleOn : styles.toggleOff)}
                  onClick={() => applyChange('open or close the form', () => updateDoc(doc(db, 'initiatives', a.id), { 'customForm.closed': !a.customForm?.closed }))}
                >
                  {a.customForm.closed ? t('regOpenAction') : t('regCloseAction')}
                </button>
              )}
              {a.feedbackForm?.enabled && (
                <button
                  type="button"
                  className={styles.toggleBtn + ' ' + (a.feedbackForm.closed ? styles.toggleOn : styles.toggleOff)}
                  onClick={() => applyChange('open or close the form', () => updateDoc(doc(db, 'initiatives', a.id), { 'feedbackForm.closed': !a.feedbackForm?.closed }))}
                >
                  {a.feedbackForm.closed ? t('fbOpenAction') : t('fbCloseAction')}
                </button>
              )}
              {(a.customForm?.enabled || a.feedbackForm?.enabled) && (
                <button
                  type="button"
                  className={styles.responsesBtn + (responseCounts[a.id] > 0 ? ' ' + styles.responsesBtnHasNew : '')}
                  onClick={() => setResponsesFor(a)}
                >
                  {responseCounts[a.id] > 0 ? t('viewResponsesCount', { n: responseCounts[a.id] }) : t('viewResponses')}
                </button>
              )}
              <button
                type="button"
                className={styles.toggleBtn + ' ' + (a.active ? styles.toggleOff : styles.toggleOn)}
                onClick={() => applyChange('show or hide the activity', () => updateDoc(doc(db, 'initiatives', a.id), { active: !a.active }))}
              >
                {a.active ? t('setHidden') : t('setActive')}
              </button>
              <button type="button" className={styles.toggleBtn + ' ' + styles.toggleOff} onClick={() => applyChange('archive the activity', () => toggleArchive(a))}>
                {a.archived ? t('unarchiveActivity') : t('archiveActivity')}
              </button>
              {isCurator && <button type="button" className={styles.deleteBtn} onClick={() => handleDelete(a)}>{t('deleteActivity')}</button>}
            </ActivityCard>
          ))}
        </div>
      )}

      {reviewing && reviewWindow(reviewing)}

      {editor && (
        <ActivityEditorModal
          heading={editor.editing ? t('editActivity') : t('createActivity')}
          submitLabel={editor.editing ? t('saveActivity') : t('createActivity')}
          initial={editor.initial}
          onClose={() => setEditor(null)}
          onSubmit={handleSave}
        />
      )}

      {responsesFor && (
        <ActivityResponsesModal
          activity={responsesFor}
          onClose={() => setResponsesFor(null)}
          onRead={() => setResponseCounts(c => ({ ...c, [responsesFor.id]: 0 }))}
        />
      )}
    </div>
  );
}
