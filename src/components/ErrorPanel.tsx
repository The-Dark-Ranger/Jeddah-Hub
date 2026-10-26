'use client';

/* What a member or visitor sees when part of a page fails to load on their
 * device, instead of a blank "Application error" screen. Used by the
 * error.tsx boundaries: the rest of the page (navbar, dashboard sidebar)
 * keeps working, and "Try again" re-renders just the part that failed. */
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import styles from './ErrorPanel.module.css';

export default function ErrorPanel({ error, reset, compact }: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Smaller panel, for inside the dashboard. */
  compact?: boolean;
}) {
  const t = useTranslations('ErrorPage');

  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className={styles.panel + (compact ? ' ' + styles.compact : '')} role="alert">
      <span className={styles.icon} aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
        </svg>
      </span>
      <h2 className={styles.title}>{t('title')}</h2>
      <p className={styles.body}>{t('body')}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={reset}>{t('retry')}</button>
        <button type="button" className={styles.secondary} onClick={() => window.location.reload()}>{t('reload')}</button>
      </div>
      {error.digest && <p className={styles.code}>{t('code', { code: error.digest })}</p>}
    </div>
  );
}
