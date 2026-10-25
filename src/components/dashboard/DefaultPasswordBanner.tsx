'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { MUST_CHANGE_PASSWORD_FLAG } from '@/lib/memberAccounts';
import styles from './DefaultPasswordBanner.module.css';

/** Shown across the dashboard while the member is still signed in with the
 *  temporary password a curator's account creation gave them. */
export default function DefaultPasswordBanner() {
  const t = useTranslations('Dashboard');
  const [show, setShow] = useState(false);

  useEffect(() => {
    const read = () => {
      try { setShow(sessionStorage.getItem(MUST_CHANGE_PASSWORD_FLAG) === '1'); } catch { setShow(false); }
    };
    read();
    window.addEventListener('jh-password-changed', read);
    return () => window.removeEventListener('jh-password-changed', read);
  }, []);

  if (!show) return null;
  return (
    <div className={styles.banner} role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span className={styles.text}>{t('defaultPwBanner')}</span>
      <Link href="/dashboard/shaper/profile#password" className={styles.link}>{t('pwTitle')}</Link>
    </div>
  );
}
