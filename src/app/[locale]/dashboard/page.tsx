'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, Link } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import styles from './DashboardHome.module.css';

export default function DashboardHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const [stats, setStats] = useState({ initiatives: 0, blogs: 0, subscribers: 0, reports: 0, myProjects: 0 });

  useEffect(() => {
    if (!loading && user?.role) fetchStats();
  }, [loading, user]);

  const fetchStats = async () => {
    try {
      const [initSnap, blogSnap, subSnap, reportSnap] = await Promise.all([
        getDocs(collection(db, 'initiatives')),
        getDocs(collection(db, 'blogs')),
        getDocs(collection(db, 'newsletter_subscribers')),
        getDocs(collection(db, 'impact_reports')),
      ]);
      let myProjects = 0;
      if (user) {
        initSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.members?.some((m: any) => m.userId === user.uid)) myProjects++;
        });
      }
      setStats({ initiatives: initSnap.size, blogs: blogSnap.size, subscribers: subSnap.size, reports: reportSnap.size, myProjects });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return null;

  if (!user?.role) {
    return (
      <div className={styles.pending}>
        <div className={styles.pendingIcon}>⏳</div>
        <h2>{t('pendingTitle')}</h2>
        <p>{t('pendingBody')}</p>
        <p className={styles.pendingEmail}>{t('signedInAs')} <strong>{user?.email}</strong></p>
      </div>
    );
  }

  const isCurator = user.role === 'curator' || user.role === 'vice_curator';
  const isImpact  = user.role === 'impact_officer';
  const isShaper  = user.role === 'shaper' || user.role === 'alumni';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
  };

  return (
    <div className={styles.page}>
      <div className={styles.welcome}>
        <h1 className={styles.greeting}>
          {greeting()}{t('there') ? ', ' + (user.displayName || t('there')) : (user.displayName ? ', ' + user.displayName : '')}!
        </h1>
        <p className={styles.roleLine}>
          {t('loggedInAs')} <span className="badge badge-blue">{user.role?.replace('_', ' ')}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {isCurator && (
          <>
            <StatCard label={t('statActiveInitiatives')} value={stats.initiatives} icon="📁" />
            <StatCard label={t('statBlogPosts')}         value={stats.blogs}        icon="✏️" />
            <StatCard label={t('statSubscribers')}       value={stats.subscribers}  icon="📧" />
            <StatCard label={t('statImpactReports')}     value={stats.reports}      icon="📊" />
          </>
        )}
        {isImpact && (
          <>
            <StatCard label={t('statImpactReports')}     value={stats.reports}      icon="📊" />
            <StatCard label={t('statBlogPosts')}         value={stats.blogs}        icon="✏️" />
            <StatCard label={t('statTotalInitiatives')}  value={stats.initiatives}  icon="📁" />
          </>
        )}
        {isShaper && (
          <>
            <StatCard label={t('statMyProjects')}        value={stats.myProjects}   icon="🚀" />
            <StatCard label={t('statTotalInitiatives')}  value={stats.initiatives}  icon="📁" />
            <StatCard label={t('statBlogPosts')}         value={stats.blogs}        icon="✏️" />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className={styles.sectionTitle}>{t('quickActions')}</h3>
        <div className={styles.actionGrid}>
          {isCurator && (
            <>
              <ActionCard title={t('actionNewInitiative')}   desc={t('actionNewInitiativeDesc')}   href="/dashboard/curator/initiatives" router={router} />
              <ActionCard title={t('actionManageRoster')}    desc={t('actionManageRosterDesc')}    href="/dashboard/curator/roster"      router={router} />
              <ActionCard title={t('actionWriteBlog')}       desc={t('actionWriteBlogDesc')}       href="/dashboard/curator/blogs"       router={router} />
              <ActionCard title={t('actionExportEmails')}    desc={t('actionExportEmailsDesc')}    href="/dashboard/curator/exports"     router={router} />
            </>
          )}
          {isImpact && (
            <>
              <ActionCard title={t('actionNewReport')}  desc={t('actionNewReportDesc')}  href="/dashboard/impact/reports" router={router} />
              <ActionCard title={t('actionWriteBlog')}  desc={t('actionWriteBlogDesc')}  href="/dashboard/impact/blogs"   router={router} />
            </>
          )}
          {isShaper && (
            <>
              <ActionCard title={t('actionBrowseInitiatives')} desc={t('actionBrowseInitiativesDesc')} href="/dashboard/shaper/initiatives" router={router} />
              <ActionCard title={t('actionPostBlog')}          desc={t('actionPostBlogDesc')}          href="/dashboard/shaper/blogs"       router={router} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function ActionCard({ title, desc, href, router }: { title: string; desc: string; href: string; router: ReturnType<typeof useRouter> }) {
  return (
    <button className={styles.actionCard} onClick={() => router.push(href)}>
      <div className={styles.actionTitle}>{title}</div>
      <div className={styles.actionDesc}>{desc}</div>
      <svg className={styles.actionArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
