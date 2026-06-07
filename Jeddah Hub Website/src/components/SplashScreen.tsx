'use client';

import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem('jh-visited')) {
        sessionStorage.setItem('jh-visited', '1');
        setVisible(true);
        const timer = setTimeout(() => {
          setDismissing(true);
          setTimeout(() => setVisible(false), 600);
        }, 2200);
        return () => clearTimeout(timer);
      }
    } catch {
      // sessionStorage unavailable — skip splash
    }
  }, []);

  if (!visible) return null;

  return (
    <div className={`${styles.overlay} ${dismissing ? styles.dismissing : ''}`} aria-hidden="true">
      <div className={styles.inner}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkMain}>Jeddah Hub</span>
          <span className={styles.wordmarkSub}>Global Shapers Community</span>
        </div>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
      </div>
    </div>
  );
}
