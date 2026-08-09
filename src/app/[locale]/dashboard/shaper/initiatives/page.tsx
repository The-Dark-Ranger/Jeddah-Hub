'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, query, where, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ModalPortal from '@/components/ModalPortal';
import InitiativeFormFields, {
  emptyInitiativeForm, initiativeFormToDoc, type InitiativeFormShape,
} from '@/components/InitiativeFormFields';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import styles from './JoinInitiatives.module.css';

interface Initiative {
  id: string; title: string; description: string; status: string;
  category?: string; stat?: string; members?: any[];
}
interface JoinRequest { id: string; initiativeId: string; status: 'pending' | 'accepted' | 'rejected'; }
interface InitiativeProposal { id: string; title: string; status: 'pending' | 'approved' | 'declined'; }

type ActivityKind = 'activity' | 'workshop';
interface ActivityProposalForm {
  title: string; kind: ActivityKind; eyebrow: string; subtitle: string;
  description: string; date: string; location: string; ctaText: string; ctaUrl: string;
}
const emptyActivityProposal: ActivityProposalForm = {
  title: '', kind: 'activity', eyebrow: '', subtitle: '',
  description: '', date: '', location: '', ctaText: '', ctaUrl: '',
};
interface ActivityProposal { id: string; title: string; status: 'pending' | 'approved' | 'declined'; }

