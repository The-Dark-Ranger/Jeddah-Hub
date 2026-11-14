'use client';

/* Dashboard > Active Projects: the member's initiatives; leads also edit their
 * initiative and handle its join, leave, add and remove requests. Who leads
 * comes from the initiative's `leads` array, which is what firestore.rules
 * checks, not from the role text shown on the team. */
import { useState, useEffect, useCallback, useId } from 'react';
import {
  collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc, documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import LoadFailed from '@/components/dashboard/LoadFailed';
import { useBusy } from '@/components/dashboard/useBusy';
import { useDialog } from '@/components/dashboard/useDialog';
import { useReportDownload } from '@/components/dashboard/useReportDownload';
import { useSaveFailed } from '@/components/dashboard/useSaveFailed';
import { teamRoleLabel } from '@/components/dashboard/TeamRoleSelect';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import ModalPortal from '@/components/ModalPortal';
import SearchSelect from '@/components/dashboard/SearchSelect';
import InitiativeFormFields, {
  emptyInitiativeForm, initiativeFormToDoc, initiativeToForm, type InitiativeFormShape,
} from '@/components/InitiativeFormFields';
import type { ReportInitiative } from '@/lib/initiativeReport';
import { orNull } from '@/lib/partialLoad';
import { addToTeam, removeFromTeam } from '@/lib/teamChanges';
import { slugify } from '@/lib/slug';
import styles from './MyProjects.module.css';
import jiStyles from '../initiatives/JoinInitiatives.module.css';
import { CategoryLabel } from '@/lib/categoryLabel';
import { errorCode, memberId, type LeadRequest, type MemberEntry, type MembershipRequest } from '@/lib/types';
import { safeColor } from '@/lib/activityTypes';
import { useRoleLabel } from '@/lib/roleLabel';
import { cssUrl } from '@/lib/sanitize';

interface Project {
  id: string;
  title: string;
  description?: string;
  category?: string;
  stat?: string;
  imageUrl?: string;
  images?: string[];
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  startDate?: string;
  endDate?: string;
  color?: string;
  members?: MemberEntry[];
  /** Who has lead rights (what firestore.rules checks). */
  leads?: string[];
  slug?: string;
}

type PendingRequest = { id: string; targetUserId: string; initiativeId: string };

/** A project's photo and category. The whole photo shows over a blurred copy
 *  of itself, so logos and wide images aren't cropped; a project without one
 *  shows its colour. */
function ProjectBanner({ project: p }: { project: Project }) {
  const cover = cssUrl(p.imageUrl);
  return (
    <div
      className={styles.cardBanner + (cover ? ' ' + styles.cardBannerImg : '')}
      style={{ '--card-accent': safeColor(p.color) || 'var(--primary-blue)', '--cover': cover } as React.CSSProperties}
    >
      {p.category && <span className={styles.bannerCategory}><CategoryLabel category={p.category} /></span>}
    </div>
  );
}

export default function MyProjects() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const roleLabel = useRoleLabel();
  const titleId = useId();
  const { run, isBusy } = useBusy();
  const saveFailed = useSaveFailed();
  const downloadReport = useReportDownload();

  const [projects, setProjects]   = useState<Project[]>([]);
  const [leadIds, setLeadIds]     = useState<string[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  /** Some of a lead's requests or names didn't load: what's shown may be
   *  incomplete, so the actions that depend on it wait for a retry. */
  const [extrasFailed, setExtrasFailed] = useState(false);

  /* Lead-only extras, fetched only when the user leads at least one project */
  const [users, setUsers] = useState<{ id: string; displayName?: string; email?: string }[]>([]);
  const [memberPanelOpenId, setMemberPanelOpenId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<MembershipRequest[]>([]);
  const [incomingLeaveRequests, setIncomingLeaveRequests] = useState<MembershipRequest[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<PendingRequest[]>([]);
  const [pendingAdds, setPendingAdds] = useState<PendingRequest[]>([]);
  /* Candidate shapers a lead can pick from to request adding, sourced from
   * public_profiles (leads can't read the private `users` collection, only
   * curators/impact officers can) rather than a per-member lookup. */
  const [directory, setDirectory] = useState<{ id: string; displayName?: string; displayNameAr?: string; role?: string }[]>([]);
  const [addPickerOpenId, setAddPickerOpenId] = useState<string | null>(null);
  const [addPickerTarget, setAddPickerTarget] = useState('');

  /* Lead edit modal */
  const [leadEditInit, setLeadEditInit] = useState<Project | null>(null);
  const [leadForm, setLeadForm]         = useState<InitiativeFormShape>(emptyInitiativeForm);
  /** The form as it opened, to tell whether closing would lose anything. */
  const [leadStart, setLeadStart]       = useState('');

  const handleFormChange = useCallback((key: keyof InitiativeFormShape, value: string) => {
    setLeadForm(f => ({ ...f, [key]: value }));
  }, []);

  /** Loads the page. `quiet` (retrying the requests) keeps it on screen. */
  const fetchData = useCallback(async (quiet = false) => {
    if (!user) { setLoaded(true); return; }
    if (!quiet) { setLoaded(false); setLoadFailed(false); }
    try {
      const snap = await getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active')));
      const mine = snap.docs
        .filter(d => !d.data().type) // exclude Hub Activities
        .map(d => ({ id: d.id, ...d.data() } as Project))
        .filter(p => (p.members || []).some(m => memberId(m) === user.uid) || (p.leads || []).includes(user.uid));
      const leads = mine.filter(p => (p.leads || []).includes(user.uid)).map(p => p.id);
      setProjects(mine);
      setLeadIds(leads);
      setLoadFailed(false);

      if (leads.length === 0) {
        setIncomingRequests([]);
        setIncomingLeaveRequests([]);
        setPendingRemovals([]);
        setPendingAdds([]);
        setDirectory([]);
        setUsers([]);
        setExtrasFailed(false);
        return;
      }

      const [joinSnap, leaveSnap, removalSnap, addSnap, directorySnap] = await Promise.all([
        orNull('join requests', getDocs(query(collection(db, 'join_requests'), where('initiativeId', 'in', leads), where('status', '==', 'pending')))),
        orNull('leave requests', getDocs(query(collection(db, 'leave_requests'), where('initiativeId', 'in', leads), where('status', '==', 'pending')))),
        orNull('removal requests', getDocs(query(collection(db, 'removal_requests'), where('requestedByUserId', '==', user.uid), where('status', '==', 'pending')))),
        orNull('member add requests', getDocs(query(collection(db, 'member_add_requests'), where('requestedByUserId', '==', user.uid), where('status', '==', 'pending')))),
        orNull('the member directory', getDocs(query(collection(db, 'public_profiles'), where('role', 'in', ['shaper', 'alumni'])))),
      ]);
      const titleOf = (id: string) => mine.find(p => p.id === id)?.title;
      setIncomingRequests((joinSnap?.docs ?? []).map(d => {
        const data = d.data();
        return { id: d.id, ...data, initiativeTitle: titleOf(data.initiativeId) } as MembershipRequest;
      }));
      setIncomingLeaveRequests((leaveSnap?.docs ?? []).map(d => {
        const data = d.data();
        return { id: d.id, ...data, initiativeTitle: data.initiativeTitle || titleOf(data.initiativeId) } as MembershipRequest;
      }));
      setPendingRemovals((removalSnap?.docs ?? []).map(d => ({ id: d.id, ...d.data() } as LeadRequest)));
      setPendingAdds((addSnap?.docs ?? []).map(d => ({ id: d.id, ...d.data() } as LeadRequest)));
      setDirectory((directorySnap?.docs ?? []).map(d => ({ id: d.id, ...d.data() } as { id: string; displayName?: string; displayNameAr?: string; role?: string })));

      // Names for the teams and the people asking to join.
      const memberIds = mine.filter(p => leads.includes(p.id)).flatMap(p => (p.members || []).map(memberId).filter(Boolean));
      const applicantIds = (joinSnap?.docs ?? []).map(d => d.data().userId).filter(Boolean);
      const neededIds = Array.from(new Set([...memberIds, ...applicantIds]));
      const chunks: string[][] = [];
      for (let i = 0; i < neededIds.length; i += 30) chunks.push(neededIds.slice(i, i + 30));
      const userSnaps = await Promise.all(chunks.map(chunk =>
        orNull('member names', getDocs(query(collection(db, 'public_profiles'), where(documentId(), 'in', chunk))))));
      setUsers(userSnaps.flatMap(s => (s?.docs ?? []).map(d => ({ id: d.id, ...d.data() } as { id: string; displayName?: string; email?: string }))));

      setExtrasFailed([joinSnap, leaveSnap, removalSnap, addSnap, directorySnap, ...userSnaps].some(s => !s));
    } catch (err) {
      console.error('Failed to load your projects:', errorCode(err));
      if (!quiet) setLoadFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once on mount
  useEffect(() => { fetchData(); }, [fetchData]);

  const closeLeadEdit = () => { setLeadEditInit(null); setLeadForm(emptyInitiativeForm); };
  /** Escape and a click outside ask first, but only when something would be lost. */
  const requestCloseLeadEdit = () => {
    if (JSON.stringify(leadForm) !== leadStart && !confirm(t('confirmDiscardChanges'))) return;
    closeLeadEdit();
  };
  const dialogRef = useDialog(leadEditInit !== null, requestCloseLeadEdit);

  // Members who haven't signed in yet have no public profile to name them.
  const getUserLabel = (userId: string) => users.find(u => u.id === userId)?.displayName || t('pendingMemberName');
  const toggleMemberPanel = (id: string) => setMemberPanelOpenId(prev => prev === id ? null : id);

  const openLeadEdit = (p: Project) => {
    const start = initiativeToForm(p);
    setLeadEditInit(p);
    setLeadForm(start);
    setLeadStart(JSON.stringify(start));
  };

  /** Changes one project on screen, once the same change is saved. */
  const patchProject = (id: string, change: (p: Project) => Partial<Project>) =>
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...change(p) } : p)));

  /** Runs one change, one at a time per key; on failure says so. */
  const attempt = (key: string, what: string, action: () => Promise<unknown>) => run(key, async () => {
    try {
      await action();
    } catch (err) {
      console.error(`Failed to ${what}:`, errorCode(err));
      alert(saveFailed(err));
    }
  });

  const leadSaving = isBusy('leadSave');
  const handleLeadSave = (e: React.FormEvent) => {
    e.preventDefault();
    const init = leadEditInit;
    if (!init || !leadForm.title) return;
    void attempt('leadSave', 'save the initiative', async () => {
      // The web address (slug) stays as it is: only curators and impact
      // officers set it, so a lead can't take over another project's URL.
      const updated = initiativeFormToDoc(leadForm);
      await updateDoc(doc(db, 'initiatives', init.id), updated);
      patchProject(init.id, () => ({ ...updated, color: updated.color ?? undefined }));
      closeLeadEdit();
    });
  };

  const handleAcceptRequest = (req: MembershipRequest) => attempt(`req:${req.id}`, 'accept the join request', async () => {
    const added = await addToTeam(req.initiativeId, req.userId, tx => tx.delete(doc(db, 'join_requests', req.id)));
    setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
    if (added) patchProject(req.initiativeId, p => ({ members: [...(p.members || []), { userId: req.userId, role: 'Member' }] }));
  });

  const handleRejectRequest = (reqId: string) => attempt(`req:${reqId}`, 'decline the join request', async () => {
    await updateDoc(doc(db, 'join_requests', reqId), { status: 'rejected' });
    setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
  });

  // Only for members who aren't leads: a lead can't take a fellow lead off
  // the team or out of `leads` (firestore.rules), so those requests wait for
  // the Curator or Vice Curator, and the buttons aren't offered.
  const handleApproveLeave = (req: MembershipRequest) => attempt(`req:${req.id}`, 'approve the leave request', async () => {
    await removeFromTeam(req.initiativeId, req.userId, {
      keepLeads: true,
      settle: tx => tx.update(doc(db, 'leave_requests', req.id), { status: 'approved' }),
    });
    setIncomingLeaveRequests(prev => prev.filter(r => r.id !== req.id));
    patchProject(req.initiativeId, p => ({ members: (p.members || []).filter(m => memberId(m) !== req.userId) }));
  });

  const handleDeclineLeave = (reqId: string) => attempt(`req:${reqId}`, 'decline the leave request', async () => {
    await updateDoc(doc(db, 'leave_requests', reqId), { status: 'declined' });
    setIncomingLeaveRequests(prev => prev.filter(r => r.id !== reqId));
  });

  const handleRequestRemoval = (init: Project, member: MemberEntry) => {
    if (!user) return;
    const targetId = memberId(member);
    const memberName = getUserLabel(targetId);
    if (!confirm(t('confirmRequestRemoval', { member: memberName, initiative: init.title }))) return;
    void attempt(`member:${init.id}:${targetId}`, 'request the removal', async () => {
      const ref = await addDoc(collection(db, 'removal_requests'), {
        initiativeId: init.id,
        initiativeTitle: init.title,
        targetUserId: targetId,
        targetUserName: memberName,
        requestedByUserId: user.uid,
        requestedByName: user.displayName || user.email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      setPendingRemovals(prev => [...prev, { id: ref.id, targetUserId: targetId, initiativeId: init.id }]);
    });
  };

  /** Cancels a removal or add request: gone from the screen at once, and
   *  back if deleting it fails. */
  const cancelPending = async (collectionName: string, req: PendingRequest, setList: React.Dispatch<React.SetStateAction<PendingRequest[]>>) => {
    setList(prev => prev.filter(r => r.id !== req.id));
    try {
      await deleteDoc(doc(db, collectionName, req.id));
    } catch (err) {
      console.error('Failed to cancel the request:', errorCode(err));
      setList(prev => [...prev, req]);
      alert(saveFailed(err));
    }
  };

  // Adding a member is request+approve, same as removal, a lead can't
  // unilaterally add someone who never asked to join (that's what
  // join_requests + handleAcceptRequest above already covers); this is for
  // a lead-initiated invite of someone specific, reviewed by the
  // curatorship before it actually lands on the initiative's roster.
  const handleRequestAddMember = (init: Project, targetId: string) => {
    if (!user || !targetId) return;
    const targetName = directory.find(d => d.id === targetId)?.displayName || targetId;
    void attempt(`add:${init.id}`, 'request adding the member', async () => {
      const ref = await addDoc(collection(db, 'member_add_requests'), {
        initiativeId: init.id,
        initiativeTitle: init.title,
        targetUserId: targetId,
        targetUserName: targetName,
        requestedByUserId: user.uid,
        requestedByName: user.displayName || user.email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      setPendingAdds(prev => [...prev, { id: ref.id, targetUserId: targetId, initiativeId: init.id }]);
      setAddPickerOpenId(null);
      setAddPickerTarget('');
    });
  };

  if (!user || !loaded) return <DashSkeleton rows={3} label={t('loading')} />;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t('profileActiveProjects')}</h2>
        <p className={styles.pageSubtitle}>{t('myProjectsSubtitle')}</p>
        {projects.length > 0 && (
          <div className={styles.summary}>
            <span className={styles.summaryChip}>{t('initiativesTotal', { count: projects.length })}</span>
            {leadIds.length > 0 && <span className={styles.summaryChip + ' ' + styles.summaryLead}>{t('leadingCount', { count: leadIds.filter(id => projects.some(p => p.id === id)).length })}</span>}
          </div>
        )}
      </div>

      {extrasFailed && !loadFailed && (
        <LoadFailed onRetry={() => void fetchData(true)} message={t('requestsLoadFailed')} />
      )}

      {/* Incoming join requests (for led projects) */}
      {incomingRequests.length > 0 && (
        <div className={jiStyles.incomingSection}>
          <h3 className={jiStyles.sectionTitle}>
            {t('incomingRequests')}
            <span className={jiStyles.badge}>{incomingRequests.length}</span>
          </h3>
          <div className={jiStyles.requestList}>
            {incomingRequests.map(req => (
              <div key={req.id} className={jiStyles.incomingRow}>
                <div className={jiStyles.incomingInfo}>
                  <span className={jiStyles.incomingUser}>{req.userName || req.userEmail}</span>
                  <span className={jiStyles.incomingMeta}>{t('wantsToJoin')} <strong>{req.initiativeTitle}</strong></span>
                </div>
                <div className={jiStyles.incomingActions}>
                  <button className={jiStyles.acceptBtn} disabled={isBusy(`req:${req.id}`)} onClick={() => void handleAcceptRequest(req)}>{t('acceptRequest')}</button>
                  <button className={jiStyles.rejectBtn} disabled={isBusy(`req:${req.id}`)} onClick={() => void handleRejectRequest(req.id)}>{t('rejectRequest')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incoming leave requests (for led projects) */}
      {incomingLeaveRequests.length > 0 && (
        <div className={jiStyles.incomingSection} style={{ borderInlineStartColor: 'var(--danger)' }}>
          <h3 className={jiStyles.sectionTitle}>
            {t('incomingLeaveRequests')}
            <span className={jiStyles.badge} style={{ background: 'var(--danger)' }}>{incomingLeaveRequests.length}</span>
          </h3>
          <div className={jiStyles.requestList}>
            {incomingLeaveRequests.map(req => {
              const leavingLead = !!projects.find(p => p.id === req.initiativeId)?.leads?.includes(req.userId);
              return (
                <div key={req.id} className={jiStyles.incomingRow}>
                  <div className={jiStyles.incomingInfo}>
                    <span className={jiStyles.incomingUser}>{req.userName || req.userEmail}</span>
                    <span className={jiStyles.incomingMeta}>{t('wantsToLeave')} <strong>{req.initiativeTitle}</strong></span>
                    {leavingLead && <span className={jiStyles.incomingMeta}>{t('leadLeaveCuratorOnly')}</span>}
                  </div>
                  {!leavingLead && (
                    <div className={jiStyles.incomingActions}>
                      <button className={jiStyles.acceptBtn} disabled={isBusy(`req:${req.id}`)} onClick={() => void handleApproveLeave(req)}>{t('approveLeave')}</button>
                      <button className={jiStyles.rejectBtn} disabled={isBusy(`req:${req.id}`)} onClick={() => void handleDeclineLeave(req.id)}>{t('declineLeave')}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lead edit modal */}
      {leadEditInit && (
        <ModalPortal>
        <div className={jiStyles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) requestCloseLeadEdit(); }}>
          <form ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
            className={jiStyles.modal} onSubmit={handleLeadSave}>
            <div className={jiStyles.modalHeader}>
              <h3 id={titleId} className={jiStyles.modalTitle}>{t('editLeadInitiative')}: {leadEditInit.title}</h3>
              <button type="button" className={jiStyles.modalClose} onClick={closeLeadEdit} aria-label={t('close')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={jiStyles.modalBody}>
              <InitiativeFormFields form={leadForm} onChange={handleFormChange} />
            </div>
            <div className={jiStyles.modalFooter}>
              <button type="button" className={jiStyles.modalCancelBtn} onClick={closeLeadEdit}>{t('cancel')}</button>
              <button type="submit" className={jiStyles.modalSubmitBtn} disabled={leadSaving || !leadForm.title}>
                {leadSaving ? t('savingDots') : t('saveChangesBtn')}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {loadFailed ? (
        <LoadFailed onRetry={() => void fetchData()} />
      ) : projects.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </span>
          <p>{t('noActiveProjects')}</p>
          <Link href="/dashboard/shaper/initiatives" className={styles.emptyCta}>{t('actionBrowseInitiatives')}</Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => {
            const isLead = leadIds.includes(p.id);
            const nonLeadMembers = (p.members || []).filter(m => memberId(m) !== user?.uid);

            if (!isLead) {
              // Plain member, unchanged from the original simple clickable card.
              return (
                <Link key={p.id} href={`/projects/${p.slug || slugify(p.title)}`} className={styles.card}>
                  <ProjectBanner project={p} />
                  <div className={styles.cardBody}>
                    <span className={styles.roleChip}>{t('memberDefaultRole')}</span>
                    <h3 className={styles.cardTitle}>{p.title}</h3>
                    {p.description && <p className={styles.cardDesc}>{p.description}</p>}
                    {p.stat && <p className={styles.cardStat}>{p.stat}</p>}
                    <p className={styles.cardMeta}>{t('memberCount', { count: (p.members || []).length })}</p>
                    <span className={styles.viewLink}>
                      {t('viewProject')}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            }

            // Led project, full management card.
            return (
              <div key={p.id} className={styles.leadCard}>
                <div className={styles.leadRow}>
                <ProjectBanner project={p} />
                <div className={styles.cardBody}>
                  <span className={styles.leadingBadge}>{t('leadingBadge')}</span>
                  <h3 className={styles.cardTitle}>{p.title}</h3>
                  {p.description && <p className={styles.cardDesc}>{p.description}</p>}
                  {p.stat && <p className={styles.cardStat}>{p.stat}</p>}
                  <p className={styles.cardMeta}>{t('memberCount', { count: (p.members || []).length })}</p>

                  <div className={styles.leadActions}>
                    <button
                      className={jiStyles.membersToggleBtn + (memberPanelOpenId === p.id ? ' ' + jiStyles.membersToggleBtnOpen : '')}
                      onClick={() => toggleMemberPanel(p.id)}
                    >
                      {t('viewMembers')} ({nonLeadMembers.length})
                    </button>
                    <button className={jiStyles.editLeadBtn} onClick={() => openLeadEdit(p)}>{t('editLeadInitiative')}</button>
                    <button
                      className={jiStyles.downloadLeadBtn}
                      onClick={() => {
                        const memberNames = Object.fromEntries((p.members || []).map(m => [memberId(m), getUserLabel(memberId(m))]));
                        void downloadReport(p as ReportInitiative, memberNames);
                      }}
                      title={t('downloadReport')}
                    >
                      {t('downloadReport')}
                    </button>
                    <Link href={`/projects/${p.slug || slugify(p.title)}`} className={styles.viewSiteLink}>
                      {t('viewOnSite')}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </Link>
                  </div>

                </div>
                </div>

                  {memberPanelOpenId === p.id && (
                    <div className={jiStyles.memberPanel + ' ' + styles.teamPanel}>
                      <p className={jiStyles.memberPanelTitle}>{t('viewMembers')}</p>
                      {nonLeadMembers.length === 0 ? (
                        <p className={jiStyles.memberPanelEmpty}>{t('noTeamMembers')}</p>
                      ) : (
                        <div className={styles.memberGrid}>
                        {nonLeadMembers.map((m, idx) => {
                          const mid = memberId(m);
                          const removal = pendingRemovals.find(r => r.targetUserId === mid && r.initiativeId === p.id);
                          return (
                            <div key={mid + idx} className={jiStyles.memberPanelItem}>
                              <div className={jiStyles.memberPanelInfo}>
                                <span className={jiStyles.memberPanelName}>{getUserLabel(mid)}</span>
                                <span className={jiStyles.memberPanelRole}>{teamRoleLabel(t, typeof m === 'string' ? undefined : m.role)}</span>
                              </div>
                              {removal ? (
                                <div className={jiStyles.memberPanelActions}>
                                  <span className={jiStyles.removalPendingBadge}>{t('removalPending')}</span>
                                  <button className={jiStyles.cancelRemovalBtn} onClick={() => void cancelPending('removal_requests', removal, setPendingRemovals)}>{t('cancelRemoval')}</button>
                                </div>
                              ) : (
                                // Waits for a retry while earlier requests couldn't load, so it isn't asked twice.
                                <button className={jiStyles.requestRemovalBtn} disabled={extrasFailed || isBusy(`member:${p.id}:${mid}`)}
                                  onClick={() => handleRequestRemoval(p, m)}>{t('requestRemoval')}</button>
                              )}
                            </div>
                          );
                        })}
                        </div>
                      )}

                      {pendingAdds.filter(r => r.initiativeId === p.id).map(r => (
                        <div key={r.id} className={jiStyles.memberPanelItem}>
                          <div className={jiStyles.memberPanelInfo}>
                            <span className={jiStyles.memberPanelName}>{directory.find(d => d.id === r.targetUserId)?.displayName || r.targetUserId}</span>
                          </div>
                          <div className={jiStyles.memberPanelActions}>
                            <span className={jiStyles.removalPendingBadge}>{t('addMemberPending')}</span>
                            <button className={jiStyles.cancelRemovalBtn} onClick={() => void cancelPending('member_add_requests', r, setPendingAdds)}>{t('cancelRemoval')}</button>
                          </div>
                        </div>
                      ))}

                      {addPickerOpenId === p.id ? (
                        <div className={jiStyles.addMemberRow}>
                          <SearchSelect
                            className={jiStyles.addMemberSearch}
                            autoFocus
                            options={directory
                              // Not someone already on the team or already asked for.
                              .filter(d => !(p.members || []).some(m => memberId(m) === d.id)
                                && !pendingAdds.some(r => r.initiativeId === p.id && r.targetUserId === d.id))
                              .map(d => ({ value: d.id, label: d.displayName || d.id, hint: d.role ? roleLabel(d.role) : undefined, keywords: d.displayNameAr }))
                              .sort((a, b) => a.label.localeCompare(b.label))}
                            value={addPickerTarget}
                            onChange={setAddPickerTarget}
                            placeholder={t('searchMemberPh')}
                            noResults={t('noMatches')}
                            clearLabel={t('clearSelection')}
                          />
                          <button
                            className={jiStyles.addMemberSubmitBtn}
                            disabled={!addPickerTarget || isBusy(`add:${p.id}`)}
                            onClick={() => handleRequestAddMember(p, addPickerTarget)}
                          >
                            {t('sendRequest')}
                          </button>
                          <button className={jiStyles.cancelRemovalBtn} onClick={() => { setAddPickerOpenId(null); setAddPickerTarget(''); }}>
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button className={jiStyles.addMemberBtn} disabled={extrasFailed} onClick={() => setAddPickerOpenId(p.id)}>
                          + {t('requestAddMember')}
                        </button>
                      )}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
