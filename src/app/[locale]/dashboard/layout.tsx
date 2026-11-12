'use client';

/* Dashboard shell: sign-in guard, the role-based sidebar, the one-time
 * password redirect and the charter banner. */
import { useEffect, useRef, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';
import PageTransition from '@/components/PageTransition';
import DefaultPasswordBanner from '@/components/dashboard/DefaultPasswordBanner';
import CharterSignBanner from '@/components/dashboard/CharterSignBanner';
import { SIGNING_ROLES, useCharterStatus } from '@/lib/charterSignature';
import { MUST_CHANGE_PASSWORD_FLAG } from '@/lib/memberAccounts';
import { PASSWORD_FORM_HREF } from '@/lib/passwordForm';
import ThemeLogo from '@/components/ThemeLogo';
import styles from './DashboardLayout.module.css';
import { roleStyle } from '@/lib/roleColors';
import { RoleLabel } from '@/lib/roleLabel';
import DashIcon, { type DashIconName } from '@/components/dashboard/DashIcon';

/** A menu entry: where it goes, its label (Dashboard messages) and icon. */
interface NavItem { href: string; label: string; icon: DashIconName }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const t        = useTranslations('Dashboard');

  // The Charter reminder sits above every page. Until we know whether it's
  // needed, the page loads invisibly (at most 2.5s), so the banner can't
  // appear later and push everything down.
  const charterStatus = useCharterStatus(user?.uid);
  const [charterWaitOver, setCharterWaitOver] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setCharterWaitOver(true), 2500);
    return () => clearTimeout(id);
  }, []);
  const holdPage = charterStatus.loading && !charterWaitOver
    && SIGNING_ROLES.includes(normalizeRole(user?.role)) && !pathname.startsWith('/dashboard/shaper/charter');

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
      router.replace(PASSWORD_FORM_HREF);
    }
  }, [loading, user, pathname, router]);

  // Initiative leads (Lead or Co-Lead) who aren't curators also get the
  // Roster, scoped there to their own teams.
  const [leadsATeam, setLeadsATeam] = useState(false);
  const uid = user?.uid;
  const curatorRole = ['curator', 'vice_curator'].includes(normalizeRole(user?.role));
  useEffect(() => {
    if (!uid || curatorRole) return;
    let live = true;
    getDocs(query(collection(db, 'initiatives'), where('leads', 'array-contains', uid), limit(1)))
      .then(s => { if (live) setLeadsATeam(!s.empty); })
      .catch(() => {});
    return () => { live = false; };
  }, [uid, curatorRole]);

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

  // Each role's menu, in order. Every list starts with the Overview (what
  // is waiting for them) and their own pages, and ends with the Community Charter, which every member should be
  // able to find; Sign Out follows as the last item.
  const ownPages: NavItem[] = [
    { href: '/dashboard', label: 'overview', icon: 'home' },
    { href: '/dashboard/shaper/profile', label: 'myProfile', icon: 'profile' },
    { href: '/dashboard/shaper/my-projects', label: 'profileActiveProjects', icon: 'folder' },
    ...(!isCurator && leadsATeam ? [{ href: '/dashboard/curator/roster', label: 'roster', icon: 'people' } as NavItem] : []),
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
                    <DashIcon name={item.icon} />
                    {t(item.label)}
                  </Link>
                </li>
              ))}
              {/* Sign Out sits with the rest of the menu, last for every role. */}
              <li>
                <button onClick={handleLogout} className={styles.navLink + ' ' + styles.signOutLink}>
                  <DashIcon name="signOut" />
                  {t('signOut')}
                </button>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      <main className={styles.mainContent} aria-busy={holdPage || undefined}>
        <DefaultPasswordBanner />
        <CharterSignBanner status={charterStatus} />
        <div className={holdPage ? styles.holding : undefined}>
          <PageTransition scope="section">{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
