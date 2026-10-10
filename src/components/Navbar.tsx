'use client';

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

  // Any navigation closes the drawer — including browser back/forward, which
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
      if (isDashboard) { setNavHidden(false); }
      else if (y > lastScrollY.current && y > 72) { setNavHidden(true); setMobileOpen(false); }
      else { setNavHidden(false); }
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

  // Drawer is only reachable at mobile widths — close it if the window grows.
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
            aria-label={t('switchLanguage')}
            hrefLang={nextLocale}
          >
            <span className={locale === 'en' ? styles.langActive : styles.langInactive}>EN</span>
            <span className={styles.langDivider} aria-hidden="true" />
            <span className={locale === 'ar' ? styles.langActive : styles.langInactive}>ع</span>
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
      </nav>

      {/* Backdrop */}
      <div
        className={styles.backdrop + (mobileOpen ? ' ' + styles.backdropOpen : '')}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Mobile drawer — `inert` while closed so its links can't be tabbed
          into or read by screen readers when it's off screen. */}
      <div
        id="mobile-nav-drawer"
        ref={drawerRef}
        className={styles.mobileDrawer + (mobileOpen ? ' ' + styles.mobileDrawerOpen : '')}
        inert={!mobileOpen}
      >
        <ul className={styles.mobileLinks}>
          {NAV_LINKS.map((l, i) => (
            <li key={l.href} style={{ '--i': i } as React.CSSProperties}>
              <Link
                href={l.href}
                onClick={closeMobile}
                className={styles.mobileLink + (isActive(l.href) ? ' ' + styles.mobileLinkActive : '')}
                aria-current={isActive(l.href) ? 'page' : undefined}
              >
                {l.label}
                {isActive(l.href) && <span className={styles.activeDot} />}
              </Link>
            </li>
          ))}
        </ul>

        <div className={styles.mobileDivider} />
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
        </div>
      </div>
    </>
  );
}
