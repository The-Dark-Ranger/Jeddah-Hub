'use client';

import { useEffect, useState } from 'react';
import { subscribeToAuthChanges, UserProfile } from '@/lib/auth';
import BlogManager from '@/components/BlogManager';
import { useTranslations } from 'next-intl';

export default function ShaperBlogs() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const t = useTranslations('Dashboard');

  useEffect(() => {
    return subscribeToAuthChanges(setUser);
  }, []);

  if (!user) return <div>{t('loading')}</div>;

  return <BlogManager user={user} />;
}
