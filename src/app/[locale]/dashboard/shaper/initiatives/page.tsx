'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, query, where, deleteDoc, doc, updateDoc, documentId
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadInitiativeReport } from '@/lib/exportInitiative';
import ImageUploader from '@/components/ImageUploader';
import ModalPortal from '@/components/ModalPortal';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import styles from './JoinInitiatives.module.css';

interface Initiative {
  id: string; title: string; description: string; status: string;
  category?: string; stat?: string; members?: any[];
  problem?: string; objective?: string; impact?: string;
  startDate?: string; endDate?: string; imageUrl?: string; images?: string[];
  impactAreas?: string[]; color?: string;
}
interface JoinRequest { id: string; initiativeId: string; status: 'pending' | 'accepted' | 'rejected'; }
interface InitiativeProposal { id: string; title: string; status: 'pending' | 'approved' | 'declined'; }

const CATEGORIES = [
  'Environment', 'Education', 'Health', 'Technology',
  'Arts & Culture', 'Economic Empowerment', 'Community', 'Wellbeing', 'Economy', 'Other',
];

const emptyForm = {
  title: '', description: '', category: '', startDate: '', endDate: '',
  imageUrl: '', images: '', stat: '', problem: '', objective: '', impact: '',
  impactAreas: '', color: '',
};
type FormShape = typeof emptyForm;

/* Full form fields — identical capability to the curator edit modal */
interface LeadFormFieldsProps {
  form: FormShape;
  onChange: (key: keyof FormShape, value: string) => void;
}

