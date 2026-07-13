'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen() {
  const [visible, setVisible]     = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    let shouldShow = false;
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const isReload    = nav?.type === 'reload';
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
      setTimeout(() => setVisible(false), 550);
    }, 1800);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${dismissing ? styles.dismissing : ''}`} aria-hidden="true">
      <div className={styles.inner}>
        <img
          src="/logo.png"
          alt="Jeddah Hub"
          className={styles.logo}
          onError={e => { (e.currentTarget as HTMLImageElement).src = '/logo.svg'; }}
        />
        <div className={styles.wordmark}>
          <span className={styles.wordmarkMain}>Jeddah Hub</span>
          <span className={styles.wordmarkSub}>Global Shapers Community</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} />
        </div>
      </div>
    </div>
  );
}
