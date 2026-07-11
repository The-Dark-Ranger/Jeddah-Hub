'use client';

import { useState, useEffect } from 'react';
import {
  collection, getDocs, updateDoc, doc, arrayUnion, deleteDoc, query, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import styles from './Roster.module.css';

export default function ManageRoster() {
  const t = useTranslations('Dashboard');
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [users, setUsers]             = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [selectedInit, setSelectedInit] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [tempRole, setTempRole]         = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [initSnap, usersSnap, reqSnap] = await Promise.all([
      getDocs(collection(db, 'initiatives')),
      getDocs(collection(db, 'users')),
      getDocs(query(collection(db, 'join_requests'), where('status', '==', 'pending'))),
    ]);
    const inits: any[] = initSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const usrs         = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const reqs         = reqSnap.docs.map(d => {
      const data = d.data();
      const init = inits.find((i: any) => i.id === data.initiativeId);
      return { id: d.id, ...data, initiativeTitle: init?.title || data.initiativeId };
    });
    setInitiatives(inits);
    setUsers(usrs);
    setJoinRequests(reqs);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddMember = async () => {
    if (!selectedInit || !selectedUser) return;
    setSaving(true);
    await updateDoc(doc(db, 'initiatives', selectedInit), {
      members: arrayUnion({ userId: selectedUser, role: tempRole.trim() || 'Member' }),
    });
    setTempRole('');
    setSaving(false);
    fetchData();
  };

  const handleAcceptJoinRequest = async (req: any) => {
    await updateDoc(doc(db, 'initiatives', req.initiativeId), {
      members: arrayUnion({ userId: req.userId, role: 'Member' }),
    });
    await deleteDoc(doc(db, 'join_requests', req.id));
    setJoinRequests(prev => prev.filter(r => r.id !== req.id));
    setInitiatives(prev => prev.map(i =>
      i.id === req.initiativeId
        ? { ...i, members: [...(i.members || []), { userId: req.userId, role: 'Member' }] }
        : i
    ));
  };

  const handleRejectJoinRequest = async (reqId: string) => {
    await updateDoc(doc(db, 'join_requests', reqId), { status: 'rejected' });
    setJoinRequests(prev => prev.filter(r => r.id !== reqId));
  };

  const handleRemoveMember = async (initiativeId: string, userId: string) => {
    if (!confirm(t('confirmRemoveMember'))) return;
    const init = initiatives.find(i => i.id === initiativeId);
    if (!init) return;
    const updated = (init.members || []).filter((m: any) => m.userId !== userId);
    await updateDoc(doc(db, 'initiatives', initiativeId), { members: updated });
    fetchData();
  };

  const getUserLabel = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.email || u?.displayName || userId;
  };

  const activeInitiatives = initiatives.filter(i => i.status !== 'archived');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('manageRoster')}</h2>
      </div>

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <div className={styles.card} style={{ borderLeft: '3px solid var(--primary-blue)' }}>
          <h3 className={styles.cardTitle}>
            {t('pendingJoinRequests')}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 22, height: 20, padding: '0 6px', borderRadius: 10,
              background: 'var(--primary-blue)', color: 'white',
              fontSize: '0.72rem', fontWeight: 700, marginInlineStart: '0.5rem',
            }}>{joinRequests.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {joinRequests.map(req => (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '1rem', padding: '0.9rem 1rem',
                background: 'var(--background-alt)', borderRadius: 10,
                border: '1px solid var(--border-color)', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {req.userName || req.userEmail}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {t('wantsToJoin')} <strong>{req.initiativeTitle}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className={styles.acceptBtn} onClick={() => handleAcceptJoinRequest(req)}>
                    {t('acceptRequest')}
                  </button>
                  <button className={styles.rejectBtn} onClick={() => handleRejectJoinRequest(req.id)}>
                    {t('rejectRequest')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign form */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('assignMember')}</h3>
        <div className={styles.formRow}>
          <select value={selectedInit} onChange={e => setSelectedInit(e.target.value)} className={styles.select}>
            <option value="">{t('selectInitiative')}</option>
            {activeInitiatives.map(i => (
              <option key={i.id} value={i.id}>{i.title}</option>
            ))}
          </select>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} className={styles.select}>
            <option value="">{t('selectUser')}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.email || u.id}</option>
            ))}
          </select>
          <input
            value={tempRole}
            onChange={e => setTempRole(e.target.value)}
            placeholder={t('tempRolePlaceholder')}
            className={styles.input}
          />
        </div>
        <button
          onClick={handleAddMember}
          className={styles.assignBtn}
          disabled={!selectedInit || !selectedUser || saving}
        >
          {saving ? '…' : t('assignMemberBtn')}
        </button>
      </div>

      {/* Roster list per initiative */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('initiativeMembers')}</h3>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : initiatives.length === 0 ? (
          <div className={styles.empty}>{t('noMembers')}</div>
        ) : (
          <div className={styles.initiativeList}>
            {initiatives.map(init => {
              const members: any[] = init.members || [];
              return (
                <div key={init.id} className={styles.initiativeBlock}>
                  <div className={styles.initiativeHeader}>
                    <span className={styles.initiativeName}>{init.title}</span>
                    <span className={styles.memberCount}>
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </span>
                    <span
                      className={styles.statusPill}
                      style={{ color: init.status === 'active' ? '#059669' : '#94a3b8' }}
                    >
                      {init.status || 'active'}
                    </span>
                  </div>
                  {members.length === 0 ? (
                    <p className={styles.noMembersRow}>{t('noMembers')}</p>
                  ) : (
                    <table className={styles.memberTable}>
                      <thead>
                        <tr>
                          <th>{t('colEmail')}</th>
                          <th>{t('colRole')}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m: any, idx: number) => (
                          <tr key={m.userId + idx}>
                            <td className={styles.memberEmail}>{getUserLabel(m.userId)}</td>
                            <td>
                              <span className={styles.rolePill}>{m.role || 'Member'}</span>
                            </td>
                            <td>
                              <button
                                className={styles.removeBtn}
                                onClick={() => handleRemoveMember(init.id, m.userId)}
                              >
                                {t('removeMember')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
