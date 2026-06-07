'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import styles from './Roster.module.css';

export default function ManageRoster() {
  const t = useTranslations('Dashboard');
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [users, setUsers]             = useState<any[]>([]);
  const [selectedInit, setSelectedInit] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [tempRole, setTempRole]         = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [initSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'initiatives')),
      getDocs(collection(db, 'users')),
    ]);
    setInitiatives(initSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
