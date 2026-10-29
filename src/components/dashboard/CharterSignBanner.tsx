'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useAuth } from '@/context/AuthContext';
import { SIGNING_ROLES, type CharterStatus } from '@/lib/charterSignature';
import { normalizeRole } from '@/lib/role';
import styles from './DefaultPasswordBanner.module.css';

/** Shown across the dashboard while curators require members to sign the
 *  Community Charter and this member hasn't yet. The layout loads `status`
 *  (useCharterStatus) and holds the page until it's known. */
export default function CharterSignBanner({ status }: { status: CharterStatus }) {
  const t = useTranslations('Dashboard');
  const { user } = useAuth();
  const pathname = usePathname();
  const { loading, required, signature } = status;

  // The charter page has the sign-off form itself; alumni aren't asked.
  if (loading || !required || signature || !SIGNING_ROLES.includes(normalizeRole(user?.role))
      || pathname.startsWith('/dashboard/shaper/charter')) return null;
  return (
    <div className={styles.banner} role="alert">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4" />
      </svg>
      <span className={styles.text}>{t('charterSignBanner')}</span>
      <Link href="/dashboard/shaper/charter#sign" className={styles.link}>{t('charterSignCta')}</Link>
    </div>
  );
}
