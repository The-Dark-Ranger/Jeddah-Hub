'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, addDoc, query, where, deleteDoc, doc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import styles from './JoinInitiatives.module.css';

interface Initiative { id: string; title: string; description: string; status: string; category?: string; stat?: string; members?: any[]; }
interface JoinRequest { id: string; initiativeId: string; status: 'pending' | 'accepted' | 'rejected'; }

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

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [initSnap, reqSnap] = await Promise.all([
      getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'))),
      getDocs(query(collection(db, 'join_requests'), where('userId', '==', user.uid))),
    ]);

    const inits = initSnap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative));
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

    /* Fetch incoming pending requests for those initiatives */
    if (leadIds.length > 0) {
      const incoming: any[] = [];
      for (const initId of leadIds) {
        const s = await getDocs(query(
          collection(db, 'join_requests'),
          where('initiativeId', '==', initId),
          where('status', '==', 'pending'),
        ));
        s.docs.forEach(d => {
          const data = d.data();
          const initiative = inits.find(i => i.id === initId);
          incoming.push({ id: d.id, ...data, initiativeTitle: initiative?.title });
        });
      }
      setIncomingRequests(incoming);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getRequestForInit = (initId: string) =>
    myRequests.find(r => r.initiativeId === initId);

  const isAlreadyMember = (init: Initiative) =>
    (init.members || []).some((m: any) => m.userId === user?.uid || m === user?.uid);

  const handleRequest = async (initId: string) => {
    if (!user) return;
    const optimistic: JoinRequest = {
      id: 'tmp_' + Date.now(), initiativeId: initId, status: 'pending',
    };
    setMyRequests(prev => [...prev, optimistic]);
    const ref = await addDoc(collection(db, 'join_requests'), {
      initiativeId: initId,
      userId:      user.uid,
      userEmail:   user.email,
      userName:    user.displayName || user.email,
      status:      'pending',
      requestedAt: new Date().toISOString(),
    });
    setMyRequests(prev => prev.map(r => r.id === optimistic.id ? { ...r, id: ref.id } : r));
  };

  const handleCancelRequest = async (reqId: string) => {
    setMyRequests(prev => prev.filter(r => r.id !== reqId));
    await deleteDoc(doc(db, 'join_requests', reqId));
  };

  /* Lead actions */
  const handleAcceptRequest = async (reqId: string, initiativeId: string, userId: string) => {
    const { arrayUnion, updateDoc: ud } = await import('firebase/firestore');
    await ud(doc(db, 'initiatives', initiativeId), {
      members: arrayUnion({ userId, role: 'Member' }),
    });
    await deleteDoc(doc(db, 'join_requests', reqId));
    setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
  };

  const handleRejectRequest = async (reqId: string) => {
    const { updateDoc: ud } = await import('firebase/firestore');
    await ud(doc(db, 'join_requests', reqId), { status: 'rejected' });
    setIncomingRequests(prev => prev.filter(r => r.id !== reqId));
  };

  if (loading) return (
    <div className={styles.loading}><div className={styles.spinner} /></div>
  );

  return (
    <div className={styles.page}>
      <div>
        <h2 className={styles.pageTitle}>{t('joinInitiativesTitle')}</h2>
      </div>

      {/* Incoming requests for leads */}
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

      {/* Initiatives list */}
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
                  <span className={styles.memberBadge}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {t('alreadyMember')}
                  </span>
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
                ) : req?.status === 'rejected' ? (
                  <span className={styles.rejectedBadge}>{t('joinRequestRejected')}</span>
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
