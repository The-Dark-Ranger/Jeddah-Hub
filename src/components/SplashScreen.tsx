'use client';

/* The loading screen shown on a visitor's first page in a session and on
 * every full reload (decided before first paint by SPLASH_INIT_SCRIPT).
 * It stays until the page has loaded and its fonts are ready, never less
 * than SPLASH_MIN_VISIBLE_MS (so it doesn't flicker) and never more than
 * SPLASH_MAX_VISIBLE_MS (so a slow network can't trap anyone behind it). */
import { useEffect, useRef, useState } from 'react';
import {
  SPLASH_MIN_VISIBLE_MS as MIN_VISIBLE_MS,
  SPLASH_MAX_VISIBLE_MS as MAX_VISIBLE_MS,
  SPLASH_DISMISS_MS as DISMISS_MS,
} from '@/lib/initScripts';
import styles from './SplashScreen.module.css';

/** How long the bar takes to sweep from wherever it is to 100% once ready. */
const COMPLETE_MS = 260;

export default function SplashScreen({ locale }: { locale: string }) {
  const isRtl = locale === 'ar';
  const [dismissing, setDismissing] = useState(false);
  const fillRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (!html.hasAttribute('data-splash')) return;

    const start = performance.now();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const percent = new Intl.NumberFormat(isRtl ? 'ar' : 'en', { style: 'percent' });
    let settled = false;
    let raf = 0;
    let holdTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;

    // Real progress feel: ease toward 90% while loading, never stall at a
    // fixed point, then sweep to 100% the moment the page is ready.
    let progress = 0.06;
    const paint = () => {
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${progress})`;
      if (percentRef.current) percentRef.current.textContent = percent.format(Math.round(progress * 100) / 100);
    };
    const creep = () => {
      progress += (0.9 - progress) * 0.04;
      paint();
      raf = requestAnimationFrame(creep);
    };
    paint();
    if (!reduceMotion) raf = requestAnimationFrame(creep);

    // Leave as soon as the page is genuinely ready, never so fast it flickers.
    const finish = () => {
      if (settled) return;
      settled = true;
      cancelAnimationFrame(raf);
      // Sweep the bar to 100% and count the number up alongside it.
      if (fillRef.current) {
        fillRef.current.style.transition = `transform ${COMPLETE_MS}ms cubic-bezier(.4,0,.2,1)`;
        fillRef.current.style.transform = 'scaleX(1)';
      }
      const from = progress, t0 = performance.now();
      const count = (now: number) => {
        const k = Math.min(1, (now - t0) / COMPLETE_MS);
        if (percentRef.current) percentRef.current.textContent = percent.format(Math.round((from + (1 - from) * k) * 100) / 100);
        if (k < 1) raf = requestAnimationFrame(count);
      };
      raf = requestAnimationFrame(count);

      const hold = Math.max(COMPLETE_MS + 80, MIN_VISIBLE_MS - (performance.now() - start));
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
  }, [isRtl]);

  // Always server-rendered and hidden by CSS unless html[data-splash] is set,
  // so it is already on screen at first paint when the init script asks for it.
  return (
    <div
      className={`${styles.overlay} ${dismissing ? styles.dismissing : ''}`}
      aria-hidden="true"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Backdrop: drifting light, the Hijazi pattern, a soft vignette. */}
      <div className={styles.aurora} />
      <div className={styles.pattern} />
      <div className={styles.vignette} />

      <div className={styles.inner}>
        <div className={styles.emblem}>
          <span className={styles.halo} />
          <span className={styles.ring} />
          <span className={styles.glass}>
            {/* The splash is always dark navy, so it always uses the
                light-on-dark logo whatever the site theme. */}
            <img src="/logo-dark.png" alt="" className={styles.logo} fetchPriority="high" decoding="async" draggable={false} />
          </span>
        </div>

        <div className={styles.wordmark}>
          <span className={styles.eyebrow}>{isRtl ? 'مجتمع صنّاع العالم' : 'Global Shapers Community'}</span>
          <span className={styles.name}>{isRtl ? 'مركز جدة' : 'Jeddah Hub'}</span>
          <span className={styles.tagline}>{isRtl ? 'من جدة إلى العالم' : 'From Jeddah to the Globe'}</span>
        </div>

        <div className={styles.progress}>
          <div className={styles.track}>
            <div ref={fillRef} className={styles.fill} />
          </div>
          <span ref={percentRef} className={styles.percent} />
        </div>
      </div>

      <div className={styles.footer}>
        <img src="/wef-logo-white.svg" alt="" className={styles.wefLogo} width={39} height={24} decoding="async" draggable={false} />
        <span className={styles.footerRule} />
        <span>{isRtl ? 'مبادرة من المنتدى الاقتصادي العالمي' : 'An initiative of the World Economic Forum'}</span>
      </div>
    </div>
  );
}