function LeadFormFields({ form, onChange }: LeadFormFieldsProps) {
  const t = useTranslations('Dashboard');
  const mk = (k: keyof FormShape) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(k, e.target.value);

  return (
    <>
      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldTitle')} *</label>
        <input className={styles.input} value={form.title} onChange={mk('title')} placeholder={t('phInitiativeName')} required />
      </div>

      <div className={styles.editRow3}>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldCategory')}</label>
          <select className={styles.input} value={form.category} onChange={mk('category')}>
            <option value="">{t('categorySelectPrompt')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldStartDate')}</label>
          <input className={styles.input} type="date" value={form.startDate} onChange={mk('startDate')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldEndDate')}</label>
          <input className={styles.input} type="date" value={form.endDate} onChange={mk('endDate')} />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldKeyStat')}</label>
        <input className={styles.input} value={form.stat} onChange={mk('stat')} placeholder={t('phStat')} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldDescription')} *</label>
        <textarea className={styles.textarea} value={form.description} onChange={mk('description')} placeholder={t('phDescription')} required rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldProblem')}</label>
        <textarea className={styles.textarea} value={form.problem} onChange={mk('problem')} placeholder={t('phProblem')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldObjective')}</label>
        <textarea className={styles.textarea} value={form.objective} onChange={mk('objective')} placeholder={t('phObjective')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldImpact')}</label>
        <textarea className={styles.textarea} value={form.impact} onChange={mk('impact')} placeholder={t('phImpact')} rows={2} />
      </div>

      <div className={styles.editRow}>
        <div className={styles.formField}>
          <label className={styles.label}>
            {t('fieldImpactAreas')}
            <span className={styles.fieldHint}>{t('fieldImpactAreasHint')}</span>
          </label>
          <input className={styles.input} value={form.impactAreas} onChange={mk('impactAreas')} placeholder={t('phImpactAreas')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldThemeColor')}</label>
          <div className={styles.colorRow}>
            <input type="color" className={styles.colorInput} value={form.color || '#0F5A9F'} onChange={mk('color')} />
            <span className={styles.colorHex}>{form.color || t('fieldThemeColorNone')}</span>
            {form.color && (
              <button type="button" className={styles.colorClear} onClick={() => onChange('color', '')}>×</button>
            )}
          </div>
        </div>
      </div>

      <ImageUploader coverUrl={form.imageUrl} photos={form.images} onChange={onChange} />
    </>
  );
}

function formToDoc(f: FormShape) {
  return {
    title:       f.title,
    description: f.description,
    category:    f.category,
    startDate:   f.startDate,
    endDate:     f.endDate,
    imageUrl:    f.imageUrl,
    images:      f.images      ? f.images.split('\n').map(s => s.trim()).filter(Boolean) : [],
    stat:        f.stat,
    problem:     f.problem,
    objective:   f.objective,
    impact:      f.impact,
    impactAreas: f.impactAreas ? f.impactAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
    color:       f.color || null,
  };
}

export default function JoinInitiatives() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [myRequests, setMyRequests]   = useState<JoinRequest[]>([]);
  const [loading, setLoading]         = useState(true);

  /* Initiatives where this user is a lead */
  const [leadInitiativeIds, setLeadInitiativeIds] = useState<string[]>([]);
  /* Pending join requests for initiatives where user is a lead */
  const [incomingRequests, setIncomingRequests]   = useState<any[]>([]);

  /* Leave request state */
  const [myLeaveRequests, setMyLeaveRequests] = useState<{id: string; initiativeId: string; status: string}[]>([]);
  const [incomingLeaveRequests, setIncomingLeaveRequests] = useState<any[]>([]);

  /* Member panel (for leads) */
  const [users, setUsers] = useState<{id: string; displayName?: string; email?: string}[]>([]);
  const [memberPanelOpenId, setMemberPanelOpenId] = useState<string | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<{id: string; targetUserId: string; initiativeId: string}[]>([]);

  /* Lead edit modal */
  const [leadEditInit, setLeadEditInit] = useState<Initiative | null>(null);
  const [leadForm, setLeadForm]         = useState<FormShape>(emptyForm);
  const [leadSaving, setLeadSaving]     = useState(false);

  /* Propose-new-initiative modal — same form, writes a pending request
   * instead of updating an existing initiative directly. */
  const [proposeOpen, setProposeOpen]     = useState(false);
  const [proposeForm, setProposeForm]     = useState<FormShape>(emptyForm);
  const [proposeSaving, setProposeSaving] = useState(false);
  const [myProposals, setMyProposals]     = useState<InitiativeProposal[]>([]);

  const handleFormChange = useCallback((key: keyof FormShape, value: string) => {
    setLeadForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleProposeFormChange = useCallback((key: keyof FormShape, value: string) => {
    setProposeForm(f => ({ ...f, [key]: value }));
  }, []);

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

      setInitiatives(inits);
      setMyRequests(reqs);

      /* Find initiatives where user is a lead */
      const leadIds = inits
        .filter(i => (i.members || []).some((m: any) =>
          (m.userId === user.uid || m === user.uid) &&
          typeof m.role === 'string' && m.role.toLowerCase().includes('lead')
        ))
        .map(i => i.id);

      setLeadInitiativeIds(leadIds);

      if (leadIds.length > 0) {
        /* One `in` query across every led initiative rather than one per
         * initiative — these all run concurrently. */
        const [joinSnap, removalSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'join_requests'),
            where('initiativeId', 'in', leadIds),
            where('status', '==', 'pending'),
          )).catch(() => null),
          getDocs(query(
            collection(db, 'removal_requests'),
            where('requestedByUserId', '==', user.uid),
            where('status', '==', 'pending'),
          )).catch(() => null),
        ]);

        setIncomingRequests(joinSnap
          ? joinSnap.docs.map(d => {
              const data = d.data();
              return { id: d.id, ...data, initiativeTitle: inits.find(i => i.id === data.initiativeId)?.title };
            })
          : []);
        setPendingRemovals(removalSnap ? removalSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)) : []);

        // Only fetch the specific profiles needed to resolve display names
        // — led initiatives' members plus incoming join-request applicants
        // — from the public_profiles mirror (no email field, see
        // firestore.rules) instead of downloading the entire private users
        // collection just for a name label.
        const ledInits = inits.filter(i => leadIds.includes(i.id));
        const memberIds = ledInits.flatMap(i =>
          (i.members || []).map((m: any) => (typeof m === 'string' ? m : m.userId)).filter(Boolean)
        );
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
        setUsers([]);
        setPendingRemovals([]);
      }

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

      /* Fetch incoming leave requests for initiatives where user is a lead */
      if (leadIds.length > 0) {
        const leaveSnap = await getDocs(query(
          collection(db, 'leave_requests'),
          where('initiativeId', 'in', leadIds),
          where('status', '==', 'pending'),
        ));
        setIncomingLeaveRequests(leaveSnap.docs.map(d => {
          const data = d.data();
          const initiative = inits.find(i => i.id === data.initiativeId);
          return { id: d.id, ...data, initiativeTitle: data.initiativeTitle || initiative?.title };
        }));
      } else {
        setIncomingLeaveRequests([]);
      }
    } catch {
      /* Firestore not configured or permission error — show empty state */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Close modal on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeLeadEdit(); };
    if (leadEditInit) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [leadEditInit]);

  /* Prevent body scroll when modal is open */
  useEffect(() => {
    document.body.style.overflow = leadEditInit ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [leadEditInit]);

  const getRequestForInit = (initId: string) =>
    myRequests.find(r => r.initiativeId === initId);

  const isAlreadyMember = (init: Initiative) =>
    (init.members || []).some((m: any) => m.userId === user?.uid || m === user?.uid);

  const getUserLabel = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.displayName || userId;
  };

  const toggleMemberPanel = (id: string) => {
    setMemberPanelOpenId(prev => prev === id ? null : id);
  };

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

  /* Lead actions — accept / reject join requests */
  const handleAcceptRequest = async (reqId: string, initiativeId: string, userId: string) => {
    try {
      const { arrayUnion, updateDoc: ud } = await import('firebase/firestore');
      await ud(doc(db, 'initiatives', initiativeId), {
        members: arrayUnion({ userId, role: 'Member' }),
      });
      await deleteDoc(doc(db, 'join_requests', reqId));
      setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleRejectRequest = async (reqId: string) => {
    try {
      const { updateDoc: ud } = await import('firebase/firestore');
      await ud(doc(db, 'join_requests', reqId), { status: 'rejected' });
      setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error(err);
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

  /* Lead approves leave: remove member from initiative, mark leave request approved */
  const handleApproveLeave = async (req: any) => {
    const init = initiatives.find(i => i.id === req.initiativeId);
    if (!init) return;
    try {
      const memberObj = (init.members as any[] || []).find((m: any) => m.userId === req.userId);
      if (memberObj) {
        const { arrayRemove: ar, updateDoc: ud } = await import('firebase/firestore');
        await ud(doc(db, 'initiatives', req.initiativeId), { members: ar(memberObj) });
      }
      await updateDoc(doc(db, 'leave_requests', req.id), { status: 'approved' });
      setIncomingLeaveRequests(prev => prev.filter(r => r.id !== req.id));
      setInitiatives(prev => prev.map(i =>
        i.id === req.initiativeId
          ? { ...i, members: (i.members as any[] || []).filter((m: any) => m.userId !== req.userId) }
          : i
      ));
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

  /* Removal request handlers (lead requests; curator/impact officer reviews) */
  const handleRequestRemoval = async (init: Initiative, member: any) => {
    if (!user) return;
    const memberName = getUserLabel(member.userId);
    if (!confirm(t('confirmRequestRemoval', { member: memberName, initiative: init.title }))) return;
    const optimisticId = 'tmp_' + Date.now();
    setPendingRemovals(prev => [...prev, { id: optimisticId, targetUserId: member.userId, initiativeId: init.id }]);
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
      setPendingRemovals(prev => prev.map(r => r.id === optimisticId ? { ...r, id: ref.id } : r));
    } catch (err) {
      console.error(err);
      setPendingRemovals(prev => prev.filter(r => r.id !== optimisticId));
      alert(t('saveFailed'));
    }
  };

  const handleCancelRemoval = async (reqId: string) => {
    const removed = pendingRemovals.find(r => r.id === reqId);
    setPendingRemovals(prev => prev.filter(r => r.id !== reqId));
    if (reqId.startsWith('tmp_')) return;
    try {
      await deleteDoc(doc(db, 'removal_requests', reqId));
    } catch (err) {
      console.error(err);
      if (removed) setPendingRemovals(prev => [...prev, removed]);
      alert(t('saveFailed'));
    }
  };

  /* Lead edit modal */
  const openLeadEdit = (init: Initiative) => {
    setLeadEditInit(init);
    setLeadForm({
      title:       init.title,
      description: init.description,
      category:    init.category    || '',
      startDate:   init.startDate   || '',
      endDate:     init.endDate     || '',
      imageUrl:    init.imageUrl    || '',
      images:      (init.images     || []).join('\n'),
      stat:        init.stat        || '',
      problem:     init.problem     || '',
      objective:   init.objective   || '',
      impact:      init.impact      || '',
      impactAreas: (init.impactAreas || []).join(', '),
      color:       init.color        || '',
    });
  };

  const closeLeadEdit = () => { setLeadEditInit(null); setLeadForm(emptyForm); };

  const openPropose  = () => { setProposeForm(emptyForm); setProposeOpen(true); };
  const closePropose = () => { setProposeOpen(false); setProposeForm(emptyForm); };

  const handleProposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !proposeForm.title) return;
    setProposeSaving(true);
    try {
      const docRef = await addDoc(collection(db, 'initiative_requests'), {
        ...formToDoc(proposeForm),
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

  const handleLeadSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEditInit || !leadForm.title) return;
    setLeadSaving(true);
    try {
      await updateDoc(doc(db, 'initiatives', leadEditInit.id), formToDoc(leadForm));
      const updated = formToDoc(leadForm);
      setInitiatives(prev => prev.map(i =>
        i.id === leadEditInit.id
          ? { ...i, ...updated, color: updated.color ?? undefined }
          : i
      ));
      closeLeadEdit();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setLeadSaving(false);
    }
  };

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /></div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeaderRow}>
        <h2 className={styles.pageTitle}>{t('joinInitiativesTitle')}</h2>
        <button className={styles.proposeBtn} onClick={openPropose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('proposeInitiativeBtn')}
        </button>
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

      {/* Propose new initiative modal — same form as the lead-edit modal,
       * but writes a pending request instead of updating an initiative. */}
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
              <LeadFormFields form={proposeForm} onChange={handleProposeFormChange} />
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

      {/* Lead edit modal — full curator-equivalent form */}
      {leadEditInit && (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) closeLeadEdit(); }}
        >
          <form className={styles.modal} onSubmit={handleLeadSave}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('editLeadInitiative')}: {leadEditInit.title}</h3>
              <button type="button" className={styles.modalClose} onClick={closeLeadEdit} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <LeadFormFields form={leadForm} onChange={handleFormChange} />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.modalCancelBtn} onClick={closeLeadEdit}>{t('cancel')}</button>
              <button type="submit" className={styles.modalSubmitBtn} disabled={leadSaving || !leadForm.title}>
                {leadSaving ? t('savingDots') : t('saveChangesBtn')}
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Incoming join requests (for leads) */}
      {incomingRequests.length > 0 && (
        <div className={styles.incomingSection}>
          <h3 className={styles.sectionTitle}>
            {t('incomingRequests')}
            <span className={styles.badge}>{incomingRequests.length}</span>
          </h3>
          <div className={styles.requestList}>
            {incomingRequests.map(req => (
              <div key={req.id} className={styles.incomingRow}>
                <div className={styles.incomingInfo}>
                  <span className={styles.incomingUser}>{req.userName || req.userEmail}</span>
                  <span className={styles.incomingMeta}>{t('wantsToJoin')} <strong>{req.initiativeTitle}</strong></span>
                </div>
                <div className={styles.incomingActions}>
                  <button className={styles.acceptBtn} onClick={() => handleAcceptRequest(req.id, req.initiativeId, req.userId)}>{t('acceptRequest')}</button>
                  <button className={styles.rejectBtn}  onClick={() => handleRejectRequest(req.id)}>{t('rejectRequest')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incoming leave requests (for leads) */}
      {incomingLeaveRequests.length > 0 && (
        <div className={styles.incomingSection} style={{ borderInlineStartColor: 'var(--danger)' }}>
          <h3 className={styles.sectionTitle}>
            {t('incomingLeaveRequests')}
            <span className={styles.badge} style={{ background: 'var(--danger)' }}>{incomingLeaveRequests.length}</span>
          </h3>
          <div className={styles.requestList}>
            {incomingLeaveRequests.map(req => (
              <div key={req.id} className={styles.incomingRow}>
                <div className={styles.incomingInfo}>
                  <span className={styles.incomingUser}>{req.userName || req.userEmail}</span>
                  <span className={styles.incomingMeta}>{t('wantsToLeave')} <strong>{req.initiativeTitle}</strong></span>
                </div>
                <div className={styles.incomingActions}>
                  <button className={styles.acceptBtn} onClick={() => handleApproveLeave(req)}>{t('approveLeave')}</button>
                  <button className={styles.rejectBtn} onClick={() => handleDeclineLeave(req.id)}>{t('declineLeave')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Initiatives grid */}
      <div className={styles.grid}>
        {initiatives.map(init => {
          const req    = getRequestForInit(init.id);
          const member = isAlreadyMember(init);
          const isLead = leadInitiativeIds.includes(init.id);
          const nonLeadMembers = (init.members as any[] || []).filter((m: any) => m.userId !== user?.uid);
          return (
            <div key={init.id} className={styles.card}>
              <div className={styles.cardBody}>
                {init.category && <span className={styles.categoryPill}>{init.category}</span>}
                <h3 className={styles.cardTitle}>{init.title}</h3>
                <p className={styles.cardDesc}>{init.description}</p>
                {init.stat && <p className={styles.cardStat}>{init.stat}</p>}
              </div>
              <div className={styles.cardFooter}>
                {isLead ? (
                  <div className={styles.leadFooter}>
                    <span className={styles.memberBadge}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {t('alreadyMember')}
                    </span>
                    <button
                      className={styles.membersToggleBtn + (memberPanelOpenId === init.id ? ' ' + styles.membersToggleBtnOpen : '')}
                      onClick={() => toggleMemberPanel(init.id)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      {t('viewMembers')} ({nonLeadMembers.length})
                    </button>
                    <button
                      className={styles.downloadLeadBtn}
                      onClick={() => {
                        const memberNames = Object.fromEntries(
                          (init.members as any[] || []).map((m: any) => [m.userId, getUserLabel(m.userId)])
                        );
                        void downloadInitiativeReport(init as any, memberNames);
                      }}
                      title={t('downloadReport')}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      {t('downloadReport')}
                    </button>
                    <button className={styles.editLeadBtn} onClick={() => openLeadEdit(init)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      {t('editLeadInitiative')}
                    </button>
                  </div>
                ) : member ? (
                  <div>
                    {(() => {
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
                    })()}
                  </div>
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

              {/* Collapsible member panel — visible to leads only */}
              {isLead && memberPanelOpenId === init.id && (
                <div className={styles.memberPanel}>
                  <p className={styles.memberPanelTitle}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {t('membersLabel')}
                  </p>
                  {nonLeadMembers.length === 0 ? (
                    <p className={styles.memberPanelEmpty}>{t('noTeamMembers')}</p>
                  ) : (
                    nonLeadMembers.map((m: any, idx: number) => {
                      const removal = pendingRemovals.find(r => r.targetUserId === m.userId && r.initiativeId === init.id);
                      return (
                        <div key={m.userId + idx} className={styles.memberPanelItem}>
                          <div className={styles.memberPanelInfo}>
                            <span className={styles.memberPanelName}>{getUserLabel(m.userId)}</span>
                            <span className={styles.memberPanelRole}>{m.role || 'Member'}</span>
                          </div>
                          {removal ? (
                            <div className={styles.memberPanelActions}>
                              <span className={styles.removalPendingBadge}>{t('removalPending')}</span>
                              <button className={styles.cancelRemovalBtn} onClick={() => handleCancelRemoval(removal.id)}>{t('cancelRemoval')}</button>
                            </div>
                          ) : (
                            <button className={styles.requestRemovalBtn} onClick={() => handleRequestRemoval(init, m)}>
                              {t('requestRemoval')}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
