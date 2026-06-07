'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subscribeToAuthChanges, UserProfile } from '@/lib/auth';
import { useTranslations } from 'next-intl';

export default function MyProfile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [myProjectsCount, setMyProjectsCount] = useState(0);
  const t = useTranslations('Dashboard');

  useEffect(() => {
    const unsub = subscribeToAuthChanges((u) => {
      setUser(u);
      if (u) {
        getDocs(collection(db, 'initiatives')).then(snap => {
          let count = 0;
          snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.members && data.members.some((m: any) => m.userId === u.uid)) count++;
          });
          setMyProjectsCount(count);
        });
      }
    });
    return () => unsub();
  }, []);

  if (!user) return <div>{t('loading')}</div>;

  return (
    <div>
      <h2>{t('profileTitle')}</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
        <p><strong>{t('profileEmail')}:</strong> {user.email}</p>
        <p><strong>{t('profileRole')}:</strong>{' '}
          <span style={{ textTransform: 'uppercase', color: 'var(--primary-blue)', fontWeight: 'bold' }}>
            {user.role}
          </span>
        </p>
      </div>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem', textAlign: 'center' }}>
        <h3 style={{ fontSize: '3rem', color: 'var(--primary-blue)', marginBottom: '0.5rem' }}>{myProjectsCount}</h3>
        <p>{t('profileActiveProjects')}</p>
      </div>
    </div>
  );
}
