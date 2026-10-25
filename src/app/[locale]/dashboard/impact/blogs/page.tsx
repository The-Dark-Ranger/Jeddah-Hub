'use client';

/* Dashboard > Blogs for impact officers: review and publish posts. */
import { useEffect, useState } from 'react';
import { subscribeToAuthChanges, UserProfile } from '@/lib/auth';
import BlogManager from '@/components/BlogManager';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import { useTranslations } from 'next-intl';

export default function ImpactBlogs() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const t = useTranslations('Dashboard');

  useEffect(() => { return subscribeToAuthChanges(setUser); }, []);

  if (!user) return <DashSkeleton rows={3} label={t('loading')} />;
  return <BlogManager user={user} />;
}
