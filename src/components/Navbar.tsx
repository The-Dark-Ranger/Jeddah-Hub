'use client';

/* Site navigation: links, theme and language switches, sign-in, and the
 * mobile drawer. */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import ThemeLogo from './ThemeLogo';
import styles from './Navbar.module.css';

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

/* Line icons (24×24, stroked) for the mobile drawer's links. */
const LINK_ICONS: Record<string, string> = {
  '/': 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  '/about': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  '/projects': 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  '/news': 'M4 4h13a1 1 0 0 1 1 1v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM18 8h2a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4',
  '/become-a-shaper': 'M12 3l2.5 5.5L20 9.5l-4 4 1 5.5-5-2.8L7 19l1-5.5-4-4 5.5-1z',
  '/contact': 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6',
};

const SOCIALS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/global-shapers-jeddah-hub',
    icon: 'M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z' },
  { label: 'X / Twitter', href: 'https://x.com/JeddahHub',
    icon: 'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24H16.17l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25H8.08l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z' },
  { label: 'Instagram', href: 'https://www.instagram.com/jeddahhub',
    icon: 'M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z' },
];

export default function Navbar() {
  const t          = useTranslations('Navigation');
  const locale     = useLocale();
  const nextLocale = locale === 'en' ? 'ar' : 'en';
  const pathname   = usePathname();
  const { toggleTheme } = useTheme();
  const { user, logout }       = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navHidden, setNavHidden]   = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const lastScrollY  = useRef(0);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef    = useRef<HTMLDivElement>(null);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Any navigation closes the drawer, including browser back/forward, which
  // the per-link onClick handlers never see.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing UI to an external (URL) change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  /* ── Scroll-hide on mobile, elevation once scrolled ──
   * Hide-on-scroll is skipped on dashboard routes: the dashboard's own
   * sub-nav is pinned directly below the navbar at a fixed offset matching
   * its height (DashboardLayout.module.css), so a navbar that hides
   * mid-scroll would leave a gap of page content where it used to be. */
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (isDashboard || y <= 72) {
        setNavHidden(false);
        lastScrollY.current = y;
        return;
      }
      // iOS rubber-band overscroll reports positions past either end,
      // reacting to those made the bar flicker at the top and bottom.
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (y > max) return;
      // Hysteresis: only a deliberate move flips the bar, so momentum
      // wobble and tiny finger corrections don't toggle it back and forth.
      const delta = y - lastScrollY.current;
      if (Math.abs(delta) < 12) return;
      setNavHidden(delta > 0);
      lastScrollY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isDashboard]);

  /* ── Drawer behaviour: Escape closes it, focus moves in and back out,
   * and the page underneath can't scroll while it covers the screen. */
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  // Drawer is only reachable at mobile widths, close it if the window grows.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = () => { if (mq.matches) setMobileOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const handleLogout = async () => { await logout(); router.push('/'); setMobileOpen(false); };

  const handleLangSwitch = () => {
    try {
      // Hard loads clear this via LangSwitchHandler; client-side switches
      // keep the root layout mounted, so clear it here once the crossfade
      // has had time to run.
      sessionStorage.setItem('jh-lang-switch', '1');
      const html = document.documentElement;
      html.setAttribute('data-lang-switch', '');
      setTimeout(() => {
        html.removeAttribute('data-lang-switch');
        try { sessionStorage.removeItem('jh-lang-switch'); } catch { /* ignore */ }
      }, 900);
    } catch { /* ignore */ }
    setMobileOpen(false);
  };

  const NAV_LINKS = [
    { href: '/',                label: t('home') },
    { href: '/about',           label: t('about') },
    { href: '/projects',        label: t('projects') },
    { href: '/news',            label: t('news') },
    { href: '/become-a-shaper', label: t('becomeShaper') },
    { href: '/contact',         label: t('contact') },
  ];

  const displayName = (locale === 'ar' && user?.displayNameAr) || user?.displayName || user?.email || '';

  // Segment-exact, so e.g. /projects doesn't light up for /projects-archive.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const navClass = [
    styles.navbar,
    navHidden ? styles.navbarHidden : '',
    scrolled ? styles.navbarScrolled : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>{t('skipToContent')}</a>
      <nav
        className={navClass}
        aria-label={t('mainNav')}
        // Anchors the bar while page content transitions underneath it
        // (see ::view-transition-*(site-header) in globals.css).
        style={{ viewTransitionName: 'site-header' }}
      >
        <div className={styles.left}>
          <Link href="/" onClick={closeMobile} aria-label="Jeddah Hub">
            <ThemeLogo className={styles.logo} priority />
          </Link>
        </div>

        {/* Desktop links */}
        <ul className={styles.navLinks}>
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={styles.link + (isActive(l.href) ? ' ' + styles.linkActive : '')}
                aria-current={isActive(l.href) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right controls: theme + lang + login + hamburger */}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={e => toggleTheme(e)}
            className={styles.iconBtn}
            aria-label={t('toggleTheme')}
            title={t('toggleTheme')}
          >
            {/* Icon shows the theme you'd switch TO; picked by CSS so it's
                right before hydration too. */}
            <span className="theme-light-only"><span className={styles.themeIcon}><MoonIcon /></span></span>
            <span className="theme-dark-only"><span className={styles.themeIcon}><SunIcon /></span></span>
          </button>

          <Link
            href={pathname}
            locale={nextLocale}
            className={styles.langPill}
            onClick={handleLangSwitch}
            hrefLang={nextLocale}
          >
            <span className={locale === 'en' ? styles.langActive : styles.langInactive}>EN</span>
            <span className={styles.langDivider} aria-hidden="true" />
            <span className={locale === 'ar' ? styles.langActive : styles.langInactive}>ع</span>
            <span className="sr-only">{t('switchLanguage')}</span>
          </Link>

          {user ? (
            <div className={styles.userMenu}>
              <Link href="/dashboard" className={styles.dashboardBtn}>{t('dashboard')}</Link>
              <button type="button" onClick={handleLogout} className={styles.logoutBtn} aria-label={t('logout')} title={t('logout')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          ) : (
            <Link href="/login" className={styles.loginBtn}>{t('login')}</Link>
          )}

          {/* Hamburger */}
          <button
            type="button"
            ref={hamburgerRef}
            className={styles.hamburger}
            onClick={() => setMobileOpen(v => !v)}
            aria-label={t('toggleMenu')}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
          >
            <span className={styles.bar + (mobileOpen ? ' ' + styles.barOpen1 : '')} />
            <span className={styles.bar + (mobileOpen ? ' ' + styles.barOpen2 : '')} />
            <span className={styles.bar + (mobileOpen ? ' ' + styles.barOpen3 : '')} />
          </button>
        </div>

        {/* Reading progress, driven purely by CSS scroll timelines. */}
        <span className={styles.progress} aria-hidden="true" />
      </nav>

      {/* Backdrop */}
      <div
        className={styles.backdrop + (mobileOpen ? ' ' + styles.backdropOpen : '')}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile drawer, `inert` while closed so its links can't be tabbed
          into or read by screen readers when it's off screen. */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        className={styles.mobileDrawer + (mobileOpen ? ' ' + styles.mobileDrawerOpen : '')}
        inert={!mobileOpen}
      >
        {user && (
          <div className={styles.mobileUser}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" className={styles.mobileAvatar} />
              : <span className={styles.mobileAvatar} aria-hidden="true">{(displayName || '?').charAt(0).toUpperCase()}</span>}
            <div className={styles.mobileUserText}>
              <span className={styles.mobileUserLabel}>{t('signedInAs')}</span>
              <span className={styles.mobileUserName}>{displayName}</span>
            </div>
          </div>
        )}
        <ul className={styles.mobileLinks}>
          {NAV_LINKS.map((l, i) => (
            <li key={l.href} style={{ '--i': i } as React.CSSProperties}>
              <Link
                href={l.href}
                onClick={closeMobile}
                className={styles.mobileLink + (isActive(l.href) ? ' ' + styles.mobileLinkActive : '')}
                aria-current={isActive(l.href) ? 'page' : undefined}
              >
                <span className={styles.mobileLinkIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={LINK_ICONS[l.href]} />
                  </svg>
                </span>
                <span className={styles.mobileLinkLabel}>{l.label}</span>
                <svg className={styles.mobileChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.mobileFooter}>
          {user ? (
            <>
              <Link href="/dashboard" onClick={closeMobile} className={styles.mobilePrimaryBtn}>
                {t('dashboard')}
              </Link>
              <button type="button" onClick={handleLogout} className={styles.mobileLogout}>
                {t('logout')}
              </button>
            </>
          ) : (
            <Link href="/login" onClick={closeMobile} className={styles.mobilePrimaryBtn}>
              {t('login')}
            </Link>
          )}
          <div className={styles.mobileSocials}>
            {SOCIALS.map(sl => (
              <a key={sl.label} href={sl.href} target="_blank" rel="noopener noreferrer" aria-label={sl.label} className={styles.mobileSocial}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={sl.icon} /></svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
