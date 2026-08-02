'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

/** Shown below this and the splash is just a flash. */
const MIN_VISIBLE_MS = 450;
/** Never hold the user back longer than this, however slow the page is. */
const MAX_VISIBLE_MS = 1600;
const DISMISS_MS     = 420;

export default function SplashScreen({ locale }: { locale: string }) {
  const isRtl = locale === 'ar';
  const [visible,    setVisible]    = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [isDark,     setIsDark]     = useState(false);

  useEffect(() => {
    const html       = document.documentElement;
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
    } catch { /* sessionStorage unavailable — skip the splash entirely */ }

    if (!shouldShow) return;

    setVisible(true);
    const start = performance.now();
    let settled = false;
    let dismissTimer: ReturnType<typeof setTimeout>;
    let holdTimer:    ReturnType<typeof setTimeout>;

    /* Leave as soon as the page is genuinely ready rather than after a fixed
     * wait — but never so fast that the splash just flickers. */
    const finish = () => {
      if (settled) return;
      settled = true;
      const hold = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start));
      holdTimer = setTimeout(() => {
        setDismissing(true);
        dismissTimer = setTimeout(() => setVisible(false), DISMISS_MS);
      }, hold);
    };

    const loaded = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>(res => window.addEventListener('load', () => res(), { once: true }));

    // Waiting on fonts avoids the wordmark reflowing the moment the splash lifts.
    const fonts = document.fonts?.ready ?? Promise.resolve();

    Promise.all([loaded, fonts]).then(finish).catch(finish);
    const cap = setTimeout(finish, MAX_VISIBLE_MS);

    return () => {
      clearTimeout(cap);
      clearTimeout(holdTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  /* Hold the scroll position while the overlay covers the page. */
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [visible]);

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
            alt=""
            className={styles.logo}
            fetchPriority="high"
            decoding="async"
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
