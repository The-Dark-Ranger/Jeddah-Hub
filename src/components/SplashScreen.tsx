'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './SplashScreen.module.css';

/** Floor, so the splash reads as a deliberate load rather than a flash. */
const MIN_VISIBLE_MS = 1000;
/** Never hold the user back longer than this, however slow the page is. */
const MAX_VISIBLE_MS = 2000;
const DISMISS_MS     = 420;

export default function SplashScreen({ locale }: { locale: string }) {
  const isRtl = locale === 'ar';
  const [visible,    setVisible]    = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [isDark,     setIsDark]     = useState(false);
  /** Decided once on the first effect run; survives effect re-runs. */
  const shouldShowRef = useRef<boolean | null>(null);

  useEffect(() => {
    const html       = document.documentElement;
    const savedTheme = html.getAttribute('data-theme');
    const sysDark    = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(savedTheme === 'dark' || (savedTheme !== 'light' && sysDark));

    /* Decide once and remember it. Reading sessionStorage again on a second
     * effect run (StrictMode, Fast Refresh, remount) would see the flag this
     * effect just wrote, bail out before scheduling the dismiss timers, and
     * strand the overlay on screen with `visible` already true. */
    if (shouldShowRef.current === null) {
      let decision = false;
      try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const isReload     = nav?.type === 'reload';
        const isFirstVisit = !sessionStorage.getItem('jh-visited');
        if (isFirstVisit || isReload) {
          if (isFirstVisit) sessionStorage.setItem('jh-visited', '1');
          decision = true;
        }
      } catch { /* sessionStorage unavailable — skip the splash entirely */ }
      shouldShowRef.current = decision;
    }

    if (!shouldShowRef.current) return;

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

  /* Deliberately no body scroll lock here. The overlay is fixed and covers the
   * whole viewport, so scrolling behind it is invisible anyway — and a lock
   * that fails to release leaves the entire page unscrollable. Clear any
   * stale lock instead, so a stranded overlay can never trap the page. */
  useEffect(() => {
    if (!visible && document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
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
