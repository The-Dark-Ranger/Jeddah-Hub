'use client';

import { useEffect, useState } from 'react';
import {
  SPLASH_MIN_VISIBLE_MS as MIN_VISIBLE_MS,
  SPLASH_MAX_VISIBLE_MS as MAX_VISIBLE_MS,
  SPLASH_DISMISS_MS as DISMISS_MS,
} from '@/lib/initScripts';
import styles from './SplashScreen.module.css';

export default function SplashScreen({ locale }: { locale: string }) {
  const isRtl = locale === 'ar';
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.hasAttribute('data-splash')) return;

    const start = performance.now();
    let settled = false;
    let holdTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;

    // Leave as soon as the page is genuinely ready — never so fast it flickers.
    const finish = () => {
      if (settled) return;
      settled = true;
      const hold = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start));
      holdTimer = setTimeout(() => {
        setDismissing(true);
        doneTimer = setTimeout(() => {
          html.removeAttribute('data-splash');
          setDismissing(false);
        }, DISMISS_MS);
      }, hold);
    };

    const loaded = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>(res => window.addEventListener('load', () => res(), { once: true }));
    // Waiting on fonts stops the wordmark/page text reflowing as the splash lifts.
    const fonts = document.fonts?.ready ?? Promise.resolve();

    Promise.all([loaded, fonts]).then(finish, finish);
    const cap = setTimeout(finish, MAX_VISIBLE_MS);

    return () => {
      clearTimeout(cap);
      clearTimeout(holdTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  // Always server-rendered and hidden by CSS unless html[data-splash] is set,
  // so it is already on screen at first paint when the init script asks for it.
  return (
    <div
      className={`${styles.overlay} ${dismissing ? styles.dismissing : ''}`}
      aria-hidden="true"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className={styles.inner}>
        <div className={styles.logoRing}>
          {/* Both variants ship; CSS shows the one matching the active theme
              so the right logo is visible on the very first frame. */}
          <img src="/logo.png" alt="" className={`${styles.logo} ${styles.logoLight}`} fetchPriority="high" decoding="async" />
          <img src="/logo-dark.png" alt="" className={`${styles.logo} ${styles.logoDark}`} decoding="async" />
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
