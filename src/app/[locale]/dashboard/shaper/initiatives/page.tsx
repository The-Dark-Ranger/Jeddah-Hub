'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeToAuthChanges, UserProfile } from '@/lib/auth';
import { useTranslations } from 'next-intl';

export default function JoinInitiatives() {
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const t = useTranslations('Dashboard');

  useEffect(() => {
    subscribeToAuthChanges(setUser);
    getDocs(collection(db, 'initiatives')).then(snap =>
      setInitiatives(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
  }, []);

  const handleRequestJoin = async (initId: string) => {
    if (!user) return;
    await addDoc(collection(db, 'join_requests'), {
      initiativeId: initId,
      userId:       user.uid,
      userEmail:    user.email,
      status:       'pending',
      requestedAt:  new Date().toISOString(),
    });
    alert(t('requestSubmitted'));
  };

  return (
    <div>
      <h2>{t('joinInitiativesTitle')}</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {initiatives.map(init => (
            <li key={init.id} style={{
              padding: '1rem', border: '1px solid var(--border-color)',
              borderRadius: '8px', display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <strong>{init.title}</strong>
                <p>{init.description}</p>
              </div>
              <button
                onClick={() => handleRequestJoin(init.id)}
                style={{ padding: '0.5rem 1rem', background: 'var(--primary-blue)', color: 'white', borderRadius: '4px', height: 'fit-content' }}
              >
                {t('requestToJoin')}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
