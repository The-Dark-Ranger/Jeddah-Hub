'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import styles from './DashboardHome.module.css';

interface Stats {
  initiatives: number; activeInitiatives: number;
  blogs: number; subscribers: number; reports: number;
  myProjects: number; unreadMessages: number;
}

export default function DashboardHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const [stats, setStats] = useState<Stats>({
    initiatives: 0, activeInitiatives: 0, blogs: 0,
    subscribers: 0, reports: 0, myProjects: 0, unreadMessages: 0,
  });

  useEffect(() => {
    if (!loading && user?.role) fetchStats();
  }, [loading, user]);

  const fetchStats = async () => {
    try {
      const role = user?.role?.toLowerCase();
      const isCurator = role === 'curator' || role === 'vice_curator';
      const [initSnap, blogSnap, subSnap, reportSnap] = await Promise.all([
        getDocs(collection(db, 'initiatives')),
        getDocs(collection(db, 'blogs')),
        getDocs(collection(db, 'newsletter_subscribers')),
        getDocs(collection(db, 'impact_reports')),
      ]);
      let myProjects = 0;
      let activeInitiatives = 0;
      initSnap.docs.forEach(d => {
        const data = d.data();
        if (data.status === 'active') activeInitiatives++;
        if (user && data.members?.some((m: any) => m.userId === user.uid)) myProjects++;
      });

      let unreadMessages = 0;
      if (isCurator) {
        try {
          const unreadSnap = await getDocs(query(collection(db, 'contact_messages'), where('read', '==', false)));
          unreadMessages = unreadSnap.size;
        } catch { /* ignore */ }
      }

      setStats({
        initiatives: initSnap.size, activeInitiatives,
        blogs: blogSnap.size, subscribers: subSnap.size,
        reports: reportSnap.size, myProjects, unreadMessages,
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return null;

  if (!user?.role) {
    return (
      <div className={styles.pending}>
        <div className={styles.pendingIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2>{t('pendingTitle')}</h2>
        <p>{t('pendingBody')}</p>
        <p className={styles.pendingEmail}>{t('signedInAs')} <strong>{user?.email}</strong></p>
      </div>
    );
  }

  const role      = user.role.toLowerCase();
  const isCurator = role === 'curator' || role === 'vice_curator';
  const isImpact  = role === 'impact_officer';
  const isShaper  = role === 'shaper' || role === 'alumni';

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('goodMorning');
    if (h < 18) return t('goodAfternoon');
    return t('goodEvening');
  };

  return (
    <div className={styles.page}>

      {/* Welcome */}
      <div className={styles.welcome}>
        <h1 className={styles.greeting}>
          {greeting()}, {user.displayName || user.email?.split('@')[0] || 'there'}!
        </h1>
        <p className={styles.roleLine}>
          {t('loggedInAs')}{' '}
          <span className="badge badge-blue">{user.role.replace(/_/g, ' ')}</span>
        </p>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {isCurator && (<>
          <StatCard label="Active Initiatives" value={stats.activeInitiatives} accent="#2563eb"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard label="Blog Posts" value={stats.blogs} accent="#7c3aed"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
          <StatCard label="Newsletter Subscribers" value={stats.subscribers} accent="#059669"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>} />
          <StatCard label="Unread Messages" value={stats.unreadMessages} accent={stats.unreadMessages > 0 ? '#d97706' : '#64748b'}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>} />
        </>)}
        {isImpact && (<>
          <StatCard label="Impact Reports" value={stats.reports} accent="#2563eb"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>} />
          <StatCard label="Blog Posts" value={stats.blogs} accent="#7c3aed"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
          <StatCard label="Total Initiatives" value={stats.initiatives} accent="#059669"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
        </>)}
        {isShaper && (<>
          <StatCard label="My Active Projects" value={stats.myProjects} accent="#2563eb"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>} />
          <StatCard label="Total Initiatives" value={stats.initiatives} accent="#7c3aed"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard label="Blog Posts" value={stats.blogs} accent="#059669"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
        </>)}
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className={styles.sectionTitle}>{t('quickActions')}</h3>
        <div className={styles.actionGrid}>
          {isCurator && (<>
            <ActionCard title="Initiatives" desc="Create, edit & archive projects" href="/dashboard/curator/initiatives" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>} />
            <ActionCard title="Roster" desc="Assign members to initiatives" href="/dashboard/curator/roster" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>} />
            <ActionCard title={`Messages${stats.unreadMessages > 0 ? ` (${stats.unreadMessages})` : ''}`}
              desc="View & reply to contact messages" href="/dashboard/curator/messages" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>}
              accent={stats.unreadMessages > 0} />
            <ActionCard title="Write Blog" desc="Publish a new article" href="/dashboard/curator/blogs" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
            <ActionCard title="Role Assignments" desc="Manage member roles" href="/dashboard/curator/members" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/>
              </svg>} />
            <ActionCard title="Export Emails" desc="Download subscriber list" href="/dashboard/curator/exports" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>} />
          </>)}
          {isImpact && (<>
            <ActionCard title="New Report" desc="Create an impact report" href="/dashboard/impact/reports" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>} />
            <ActionCard title="Write Blog" desc="Share your perspective" href="/dashboard/impact/blogs" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
          </>)}
          {isShaper && (<>
            <ActionCard title="Browse Initiatives" desc="Find projects to join" href="/dashboard/shaper/initiatives" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>} />
            <ActionCard title="Post Blog" desc="Share your story" href="/dashboard/shaper/blogs" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
          </>)}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ color: accent, background: accent + '18' }}>{icon}</div>
      <div className={styles.statValue} style={{ color: accent }}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function ActionCard({ title, desc, href, router, icon, accent }: {
  title: string; desc: string; href: string;
  router: ReturnType<typeof useRouter>; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <button
      className={styles.actionCard + (accent ? ' ' + styles.actionCardAccent : '')}
      onClick={() => router.push(href)}
    >
      <div className={styles.actionIcon}>{icon}</div>
      <div className={styles.actionText}>
        <div className={styles.actionTitle}>{title}</div>
        <div className={styles.actionDesc}>{desc}</div>
      </div>
      <svg className={styles.actionArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
