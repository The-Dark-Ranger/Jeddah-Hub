'use client';

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t        = useTranslations('Dashboard');

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const handleLogout = async () => { await logout(); router.push('/'); };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (!user) return null;

  const role      = user.role?.toLowerCase();
  const isCurator = role === 'curator' || role === 'vice_curator';
  const isImpact  = role === 'impact_officer';
  const isShaper  = role === 'shaper' || role === 'alumni';

  const active = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        {/* User card */}
        <div className={styles.userCard}>
          {user.photoURL
            ? <img src={user.photoURL} alt="" className={styles.avatarImg} />
            : <div className={styles.avatar}>{(user.displayName || user.email || '?')[0].toUpperCase()}</div>
          }
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user.displayName || t('member')}</p>
            <span className="badge badge-blue">{user.role?.replace(/_/g, ' ') || t('pending')}</span>
          </div>
        </div>

        <nav className={styles.nav}>

          {/* Curator / Vice Curator */}
          {isCurator && (
            <div className={styles.navGroup}>
              <span className={styles.navGroupTitle}>{t('management')}</span>
              <ul>
                <li><Link href="/dashboard/curator/members" className={styles.navLink + (active('/dashboard/curator/members') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="8" r="4"/><path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/>
                  </svg>
                  {t('roleAssignments')}
                </Link></li>
                <li><Link href="/dashboard/curator/initiatives" className={styles.navLink + (active('/dashboard/curator/initiatives') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {t('initiatives')}
                </Link></li>
                <li><Link href="/dashboard/curator/roster" className={styles.navLink + (active('/dashboard/curator/roster') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  {t('roster')}
                </Link></li>
                <li><Link href="/dashboard/curator/blogs" className={styles.navLink + (active('/dashboard/curator/blogs') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('blogs')}
                </Link></li>
                <li><Link href="/dashboard/curator/messages" className={styles.navLink + (active('/dashboard/curator/messages') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  {t('messages')}
                </Link></li>
                <li><Link href="/dashboard/curator/exports" className={styles.navLink + (active('/dashboard/curator/exports') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {t('exportEmails')}
                </Link></li>
                <li><Link href="/dashboard/shaper/profile" className={styles.navLink + (active('/dashboard/shaper/profile') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t('myProfile')}
                </Link></li>
              </ul>
            </div>
          )}

          {/* Impact Officer */}
          {isImpact && (
            <div className={styles.navGroup}>
              <span className={styles.navGroupTitle}>{t('impact')}</span>
              <ul>
                <li><Link href="/dashboard/curator/initiatives" className={styles.navLink + (active('/dashboard/curator/initiatives') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {t('initiatives')}
                </Link></li>
                <li><Link href="/dashboard/curator/roster" className={styles.navLink + (active('/dashboard/curator/roster') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  {t('roster')}
                </Link></li>
                <li><Link href="/dashboard/impact/reports" className={styles.navLink + (active('/dashboard/impact/reports') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                  {t('impactReports')}
                </Link></li>
                <li><Link href="/dashboard/shaper/profile" className={styles.navLink + (active('/dashboard/shaper/profile') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t('myProfile')}
                </Link></li>
              </ul>
            </div>
          )}

          {/* Shaper / Alumni */}
          {isShaper && (
            <div className={styles.navGroup}>
              <span className={styles.navGroupTitle}>{t('myHub')}</span>
              <ul>
                <li><Link href="/dashboard/shaper/profile" className={styles.navLink + (active('/dashboard/shaper/profile') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                  {t('myProfile')}
                </Link></li>
                <li><Link href="/dashboard/shaper/initiatives" className={styles.navLink + (active('/dashboard/shaper/initiatives') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {t('joinInitiatives')}
                </Link></li>
                <li><Link href="/dashboard/shaper/blogs" className={styles.navLink + (active('/dashboard/shaper/blogs') ? ' ' + styles.navLinkActive : '')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('writeBlog')}
                </Link></li>
              </ul>
            </div>
          )}
        </nav>

        <button onClick={handleLogout} className={styles.logoutSidebarBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {t('signOut')}
        </button>
      </aside>

      <main className={styles.mainContent}>{children}</main>
    </div>
  );
}
