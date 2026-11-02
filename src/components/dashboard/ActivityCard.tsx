'use client';

/* One Hub Activity in a dashboard list: its photo, type, title, date, status
 * badges and whatever actions the page offers (passed as children). */
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { safeColor, type HubActivity } from '@/lib/activityTypes';
import { slugify } from '@/lib/slug';
import styles from '@/app/[locale]/dashboard/curator/activities/Activities.module.css';

export default function ActivityCard({ activity: a, children }: { activity: HubActivity; children: React.ReactNode }) {
  const t = useTranslations('Dashboard');
  const accent = safeColor(a.color);
  return (
    <div
      className={styles.card + (a.active ? ' ' + styles.cardActive : '')}
      style={accent ? { '--activity-accent': accent } as React.CSSProperties : undefined}
    >
      <div className={styles.cardTop}>
        {a.imageUrl && <img src={a.imageUrl} alt="" className={styles.cardThumb} loading="lazy" />}
        <div className={styles.cardInfo}>
          <div className={styles.cardBadgeRow}>
            <span className={styles.kindBadge + ' ' + (a.kind === 'workshop' ? styles.kindWorkshop : styles.kindActivity)}>
              {a.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
            </span>
            {a.eyebrow && <p className={styles.cardEyebrow}>{a.eyebrow}</p>}
          </div>
          <h2 className={styles.cardTitle}>{a.title}</h2>
          {a.subtitle && <p className={styles.cardSubtitle}>{a.subtitle}</p>}
          {(a.date || a.location) && (
            <p className={styles.cardMeta}>{[a.date, a.location].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className={styles.cardBadges}>
          <span className={styles.badge + ' ' + (a.active ? styles.badgeActive : styles.badgeInactive)}>
            {a.active ? t('activityActive') : t('activityInactive')}
          </span>
          {a.archived && <span className={styles.badge + ' ' + styles.badgeArchived}>{t('filterArchived')}</span>}
          {a.customForm?.enabled && (
            <span className={styles.badge + ' ' + (a.customForm.closed ? styles.badgeRegClosed : styles.badgeRegOpen)}>
              {a.customForm.closed ? t('regBadgeClosed') : t('regBadgeOpen')}
            </span>
          )}
          {a.feedbackForm?.enabled && (
            <span className={styles.badge + ' ' + (a.feedbackForm.closed ? styles.badgeRegClosed : styles.badgeRegOpen)}>
              {a.feedbackForm.closed ? t('fbBadgeClosed') : t('fbBadgeOpen')}
            </span>
          )}
        </div>
      </div>
      {a.description && <p className={styles.cardDesc}>{a.description}</p>}
      <div className={styles.cardActions}>
        {children}
        {a.active && (
          <Link href={`/activities/${a.slug || slugify(a.title)}`} className={styles.viewLink}>{t('viewOnSite')}</Link>
        )}
      </div>
    </div>
  );
}
