'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/i18n/routing';
import styles from './Navbar.module.css';

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  const { theme, toggleTheme } = useTheme();
  const { user, logout }       = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navHidden, setNavHidden]   = useState(false);
  // mounted: avoids SSR/hydration mismatch on theme icon
  const [mounted, setMounted]       = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  /* ── Scroll-hide on mobile ── */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 72) {
        setNavHidden(true);
        setMobileOpen(false);
      } else {
        setNavHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => { await logout(); router.push('/'); setMobileOpen(false); };
  const closeMobile  = () => setMobileOpen(false);
  const handleLangSwitch = () => {
    try { sessionStorage.setItem('jh-lang-switch', '1'); } catch { /* ignore */ }
  };

  const NAV_LINKS = [
    { href: '/',                label: t('home') },
    { href: '/about',           label: t('about') },
    { href: '/projects',        label: t('projects') },
    { href: '/news',            label: t('news') },
    { href: '/become-a-shaper', label: t('becomeShaper') },
    { href: '/contact',         label: t('contact') },
  ];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <nav className={styles.navbar + (navHidden ? ' ' + styles.navbarHidden : '')}>
        {/* Logo */}
        <div className={styles.left}>
          <Link href="/" onClick={closeMobile}>
            <img
              src="/logo.png"
              alt="Jeddah Hub"
              className={styles.logo}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </Link>
        </div>

        {/* Desktop links */}
        <ul className={styles.navLinks}>
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                className={styles.link + (isActive(l.href) ? ' ' + styles.linkActive : '')}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right controls — theme + lang + login + hamburger */}
        <div className={styles.actions}>
          {/* suppressHydrationWarning prevents icon flash during locale switch */}
          <button
            onClick={toggleTheme}
            className={styles.iconBtn}
            aria-label="Toggle theme"
            suppressHydrationWarning
          >
            {mounted ? (theme === 'light' ? <MoonIcon /> : <SunIcon />) : <MoonIcon />}
          </button>

          <Link href={pathname} locale={nextLocale} className={styles.langSwitcher} onClick={handleLangSwitch}>
            {locale === 'en' ? 'AR' : 'EN'}
          </Link>

          {user ? (
            <div className={styles.userMenu}>
              <Link href="/dashboard" className={styles.dashboardBtn}>{t('dashboard')}</Link>
              <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Sign out">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            className={styles.hamburger}
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
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

      {/* Mobile drawer */}
      <div className={styles.mobileDrawer + (mobileOpen ? ' ' + styles.mobileDrawerOpen : '')}>

        {/* Nav links */}
        <ul className={styles.mobileLinks}>
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={closeMobile}
                className={styles.mobileLink + (isActive(l.href) ? ' ' + styles.mobileLinkActive : '')}
              >
                {l.label}
                {isActive(l.href) && <span className={styles.activeDot} />}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth actions — only when logged in */}
        {user && (
          <>
            <div className={styles.mobileDivider} />
            <div className={styles.mobileFooter}>
              <Link href="/dashboard" onClick={closeMobile} className={styles.mobilePrimaryBtn}>
                {t('dashboard')}
              </Link>
              <button onClick={handleLogout} className={styles.mobileLogout}>
                {t('logout')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
