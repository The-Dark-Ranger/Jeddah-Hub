'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

export default function ManageInitiatives() {
  const t = useTranslations('Dashboard');
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchInitiatives = async () => {
    const snap = await getDocs(collection(db, 'initiatives'));
    setInitiatives(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchInitiatives(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await addDoc(collection(db, 'initiatives'), {
      title: newTitle, description: newDesc,
      status: 'active', createdAt: new Date().toISOString(),
    });
    setNewTitle(''); setNewDesc('');
    setLoading(false);
    fetchInitiatives();
  };

  const handleArchive = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), { status: 'archived' });
    fetchInitiatives();
  };

  return (
    <div>
      <h2>{t('manageInitiatives')}</h2>
      <form onSubmit={handleAdd} className="glass-panel" style={{ padding: '2rem', marginTop: '1rem', marginBottom: '2rem' }}>
        <h3>{t('createInitiative')}</h3>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder={t('initiativeTitle')} required
          style={{ display:'block', width:'100%', padding:'0.5rem', marginBottom:'1rem' }} />
        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
          placeholder={t('initiativeDesc')} required
          style={{ display:'block', width:'100%', padding:'0.5rem', marginBottom:'1rem' }} />
        <button type="submit" disabled={loading}
          style={{ padding:'0.5rem 1rem', background:'var(--primary-blue)', color:'white', borderRadius:'4px' }}>
          {loading ? t('adding') : t('addInitiative')}
        </button>
      </form>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3>{t('currentInitiatives')}</h3>
        <ul style={{ marginTop: '1rem' }}>
          {initiatives.map(init => (
            <li key={init.id} style={{ padding:'1rem', borderBottom:'1px solid var(--border-color)', display:'flex', justifyContent:'space-between' }}>
              <div>
                <strong>{init.title}</strong>{' '}
                <span style={{ fontSize:'0.8rem', color: init.status === 'active' ? 'green' : 'gray' }}>({init.status})</span>
                <p>{init.description}</p>
              </div>
              {init.status === 'active' && (
                <button onClick={() => handleArchive(init.id)}
                  style={{ background:'red', color:'white', padding:'0.5rem', borderRadius:'4px' }}>
                  {t('archive')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
