'use client';

import { useEffect, useRef, useState } from 'react';
import {
  SPLASH_MIN_VISIBLE_MS as MIN_VISIBLE_MS,
  SPLASH_MAX_VISIBLE_MS as MAX_VISIBLE_MS,
  SPLASH_DISMISS_MS as DISMISS_MS,
} from '@/lib/initScripts';
import styles from './SplashScreen.module.css';

/** How long the bar takes to sweep from wherever it is to 100% once ready. */
const COMPLETE_MS = 220;

export default function SplashScreen({ locale }: { locale: string }) {
  const isRtl = locale === 'ar';
  const [dismissing, setDismissing] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.hasAttribute('data-splash')) return;

    const start = performance.now();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let settled = false;
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;

    // Real progress feel: ease toward 90% while loading, never stall at a
    // fixed point, then sweep to 100% the moment the page is ready.
    let progress = 0.08;
    const paint = () => {
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
    };
    const creep = () => {
      progress += (0.9 - progress) * 0.045;
      paint();
      raf = requestAnimationFrame(creep);
    };
    if (!reduceMotion) raf = requestAnimationFrame(creep);

    // Leave as soon as the page is genuinely ready, never so fast it flickers.
    const finish = () => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      progress = 1;
      if (fillRef.current) fillRef.current.style.transition = `transform ${COMPLETE_MS}ms cubic-bezier(.4,0,.2,1)`;
      paint();
      const hold = Math.max(COMPLETE_MS, MIN_VISIBLE_MS - (performance.now() - start));
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
      cancelAnimationFrame(raf);
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
      <div className={styles.grid} />
      <div className={styles.glow} />

      <div className={styles.inner}>
        <div className={styles.logoRing}>
          {/* The Forum's open arc, drawn in around the logo. */}
          <svg className={styles.arc} viewBox="0 0 120 120">
            <circle className={styles.arcTrack} cx="60" cy="60" r="56" />
            <circle className={styles.arcStroke} cx="60" cy="60" r="56" pathLength="100" />
          </svg>
          {/* The splash is always dark navy, so it always uses the
              light-on-dark logo whatever the site theme. */}
          <img src="/logo-dark.png" alt="" className={styles.logo} fetchPriority="high" decoding="async" />
        </div>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkMain}>
            {isRtl ? 'صنّاع جدة' : 'Jeddah Hub'}
          </span>
          <span className={styles.wordmarkSub}>
            {isRtl ? 'مجتمع صنّاع العالم' : 'Global Shapers Community'}
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div ref={fillRef} className={styles.progressFill} />
        </div>
      </div>

      <div className={styles.footer}>
        <img src="/wef-logo-white.svg" alt="" className={styles.wefLogo} width={39} height={24} decoding="async" />
        <span>{isRtl ? 'مبادرة من المنتدى الاقتصادي العالمي' : 'An initiative of the World Economic Forum'}</span>
      </div>
    </div>
  );
}
