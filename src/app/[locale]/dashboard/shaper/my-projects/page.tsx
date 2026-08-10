'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc, documentId,
  arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import ModalPortal from '@/components/ModalPortal';
import InitiativeFormFields, {
  emptyInitiativeForm, initiativeFormToDoc, initiativeToForm, type InitiativeFormShape,
} from '@/components/InitiativeFormFields';
import { downloadInitiativeReport } from '@/lib/exportInitiative';
import { slugify, uniqueInitiativeSlug } from '@/lib/slug';
import styles from './MyProjects.module.css';
import jiStyles from '../initiatives/JoinInitiatives.module.css';

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
  members?: any[];
  slug?: string;
}

export default function MyProjects() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [projects, setProjects]   = useState<Project[]>([]);
  const [leadIds, setLeadIds]     = useState<string[]>([]);
  const [loaded, setLoaded]       = useState(false);

  /* Lead-only extras, fetched only when the user leads at least one project */
  const [users, setUsers] = useState<{ id: string; displayName?: string; email?: string }[]>([]);
  const [memberPanelOpenId, setMemberPanelOpenId] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [incomingLeaveRequests, setIncomingLeaveRequests] = useState<any[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<{ id: string; targetUserId: string; initiativeId: string }[]>([]);
  const [pendingAdds, setPendingAdds] = useState<{ id: string; targetUserId: string; initiativeId: string }[]>([]);
  /* Candidate shapers a lead can pick from to request adding — sourced from
   * public_profiles (leads can't read the private `users` collection, only
   * curators/impact officers can) rather than a per-member lookup. */
  const [directory, setDirectory] = useState<{ id: string; displayName?: string }[]>([]);
  const [addPickerOpenId, setAddPickerOpenId] = useState<string | null>(null);
  const [addPickerTarget, setAddPickerTarget] = useState('');

  /* Lead edit modal */
  const [leadEditInit, setLeadEditInit] = useState<Project | null>(null);
  const [leadForm, setLeadForm]         = useState<InitiativeFormShape>(emptyInitiativeForm);
  const [leadSaving, setLeadSaving]     = useState(false);

  const handleFormChange = useCallback((key: keyof InitiativeFormShape, value: string) => {
    setLeadForm(f => ({ ...f, [key]: value }));
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) { setLoaded(true); return; }
    setLoaded(false);
    try {
      const snap = await getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active')));
      const mine = snap.docs
        .filter(d => !(d.data() as any).type) // exclude Hub Activities
        .map(d => ({ id: d.id, ...d.data() } as Project))
        .filter(p => (p.members || []).some((m: any) => m === user.uid || m?.userId === user.uid));
      setProjects(mine);

      const leads = mine
        .filter(p => (p.members || []).some((m: any) =>
          (m.userId === user.uid || m === user.uid) && typeof m.role === 'string' && m.role.toLowerCase().includes('lead')
        ))
        .map(p => p.id);
      setLeadIds(leads);

      if (leads.length > 0) {
        const [joinSnap, leaveSnap, removalSnap, addSnap, directorySnap] = await Promise.all([
          getDocs(query(collection(db, 'join_requests'), where('initiativeId', 'in', leads), where('status', '==', 'pending'))).catch(() => null),
          getDocs(query(collection(db, 'leave_requests'), where('initiativeId', 'in', leads), where('status', '==', 'pending'))).catch(() => null),
          getDocs(query(collection(db, 'removal_requests'), where('requestedByUserId', '==', user.uid), where('status', '==', 'pending'))).catch(() => null),
          getDocs(query(collection(db, 'member_add_requests'), where('requestedByUserId', '==', user.uid), where('status', '==', 'pending'))).catch(() => null),
          getDocs(query(collection(db, 'public_profiles'), where('role', 'in', ['shaper', 'alumni']))).catch(() => null),
        ]);
        setPendingAdds(addSnap ? addSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)) : []);
        setDirectory(directorySnap ? directorySnap.docs.map(d => ({ id: d.id, ...d.data() } as any)) : []);

        setIncomingRequests(joinSnap
          ? joinSnap.docs.map(d => {
              const data = d.data();
              return { id: d.id, ...data, initiativeTitle: mine.find(p => p.id === data.initiativeId)?.title };
            })
          : []);
        setIncomingLeaveRequests(leaveSnap
          ? leaveSnap.docs.map(d => {
              const data = d.data();
              return { id: d.id, ...data, initiativeTitle: data.initiativeTitle || mine.find(p => p.id === data.initiativeId)?.title };
            })
          : []);
        setPendingRemovals(removalSnap ? removalSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)) : []);

        const ledProjects = mine.filter(p => leads.includes(p.id));
        const memberIds = ledProjects.flatMap(p => (p.members || []).map((m: any) => (typeof m === 'string' ? m : m.userId)).filter(Boolean));
        const applicantIds = joinSnap ? joinSnap.docs.map(d => d.data().userId).filter(Boolean) : [];
        const neededIds = Array.from(new Set([...memberIds, ...applicantIds]));
        if (neededIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < neededIds.length; i += 30) chunks.push(neededIds.slice(i, i + 30));
          const userSnaps = await Promise.all(
            chunks.map(chunk => getDocs(query(collection(db, 'public_profiles'), where(documentId(), 'in', chunk))).catch(() => null))
          );
          setUsers(userSnaps.filter(Boolean).flatMap(s => s!.docs.map(d => ({ id: d.id, ...d.data() } as any))));
        } else {
          setUsers([]);
        }
      } else {
        setIncomingRequests([]);
        setIncomingLeaveRequests([]);
        setPendingRemovals([]);
        setPendingAdds([]);
        setDirectory([]);
        setUsers([]);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Close modal on Escape / lock body scroll while open */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLeadEdit(); };
    if (leadEditInit) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [leadEditInit]);
  useEffect(() => {
    document.body.style.overflow = leadEditInit ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [leadEditInit]);

  const getUserLabel = (userId: string) => users.find(u => u.id === userId)?.displayName || userId;
  const toggleMemberPanel = (id: string) => setMemberPanelOpenId(prev => prev === id ? null : id);

  const openLeadEdit = (p: Project) => { setLeadEditInit(p); setLeadForm(initiativeToForm(p)); };
  const closeLeadEdit = () => { setLeadEditInit(null); setLeadForm(emptyInitiativeForm); };

  const handleLeadSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEditInit || !leadForm.title) return;
    setLeadSaving(true);
    try {
      const slug = await uniqueInitiativeSlug(leadForm.title, leadEditInit.id);
      const updated = { ...initiativeFormToDoc(leadForm), slug };
      await updateDoc(doc(db, 'initiatives', leadEditInit.id), updated);
      setProjects(prev => prev.map(p => p.id === leadEditInit.id ? { ...p, ...updated, color: updated.color ?? undefined } : p));
      closeLeadEdit();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setLeadSaving(false);
    }
  };

  const handleAcceptRequest = async (reqId: string, initiativeId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'initiatives', initiativeId), { members: arrayUnion({ userId, role: 'Member' }) });
      await deleteDoc(doc(db, 'join_requests', reqId));
      setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'join_requests', reqId), { status: 'rejected' });
      setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleApproveLeave = async (req: any) => {
    const init = projects.find(p => p.id === req.initiativeId);
    if (!init) return;
    try {
      const memberObj = (init.members || []).find((m: any) => m.userId === req.userId);
      if (memberObj) {
        const payload: Record<string, unknown> = { members: arrayRemove(memberObj) };
        if ((memberObj.role || '').toLowerCase().includes('lead')) payload.leads = arrayRemove(req.userId);
        await updateDoc(doc(db, 'initiatives', req.initiativeId), payload);
      }
      await updateDoc(doc(db, 'leave_requests', req.id), { status: 'approved' });
      setIncomingLeaveRequests(prev => prev.filter(r => r.id !== req.id));
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleDeclineLeave = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'leave_requests', reqId), { status: 'declined' });
      setIncomingLeaveRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleRequestRemoval = async (init: Project, member: any) => {
    if (!user) return;
    const memberName = getUserLabel(member.userId);
    if (!confirm(t('confirmRequestRemoval', { member: memberName, initiative: init.title }))) return;
    try {
      const ref = await addDoc(collection(db, 'removal_requests'), {
        initiativeId: init.id,
        initiativeTitle: init.title,
        targetUserId: member.userId,
        targetUserName: memberName,
        requestedByUserId: user.uid,
        requestedByName: user.displayName || user.email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      setPendingRemovals(prev => [...prev, { id: ref.id, targetUserId: member.userId, initiativeId: init.id }]);
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleCancelRemoval = async (reqId: string) => {
    const removed = pendingRemovals.find(r => r.id === reqId);
    setPendingRemovals(prev => prev.filter(r => r.id !== reqId));
    try {
      await deleteDoc(doc(db, 'removal_requests', reqId));
    } catch (err) {
      console.error(err);
      if (removed) setPendingRemovals(prev => [...prev, removed]);
      alert(t('saveFailed'));
    }
  };

  // Adding a member is request+approve, same as removal — a lead can't
  // unilaterally add someone who never asked to join (that's what
  // join_requests + handleAcceptRequest above already covers); this is for
  // a lead-initiated invite of someone specific, reviewed by the
  // curatorship before it actually lands on the initiative's roster.
  const handleRequestAddMember = async (init: Project, targetId: string) => {
    if (!user || !targetId) return;
    const targetName = directory.find(d => d.id === targetId)?.displayName || targetId;
    try {
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
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleCancelAddRequest = async (reqId: string) => {
    const removed = pendingAdds.find(r => r.id === reqId);
    setPendingAdds(prev => prev.filter(r => r.id !== reqId));
    try {
      await deleteDoc(doc(db, 'member_add_requests', reqId));
    } catch (err) {
      console.error(err);
      if (removed) setPendingAdds(prev => [...prev, removed]);
      alert(t('saveFailed'));
    }
  };

  if (!user || !loaded) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('loading')}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t('profileActiveProjects')}</h2>
        <p className={styles.pageSubtitle}>{t('myProjectsSubtitle')}</p>
      </div>

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
                  <button className={jiStyles.acceptBtn} onClick={() => handleAcceptRequest(req.id, req.initiativeId, req.userId)}>{t('acceptRequest')}</button>
                  <button className={jiStyles.rejectBtn} onClick={() => handleRejectRequest(req.id)}>{t('rejectRequest')}</button>
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
            {incomingLeaveRequests.map(req => (
              <div key={req.id} className={jiStyles.incomingRow}>
                <div className={jiStyles.incomingInfo}>
                  <span className={jiStyles.incomingUser}>{req.userName || req.userEmail}</span>
                  <span className={jiStyles.incomingMeta}>{t('wantsToLeave')} <strong>{req.initiativeTitle}</strong></span>
                </div>
                <div className={jiStyles.incomingActions}>
                  <button className={jiStyles.acceptBtn} onClick={() => handleApproveLeave(req)}>{t('approveLeave')}</button>
                  <button className={jiStyles.rejectBtn} onClick={() => handleDeclineLeave(req.id)}>{t('declineLeave')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lead edit modal */}
      {leadEditInit && (
        <ModalPortal>
        <div className={jiStyles.modalOverlay} onClick={e => { if (e.target === e.currentTarget && confirm(t('confirmDiscardChanges'))) closeLeadEdit(); }}>
          <form className={jiStyles.modal} onSubmit={handleLeadSave}>
            <div className={jiStyles.modalHeader}>
              <h3 className={jiStyles.modalTitle}>{t('editLeadInitiative')}: {leadEditInit.title}</h3>
              <button type="button" className={jiStyles.modalClose} onClick={closeLeadEdit} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={jiStyles.modalBody}>
              <InitiativeFormFields form={leadForm} onChange={handleFormChange} styles={jiStyles} />
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

      {projects.length === 0 ? (
        <div className={styles.empty}>{t('noActiveProjects')}</div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => {
            const isLead = leadIds.includes(p.id);
            const nonLeadMembers = (p.members || []).filter((m: any) => m.userId !== user?.uid);

            if (!isLead) {
              // Plain member — unchanged from the original simple clickable card.
              return (
                <Link key={p.id} href={`/projects/${p.slug || slugify(p.title)}`} className={styles.card}>
                  <div className={styles.cardBanner} style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}>
                    {!p.imageUrl && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    {p.category && <span className={styles.categoryPill}>{p.category}</span>}
                    <h3 className={styles.cardTitle}>{p.title}</h3>
                    {p.stat && <p className={styles.cardStat}>{p.stat}</p>}
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

            // Led project — full management card.
            return (
              <div key={p.id} className={styles.leadCard}>
                <div className={styles.cardBanner} style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}>
                  {!p.imageUrl && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                  )}
                </div>
                <div className={styles.cardBody}>
                  {p.category && <span className={styles.categoryPill}>{p.category}</span>}
                  <span className={styles.leadingBadge}>{t('leadingBadge')}</span>
                  <h3 className={styles.cardTitle}>{p.title}</h3>
                  {p.stat && <p className={styles.cardStat}>{p.stat}</p>}

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
                        const memberNames = Object.fromEntries((p.members || []).map((m: any) => [m.userId, getUserLabel(m.userId)]));
                        void downloadInitiativeReport(p as any, memberNames);
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

                  {memberPanelOpenId === p.id && (
                    <div className={jiStyles.memberPanel}>
                      <p className={jiStyles.memberPanelTitle}>{t('membersLabel')}</p>
                      {nonLeadMembers.length === 0 ? (
                        <p className={jiStyles.memberPanelEmpty}>{t('noTeamMembers')}</p>
                      ) : (
                        nonLeadMembers.map((m: any, idx: number) => {
                          const removal = pendingRemovals.find(r => r.targetUserId === m.userId && r.initiativeId === p.id);
                          return (
                            <div key={m.userId + idx} className={jiStyles.memberPanelItem}>
                              <div className={jiStyles.memberPanelInfo}>
                                <span className={jiStyles.memberPanelName}>{getUserLabel(m.userId)}</span>
                                <span className={jiStyles.memberPanelRole}>{m.role || 'Member'}</span>
                              </div>
                              {removal ? (
                                <div className={jiStyles.memberPanelActions}>
                                  <span className={jiStyles.removalPendingBadge}>{t('removalPending')}</span>
                                  <button className={jiStyles.cancelRemovalBtn} onClick={() => handleCancelRemoval(removal.id)}>{t('cancelRemoval')}</button>
                                </div>
                              ) : (
                                <button className={jiStyles.requestRemovalBtn} onClick={() => handleRequestRemoval(p, m)}>{t('requestRemoval')}</button>
                              )}
                            </div>
                          );
                        })
                      )}

                      {pendingAdds.filter(r => r.initiativeId === p.id).map(r => (
                        <div key={r.id} className={jiStyles.memberPanelItem}>
                          <div className={jiStyles.memberPanelInfo}>
                            <span className={jiStyles.memberPanelName}>{directory.find(d => d.id === r.targetUserId)?.displayName || r.targetUserId}</span>
                          </div>
                          <div className={jiStyles.memberPanelActions}>
                            <span className={jiStyles.removalPendingBadge}>{t('addMemberPending')}</span>
                            <button className={jiStyles.cancelRemovalBtn} onClick={() => handleCancelAddRequest(r.id)}>{t('cancelRemoval')}</button>
                          </div>
                        </div>
                      ))}

                      {addPickerOpenId === p.id ? (
                        <div className={jiStyles.addMemberRow}>
                          <select
                            className={jiStyles.addMemberSelect}
                            value={addPickerTarget}
                            onChange={e => setAddPickerTarget(e.target.value)}
                          >
                            <option value="">{t('selectShaperPrompt')}</option>
                            {directory
                              .filter(d => !(p.members || []).some((m: any) => (m.userId || m) === d.id))
                              .map(d => <option key={d.id} value={d.id}>{d.displayName || d.id}</option>)}
                          </select>
                          <button
                            className={jiStyles.addMemberSubmitBtn}
                            disabled={!addPickerTarget}
                            onClick={() => handleRequestAddMember(p, addPickerTarget)}
                          >
                            {t('sendRequest')}
                          </button>
                          <button className={jiStyles.cancelRemovalBtn} onClick={() => { setAddPickerOpenId(null); setAddPickerTarget(''); }}>
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <button className={jiStyles.addMemberBtn} onClick={() => setAddPickerOpenId(p.id)}>
                          + {t('requestAddMember')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
