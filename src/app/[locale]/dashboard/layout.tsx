'use client';

/* Dashboard shell: sign-in guard, the role-based sidebar, the one-time
 * password redirect and the charter banner. */
import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';
import PageTransition from '@/components/PageTransition';
import DefaultPasswordBanner from '@/components/dashboard/DefaultPasswordBanner';
import CharterSignBanner from '@/components/dashboard/CharterSignBanner';
import { MUST_CHANGE_PASSWORD_FLAG } from '@/lib/memberAccounts';
import ThemeLogo from '@/components/ThemeLogo';
import styles from './DashboardLayout.module.css';
import { roleStyle } from '@/lib/roleColors';
import { RoleLabel } from '@/lib/roleLabel';

/** A menu entry: where it goes, its label (Dashboard messages) and icon. */
interface NavItem { href: string; label: string; icon: keyof typeof NAV_ICONS }

/** The sidebar icons (16px, stroked). */
const NAV_ICONS = {
  profile:  <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  folder:   <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>,
  person:   <><circle cx="12" cy="8" r="4"/><path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/></>,
  people:   <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  pen:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  mail:     <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  book:     <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
  signOut:  <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
};

const NavIcon = ({ name }: { name: keyof typeof NAV_ICONS }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{NAV_ICONS[name]}</svg>
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t        = useTranslations('Dashboard');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Signed in with a one-time password: nothing else in the dashboard until
  // they've chosen their own (My Profile → Change password clears the flag).
  useEffect(() => {
    if (loading || !user) return;
    let mustChange = false;
    try { mustChange = sessionStorage.getItem(MUST_CHANGE_PASSWORD_FLAG) === '1'; } catch { /* storage blocked */ }
    if (mustChange && !pathname.startsWith('/dashboard/shaper/profile')) {
      router.replace('/dashboard/shaper/profile#password');
    }
  }, [loading, user, pathname, router]);

  const handleLogout = async () => { await logout(); router.push('/'); };

  // On phones the nav is a horizontal strip of pills; bring the current page's
  // pill into view so it never sits hidden off the edge after navigating.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    nav.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [pathname, loading]);

  if (loading) {
    return (
      <div className={styles.loadingScreen} role="status" aria-busy="true">
        <div className={styles.loadingMark}>
          <svg className={styles.loadingArc} viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="29" pathLength="100" />
          </svg>
          <ThemeLogo className={styles.loadingLogoImg} priority />
        </div>
        <p className={styles.loadingText}>{t('loadingDashboard')}</p>
      </div>
    );
  }

  if (!user) return null;

  const role      = normalizeRole(user.role);
  const isCurator = role === 'curator' || role === 'vice_curator';
  const isImpact  = role === 'impact_officer';
  const isShaper  = role === 'shaper' || role === 'alumni';

  const active = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  // Each role's menu, in order. Every list starts with the member's own
  // pages and ends with the Community Charter, which every member should be
  // able to find; Sign Out follows as the last item.
  const ownPages: NavItem[] = [
    { href: '/dashboard/shaper/profile', label: 'myProfile', icon: 'profile' },
    { href: '/dashboard/shaper/my-projects', label: 'profileActiveProjects', icon: 'folder' },
  ];
  const charter: NavItem = { href: '/dashboard/shaper/charter', label: 'communityCharter', icon: 'book' };
  const nav: { title: string; items: NavItem[] } =
    isCurator ? { title: 'management', items: [
      ...ownPages,
      { href: '/dashboard/curator/members', label: 'roleAssignments', icon: 'person' },
      { href: '/dashboard/curator/initiatives', label: 'initiatives', icon: 'folder' },
      { href: '/dashboard/curator/roster', label: 'roster', icon: 'people' },
      { href: '/dashboard/curator/blogs', label: 'blogs', icon: 'pen' },
      { href: '/dashboard/curator/messages', label: 'messages', icon: 'mail' },
      { href: '/dashboard/curator/activities', label: 'activitiesTitle', icon: 'calendar' },
      { href: '/dashboard/curator/exports', label: 'exportEmails', icon: 'download' },
      charter,
    ] }
    : isImpact ? { title: 'impact', items: [
      ...ownPages,
      { href: '/dashboard/impact/projects', label: 'myProjects', icon: 'folder' },
      { href: '/dashboard/impact/blogs', label: 'blogs', icon: 'pen' },
      { href: '/dashboard/curator/activities', label: 'activitiesTitle', icon: 'calendar' },
      charter,
    ] }
    : isShaper ? { title: 'myHub', items: [
      ...ownPages,
      { href: '/dashboard/shaper/activities', label: 'myActivitiesTitle', icon: 'calendar' },
      { href: '/dashboard/shaper/initiatives', label: 'joinInitiatives', icon: 'folder' },
      { href: '/dashboard/shaper/blogs', label: 'writeBlog', icon: 'pen' },
      charter,
    ] }
    // No role yet: their own pages and a blog post.
    : { title: 'myHub', items: [
      ...ownPages,
      { href: '/dashboard/shaper/blogs', label: 'writeBlog', icon: 'pen' },
      charter,
    ] };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        {/* User card */}
        <div className={styles.userCard} style={roleStyle(user.role)}>
          {user.photoURL
            ? <img src={user.photoURL} alt="" className={styles.avatarImg} />
            : <div className={styles.avatar}>{(user.displayName || user.email || '?')[0].toUpperCase()}</div>
          }
          <div className={styles.userInfo}>
            <p className={styles.userName}>{user.displayName || t('member')}</p>
            <span className={styles.roleBadge}>{role ? <RoleLabel role={role} /> : t('pending')}</span>
          </div>
        </div>

        <nav className={styles.nav} ref={navRef} aria-label={t('dashboardNav')}>
          <div className={styles.navGroup}>
            <span className={styles.navGroupTitle}>{t(nav.title)}</span>
            <ul className={styles.navList}>
              {nav.items.map(item => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className={styles.navLink + (active(item.href) ? ' ' + styles.navLinkActive : '')}
                    aria-current={active(item.href) ? 'page' : undefined}
                  >
                    <NavIcon name={item.icon} />
                    {t(item.label)}
                  </Link>
                </li>
              ))}
              {/* Sign Out sits with the rest of the menu, last for every role. */}
              <li>
                <button onClick={handleLogout} className={styles.navLink + ' ' + styles.signOutLink}>
                  <NavIcon name="signOut" />
                  {t('signOut')}
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      <main className={styles.mainContent}>
        <DefaultPasswordBanner />
        <CharterSignBanner />
        <PageTransition scope="section">{children}</PageTransition>
      </main>
    </div>
  );
}
