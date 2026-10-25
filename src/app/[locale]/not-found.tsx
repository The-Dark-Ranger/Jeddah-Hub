/* 404 page for unknown addresses. */
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './NotFound.module.css';

const SUGGESTIONS = [
  { href: '/projects', key: 'suggestProjects' },
  { href: '/news', key: 'suggestNews' },
  { href: '/become-a-shaper', key: 'suggestJoin' },
  { href: '/contact', key: 'suggestContact' },
] as const;

export default function NotFound() {
  const t = useTranslations('NotFoundPage');
  const tn = useTranslations('Navigation');

  return (
    <main className={styles.page}>
      <div className={styles.arc} aria-hidden="true" />
      <div className={styles.inner}>
        <p className={styles.code} aria-hidden="true">404</p>
        <p className={styles.eyebrow}>{t('eyebrow')}</p>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.body}>{t('body')}</p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primary}>{t('backHome')}</Link>
          <Link href="/contact" className={styles.secondary}>{t('reportLink')}</Link>
        </div>

        <nav className={styles.suggest} aria-label={t('suggestTitle')}>
          <p className={styles.suggestTitle}>{t('suggestTitle')}</p>
          <ul>
            {SUGGESTIONS.map(s => (
              <li key={s.href}>
                <Link href={s.href} className={styles.suggestLink}>
                  <span>{s.key === 'suggestJoin' ? tn('becomeShaper') : t(s.key)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
