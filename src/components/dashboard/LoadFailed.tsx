'use client';

/* What a list shows when its data couldn't be loaded, instead of its empty
 * state: "nothing here" after a failed load would tell a curator there are
 * no messages or requests when there may be many. */
import { useTranslations } from 'next-intl';
import styles from './LoadFailed.module.css';

export default function LoadFailed({ onRetry, message }: {
  onRetry: () => void;
  /** Replaces the general "couldn't load" sentence. */
  message?: string;
}) {
  const t = useTranslations('Common');
  return (
    <div className={styles.box} role="alert">
      <p className={styles.text}>{message ?? t('loadFailed')}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>{t('retry')}</button>
    </div>
  );
}
