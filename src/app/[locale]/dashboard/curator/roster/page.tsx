'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

export default function ManageRoster() {
  const t = useTranslations('Dashboard');
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [users, setUsers]             = useState<any[]>([]);
  const [selectedInit, setSelectedInit] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [tempRole, setTempRole]         = useState('');

  const fetchData = async () => {
    const [initSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'initiatives')),
      getDocs(collection(db, 'users')),
    ]);
    setInitiatives(initSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddMember = async () => {
    if (!selectedInit || !selectedUser) return;
    await updateDoc(doc(db, 'initiatives', selectedInit), {
      members: arrayUnion({ userId: selectedUser, role: tempRole || 'Member' }),
    });
    setTempRole('');
    fetchData();
  };

  return (
    <div>
      <h2>{t('manageRoster')}</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
        <h3>{t('assignMember')}</h3>
        <div style={{ display:'flex', gap:'1rem', marginTop:'1rem', marginBottom:'1rem', flexWrap:'wrap' }}>
          <select value={selectedInit} onChange={e => setSelectedInit(e.target.value)} style={{ padding:'0.5rem', flex:1 }}>
            <option value="">{t('selectInitiative')}</option>
            {initiatives.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
          </select>
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)} style={{ padding:'0.5rem', flex:1 }}>
            <option value="">{t('selectUser')}</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.email || u.id}</option>)}
          </select>
          <input value={tempRole} onChange={e => setTempRole(e.target.value)}
            placeholder={t('tempRolePlaceholder')} style={{ padding:'0.5rem', flex:1 }} />
        </div>
        <button onClick={handleAddMember}
          style={{ padding:'0.5rem 1rem', background:'var(--primary-blue)', color:'white', borderRadius:'4px' }}>
          {t('assignMemberBtn')}
        </button>
      </div>
    </div>
  );
}
