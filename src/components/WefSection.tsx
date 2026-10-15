import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import WefLogo from './WefLogo';
import styles from './WefSection.module.css';

const FOCUS_AREAS = [
  { key: 'climate', icon: 'M12 2a10 10 0 1 0 10 10M12 2c3 3.5 3 16.5 0 20M12 2c-3 3.5-3 16.5 0 20M2 12h20' },
  { key: 'education', icon: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5' },
  { key: 'economy', icon: 'M3 3v18h18M7 15l4-4 3 3 5-6' },
  { key: 'health', icon: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z' },
  { key: 'technology', icon: 'M4 4h16v12H4zM8 20h8M12 16v4' },
  { key: 'civic', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
] as const;

/** Homepage band in the World Economic Forum's visual language — a hairline
 *  grid, oversized figures, topic tiles and the Forum's arc motif —
 *  placing the hub inside the Global Shapers / WEF network. */
export default function WefSection() {
  const t = useTranslations('Wef');

  return (
    <section className={styles.section} aria-labelledby="wef-title">
      <div className={styles.arc} aria-hidden="true" />
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t('eyebrow')}</p>
            <h2 id="wef-title" className={styles.title}>{t('title')}</h2>
            <p className={styles.body}>{t('body')}</p>
            <div className={styles.links}>
              <a href="https://www.weforum.org" target="_blank" rel="noopener noreferrer" className={styles.primaryLink}>
                {t('visitWef')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
              <a href="https://www.globalshapers.org" target="_blank" rel="noopener noreferrer" className={styles.textLink}>
                {t('visitGsc')}
              </a>
            </div>
          </div>

          <div className={styles.logoCard + ' reveal'}>
            <WefLogo alt={t('logoAlt')} height={72} className={styles.logo} />
            <p className={styles.logoCaption}>{t('initiativeOf')}</p>
          </div>
        </div>

        <dl className={styles.stats}>
          {(['hubs', 'countries', 'shapers'] as const).map(k => (
            <div key={k} className={styles.stat + ' reveal'}>
              <dt className={styles.statLabel}>{t(`stat_${k}_label`)}</dt>
              <dd className={styles.statValue}>{t(`stat_${k}_value`)}</dd>
            </div>
          ))}
        </dl>

        <div className={styles.focusHeader}>
          <h3 className={styles.focusTitle}>{t('focusTitle')}</h3>
          <Link href="/projects" className={styles.textLink}>{t('focusCta')}</Link>
        </div>
        <ul className={styles.focusGrid}>
          {FOCUS_AREAS.map(({ key, icon }) => (
            <li key={key} className={styles.focusCard + ' reveal'}>
              <svg className={styles.focusIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={icon} />
              </svg>
              <h4 className={styles.focusName}>{t(`focus_${key}_title`)}</h4>
              <p className={styles.focusDesc}>{t(`focus_${key}_desc`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
