'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen({ locale }: { locale: string }) {
  const isRtl = locale === 'ar';
  const [visible,    setVisible]    = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [isDark,     setIsDark]     = useState(false);

  useEffect(() => {
    // Detect theme from the html element before showing splash
    const html = document.documentElement;
    const savedTheme = html.getAttribute('data-theme');
    const sysDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(savedTheme === 'dark' || (savedTheme !== 'light' && sysDark));

    let shouldShow = false;
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const isReload     = nav?.type === 'reload';
      const isFirstVisit = !sessionStorage.getItem('jh-visited');
      if (isFirstVisit || isReload) {
        if (isFirstVisit) sessionStorage.setItem('jh-visited', '1');
        shouldShow = true;
      }
    } catch { /* sessionStorage unavailable, skip splash */ }

    if (!shouldShow) return;

    setVisible(true);
    const t = setTimeout(() => {
      setDismissing(true);
      setTimeout(() => setVisible(false), 600);
    }, 2200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const logoSrc = isDark ? '/logo-dark.png' : '/logo.png';

  return (
    <div
      className={`${styles.overlay} ${dismissing ? styles.dismissing : ''}`}
      aria-hidden="true"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className={styles.inner}>
        <div className={styles.logoRing}>
          <img
            src={logoSrc}
            alt="Jeddah Hub"
            className={styles.logo}
            onError={e => { (e.currentTarget as HTMLImageElement).src = '/logo.png'; }}
          />
        </div>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkMain}>
            {isRtl ? 'صُنَّاع جدة' : 'Jeddah Hub'}
          </span>
          <span className={styles.wordmarkSub}>
            {isRtl ? 'مجتمع صُنَّاع العالم' : 'Global Shapers Community'}
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} />
        </div>
      </div>
    </div>
  );
}
