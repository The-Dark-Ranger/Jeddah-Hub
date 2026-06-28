'use client';

import { useEffect, useState } from 'react';
import { subscribeToAuthChanges, UserProfile } from '@/lib/auth';
import BlogManager from '@/components/BlogManager';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

export default function ShaperBlogs() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInitiativeLead, setIsInitiativeLead] = useState(false);
  const t = useTranslations('Dashboard');

  useEffect(() => {
    return subscribeToAuthChanges(setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, 'initiatives')).then(snap => {
      const lead = snap.docs.some(d => {
        const members: any[] = d.data().members || [];
        return members.some(m =>
          (m.userId === user.uid || m === user.uid) &&
          typeof m.role === 'string' &&
          m.role.toLowerCase().includes('lead')
        );
      });
      setIsInitiativeLead(lead);
    }).catch(() => {});
  }, [user]);

  if (!user) return <div>{t('loading')}</div>;

  return <BlogManager user={user} isInitiativeLead={isInitiativeLead} />;
}
