'use client';

/* The Blogs page body shared by every role's Blogs page (curator, impact
 * officer, shaper). The signed-in member comes from AuthContext, which the
 * dashboard layout has already loaded, rather than each page checking the
 * session and reading the profile again; a name or photo just saved in My
 * Profile is then already here too. BlogManager decides what each role
 * may do. */
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import BlogManager from '@/components/BlogManager';
import DashSkeleton from '@/components/dashboard/DashSkeleton';

export default function BlogPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  if (!user) return <DashSkeleton rows={3} label={t('loading')} />;
  return <BlogManager user={user} />;
}