export default function JoinInitiatives() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [myRequests, setMyRequests]   = useState<JoinRequest[]>([]);
  const [loading, setLoading]         = useState(true);

  /* Initiatives this user leads are managed from the "Active Projects" tab
   * instead — excluded here so this page stays a pure browse/join list,
   * not mixed with a lead's own management tools. */
  const [leadInitiativeIds, setLeadInitiativeIds] = useState<string[]>([]);

  /* Leave request state */
  const [myLeaveRequests, setMyLeaveRequests] = useState<{id: string; initiativeId: string; status: string}[]>([]);

  /* Propose-new-initiative modal */
  const [proposeOpen, setProposeOpen]     = useState(false);
  const [proposeForm, setProposeForm]     = useState<InitiativeFormShape>(emptyInitiativeForm);
  const [proposeSaving, setProposeSaving] = useState(false);
  const [myProposals, setMyProposals]     = useState<InitiativeProposal[]>([]);

  const handleProposeFormChange = useCallback((key: keyof InitiativeFormShape, value: string) => {
    setProposeForm(f => ({ ...f, [key]: value }));
  }, []);

  /* Propose-an-activity/workshop modal — reviewed by the curatorship
   * before it becomes a real, publicly listed Hub Activity, same as
   * proposing a whole new initiative above. */
  const [proposeActivityOpen, setProposeActivityOpen]     = useState(false);
  const [activityForm, setActivityForm]                   = useState<ActivityProposalForm>(emptyActivityProposal);
  const [activitySaving, setActivitySaving]                = useState(false);
  const [myActivityProposals, setMyActivityProposals]      = useState<ActivityProposal[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const [initSnap, reqSnap] = await Promise.all([
        getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'))),
        getDocs(query(collection(db, 'join_requests'), where('userId', '==', user.uid))),
      ]);

      // Hub Activities (dashboard/curator/activities) are stored as
      // initiatives docs tagged type:'hub_activity' — defensively excluded
      // in case one is ever also marked status:'active', so it can't leak
      // into a shaper's browsable/joinable initiatives list.
      const inits = initSnap.docs.filter(d => !(d.data() as any).type).map(d => ({ id: d.id, ...d.data() } as Initiative));
      const reqs  = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest));

      const leadIds = inits
        .filter(i => (i.members || []).some((m: any) =>
          (m.userId === user.uid || m === user.uid) &&
          typeof m.role === 'string' && m.role.toLowerCase().includes('lead')
        ))
        .map(i => i.id);
      setLeadInitiativeIds(leadIds);

      setInitiatives(inits.filter(i => !leadIds.includes(i.id)));
      setMyRequests(reqs);

      /* Fetch user's own leave requests */
      const leaveReqSnap = await getDocs(query(
        collection(db, 'leave_requests'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending'),
      ));
      setMyLeaveRequests(leaveReqSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)));

      /* Fetch this user's own proposed-initiative requests, any status,
       * so they can see pending/approved/declined outcomes. */
      const proposalsSnap = await getDocs(query(
        collection(db, 'initiative_requests'),
        where('proposedBy', '==', user.uid),
      )).catch(() => null);
      setMyProposals(proposalsSnap ? proposalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as InitiativeProposal)) : []);

      /* Same, for this user's own proposed Hub Activities/workshops. */
      const activityProposalsSnap = await getDocs(query(
        collection(db, 'activity_requests'),
        where('proposedBy', '==', user.uid),
      )).catch(() => null);
      setMyActivityProposals(activityProposalsSnap ? activityProposalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityProposal)) : []);
    } catch {
      /* Firestore not configured or permission error — show empty state */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getRequestForInit = (initId: string) =>
    myRequests.find(r => r.initiativeId === initId);

  const isAlreadyMember = (init: Initiative) =>
    (init.members || []).some((m: any) => m.userId === user?.uid || m === user?.uid);

  const handleRequest = async (initId: string) => {
    if (!user) return;
    const rejected = myRequests.find(r => r.initiativeId === initId && r.status === 'rejected');
    if (rejected) {
      setMyRequests(prev => prev.filter(r => r.id !== rejected.id));
      if (!rejected.id.startsWith('tmp_')) {
        try {
          await deleteDoc(doc(db, 'join_requests', rejected.id));
        } catch (err) {
          console.error(err);
          setMyRequests(prev => [...prev, rejected]);
          alert(t('saveFailed'));
          return;
        }
      }
    }
    const optimistic: JoinRequest = { id: 'tmp_' + Date.now(), initiativeId: initId, status: 'pending' };
    setMyRequests(prev => [...prev, optimistic]);
    try {
      const ref = await addDoc(collection(db, 'join_requests'), {
        initiativeId: initId,
        userId:      user.uid,
        userEmail:   user.email,
        userName:    user.displayName || user.email,
        status:      'pending',
        requestedAt: new Date().toISOString(),
      });
      setMyRequests(prev => prev.map(r => r.id === optimistic.id ? { ...r, id: ref.id } : r));
    } catch (err) {
      console.error(err);
      setMyRequests(prev => prev.filter(r => r.id !== optimistic.id));
      alert(t('saveFailed'));
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    const removed = myRequests.find(r => r.id === reqId);
    setMyRequests(prev => prev.filter(r => r.id !== reqId));
    if (reqId.startsWith('tmp_')) return;
    try {
      await deleteDoc(doc(db, 'join_requests', reqId));
    } catch (err) {
      console.error(err);
      if (removed) setMyRequests(prev => [...prev, removed]);
      alert(t('saveFailed'));
    }
  };

  /* Leave request handlers */
  const handleLeaveRequest = async (init: Initiative) => {
    if (!user) return;
    const optimisticId = 'tmp_' + Date.now();
    setMyLeaveRequests(prev => [...prev, { id: optimisticId, initiativeId: init.id, status: 'pending' }]);
    try {
      const ref = await addDoc(collection(db, 'leave_requests'), {
        initiativeId: init.id,
        initiativeTitle: init.title,
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      setMyLeaveRequests(prev => prev.map(r => r.id === optimisticId ? { ...r, id: ref.id } : r));
    } catch (err) {
      console.error(err);
      setMyLeaveRequests(prev => prev.filter(r => r.id !== optimisticId));
      alert(t('saveFailed'));
    }
  };

  const handleCancelLeaveRequest = async (reqId: string) => {
    const removed = myLeaveRequests.find(r => r.id === reqId);
    setMyLeaveRequests(prev => prev.filter(r => r.id !== reqId));
    if (reqId.startsWith('tmp_')) return;
    try {
      await deleteDoc(doc(db, 'leave_requests', reqId));
    } catch (err) {
      console.error(err);
      if (removed) setMyLeaveRequests(prev => [...prev, removed]);
      alert(t('saveFailed'));
    }
  };

  const openPropose  = () => { setProposeForm(emptyInitiativeForm); setProposeOpen(true); };
  const closePropose = () => { setProposeOpen(false); setProposeForm(emptyInitiativeForm); };

  const openProposeActivity  = () => { setActivityForm(emptyActivityProposal); setProposeActivityOpen(true); };
  const closeProposeActivity = () => { setProposeActivityOpen(false); setActivityForm(emptyActivityProposal); };
  const setActivityField = (key: keyof ActivityProposalForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setActivityForm(f => ({ ...f, [key]: e.target.value }));

  const handleProposeActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activityForm.title.trim()) return;
    setActivitySaving(true);
    try {
      const docRef = await addDoc(collection(db, 'activity_requests'), {
        ...activityForm,
        proposedBy: user.uid,
        proposedByName: user.displayName || user.email || 'Shaper',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      setMyActivityProposals(prev => [...prev, { id: docRef.id, title: activityForm.title, status: 'pending' }]);
      closeProposeActivity();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setActivitySaving(false);
    }
  };

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !proposeForm.title) return;
    setProposeSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'initiative_requests'), {
        ...initiativeFormToDoc(proposeForm),
        proposedBy: user.uid,
        proposedByName: user.displayName || user.email || 'Shaper',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });
      setMyProposals(prev => [...prev, { id: docRef.id, title: proposeForm.title, status: 'pending' }]);
      closePropose();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setProposeSaving(false);
    }
  };

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /></div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeaderRow}>
        <h2 className={styles.pageTitle}>{t('joinInitiativesTitle')}</h2>
        <div className={styles.proposeBtnRow}>
          <button className={styles.proposeBtn} onClick={openPropose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('proposeInitiativeBtn')}
          </button>
          <button className={styles.proposeBtn} onClick={openProposeActivity}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('proposeActivityBtn')}
          </button>
        </div>
      </div>

      {/* My proposed initiatives — pending curator review */}
      {myProposals.length > 0 && (
        <div className={styles.incomingSection}>
          <h3 className={styles.sectionTitle}>{t('myProposals')}</h3>
          <div className={styles.requestList}>
            {myProposals.map(p => (
              <div key={p.id} className={styles.incomingRow}>
                <div className={styles.incomingInfo}>
                  <span className={styles.incomingUser}>{p.title}</span>
                </div>
                <span
                  className={styles.statusPill}
                  style={{
                    color: p.status === 'approved' ? '#059669' : p.status === 'declined' ? 'var(--danger)' : '#f59e0b',
                  }}
                >
                  {p.status === 'approved' ? t('proposalApproved') : p.status === 'declined' ? t('proposalDeclined') : t('proposalPending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My proposed activities/workshops — pending curator review */}
      {myActivityProposals.length > 0 && (
        <div className={styles.incomingSection}>
          <h3 className={styles.sectionTitle}>{t('myActivityProposals')}</h3>
          <div className={styles.requestList}>
            {myActivityProposals.map(p => (
              <div key={p.id} className={styles.incomingRow}>
                <div className={styles.incomingInfo}>
                  <span className={styles.incomingUser}>{p.title}</span>
                </div>
                <span
                  className={styles.statusPill}
                  style={{
                    color: p.status === 'approved' ? '#059669' : p.status === 'declined' ? 'var(--danger)' : '#f59e0b',
                  }}
                >
                  {p.status === 'approved' ? t('proposalApproved') : p.status === 'declined' ? t('proposalDeclined') : t('proposalPending')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Propose an activity/workshop modal */}
      {proposeActivityOpen && (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) closeProposeActivity(); }}
        >
          <form className={styles.modal} onSubmit={handleProposeActivitySubmit}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('proposeActivityTitle')}</h3>
              <button type="button" className={styles.modalClose} onClick={closeProposeActivity} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.proposeHint}>{t('proposeActivityHint')}</p>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityTitleLabel')} *</label>
                <input className={styles.input} value={activityForm.title} onChange={setActivityField('title')} placeholder={t('activityTitlePh')} required />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityKindLabel')}</label>
                <select className={styles.input} value={activityForm.kind} onChange={setActivityField('kind')}>
                  <option value="activity">{t('kindActivity')}</option>
                  <option value="workshop">{t('kindWorkshop')}</option>
                </select>
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activitySubtitleLabel')}</label>
                <input className={styles.input} value={activityForm.subtitle} onChange={setActivityField('subtitle')} placeholder={t('activitySubtitlePh')} />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityDescLabel')}</label>
                <textarea className={styles.textarea} rows={3} value={activityForm.description} onChange={setActivityField('description')} placeholder={t('activityDescPh')} />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityDateLabel')}</label>
                <input className={styles.input} value={activityForm.date} onChange={setActivityField('date')} placeholder={t('activityDatePh')} />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityLocationLabel')}</label>
                <input className={styles.input} value={activityForm.location} onChange={setActivityField('location')} placeholder={t('activityLocationPh')} />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityCtaTextLabel')}</label>
                <input className={styles.input} value={activityForm.ctaText} onChange={setActivityField('ctaText')} placeholder={t('activityCtaTextPh')} />
              </div>

              <div className={styles.formField}>
                <label className={styles.label}>{t('activityCtaUrlLabel')}</label>
                <input className={styles.input} type="url" value={activityForm.ctaUrl} onChange={setActivityField('ctaUrl')} placeholder={t('activityCtaUrlPh')} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.modalCancelBtn} onClick={closeProposeActivity}>{t('cancel')}</button>
              <button type="submit" className={styles.modalSubmitBtn} disabled={activitySaving || !activityForm.title.trim()}>
                {activitySaving ? t('submittingDots') : t('submitProposalBtn')}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Propose new initiative modal */}
      {proposeOpen && (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) closePropose(); }}
        >
          <form className={styles.modal} onSubmit={handleProposeSubmit}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('proposeInitiativeTitle')}</h3>
              <button type="button" className={styles.modalClose} onClick={closePropose} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.proposeHint}>{t('proposeInitiativeHint')}</p>
              <InitiativeFormFields form={proposeForm} onChange={handleProposeFormChange} styles={styles} />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.modalCancelBtn} onClick={closePropose}>{t('cancel')}</button>
              <button type="submit" className={styles.modalSubmitBtn} disabled={proposeSaving || !proposeForm.title}>
                {proposeSaving ? t('submittingDots') : t('submitProposalBtn')}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Browsable initiatives grid — excludes the ones this user leads
       * (those live on the Active Projects tab with full management tools) */}
      <div className={styles.grid}>
        {initiatives.map(init => {
          const req    = getRequestForInit(init.id);
          const member = isAlreadyMember(init);
          return (
            <div key={init.id} className={styles.card}>
              <div className={styles.cardBody}>
                {init.category && <span className={styles.categoryPill}>{init.category}</span>}
                <h3 className={styles.cardTitle}>{init.title}</h3>
                <p className={styles.cardDesc}>{init.description}</p>
                {init.stat && <p className={styles.cardStat}>{init.stat}</p>}
              </div>
              <div className={styles.cardFooter}>
                {member ? (
                  (() => {
                    const leaveReq = myLeaveRequests.find(r => r.initiativeId === init.id);
                    if (leaveReq) return (
                      <div className={styles.pendingWrap}>
                        <span className={styles.leavePendingBadge}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                          {t('leaveRequestPending')}
                        </span>
                        <button className={styles.cancelBtn} onClick={() => handleCancelLeaveRequest(leaveReq.id)}>{t('cancelLeaveRequest')}</button>
                      </div>
                    );
                    return (
                      <div className={styles.memberFooter}>
                        <span className={styles.memberBadge}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          {t('alreadyMember')}
                        </span>
                        <button className={styles.leaveBtn} onClick={() => handleLeaveRequest(init)}>
                          {t('requestToLeave')}
                        </button>
                      </div>
                    );
                  })()
                ) : req?.status === 'pending' ? (
                  <div className={styles.pendingWrap}>
                    <span className={styles.pendingBadge}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {t('joinRequestPending')}
                    </span>
                    <button className={styles.cancelBtn} onClick={() => handleCancelRequest(req.id)}>{t('cancelRequest')}</button>
                  </div>
                ) : req?.status === 'accepted' ? (
                  <span className={styles.memberBadge}>{t('joinRequestAccepted')}</span>
                ) : (
                  <button className={styles.joinBtn} onClick={() => handleRequest(init.id)}>
                    {t('requestToJoin')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
