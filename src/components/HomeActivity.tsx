'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';
import WaveDivider from './WaveDivider';
import { slugify } from '@/lib/slug';

interface Highlight { name: string; tag: string; }

interface Activity {
  id: string;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  description?: string;
  date?: string;
  location?: string;
  ctaText?: string;
  ctaUrl?: string;
  highlights?: Highlight[];
  active?: boolean;
  color?: string;
  kind?: 'activity' | 'workshop';
  slug?: string;
}

function ActivityCard({ activity, t }: { activity: Activity; t: ReturnType<typeof useTranslations> }) {
  const hasHighlights = (activity.highlights?.length ?? 0) > 0;

  return (
    <div className={styles.container + ' ' + styles.retreatFadeIn}>
      <div
        className={styles.retreatInner}
        style={!hasHighlights ? { gridTemplateColumns: '1fr' } : undefined}
      >
        <div className={styles.retreatText}>
          <div className={styles.retreatBadgeRow}>
            <span className={styles.retreatKindBadge + ' ' + (activity.kind === 'workshop' ? styles.retreatKindWorkshop : '')}>
              {activity.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity')}
            </span>
            {activity.eyebrow && (
              <p className={styles.retreatEyebrow}>{activity.eyebrow}</p>
            )}
          </div>
          <h2 className={styles.retreatTitle}>{activity.title}</h2>
          {activity.subtitle && (
            <p className={styles.retreatSubtitle}>{activity.subtitle}</p>
          )}
          {activity.description && (
            <p className={styles.retreatDesc}>{activity.description}</p>
          )}
          {(activity.date || activity.location) && (
            <div className={styles.retreatMeta}>
              {activity.date && (
                <span className={styles.retreatMetaItem}>{activity.date}</span>
              )}
              {activity.date && activity.location && (
                <span className={styles.retreatMetaDot} />
              )}
              {activity.location && (
                <span className={styles.retreatMetaItem}>{activity.location}</span>
              )}
            </div>
          )}
          <div className={styles.retreatBtnRow}>
            {activity.ctaText && activity.ctaUrl && (
              <a
                href={activity.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.retreatBtn}
                style={activity.color ? { background: activity.color, borderColor: activity.color } : undefined}
              >
                {activity.ctaText}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            )}
            <Link href={`/activities/${activity.slug || slugify(activity.title)}`} className={styles.retreatBtnSecondary}>
              {t('viewActivityDetails')}
            </Link>
          </div>
        </div>

        {hasHighlights && (
          <div className={styles.retreatVenues}>
            <p className={styles.retreatVenuesTitle}>{t('activityHighlightsLabel')}</p>
            <div className={styles.retreatVenuesGrid}>
              {activity.highlights!.map(h => (
                <div key={h.name} className={styles.retreatVenueCard}>
                  <div className={styles.retreatVenueName}>{h.name}</div>
                  <div className={styles.retreatVenueTag}>{h.tag}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomeActivity() {
  const t = useTranslations('HomePage');
  const [activities, setActivities] = useState<Activity[] | 'loading'>('loading');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // db can be undefined if Firebase failed to initialize (missing env
    // vars) — collection()/query() throw synchronously in that case, before
    // getDocs() ever returns a rejected promise for .catch() to handle, so
    // this needs its own try/catch to keep the homepage rendering.
    try {
      const q = query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'));
      getDocs(q)
        .then(snap => {
          const all = snap.docs
            .map(d => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }))
            .filter(a => a.active === true)
            .sort((a, b) => {
              const ta = (a as any).createdAt?.toMillis?.() ?? 0;
              const tb = (b as any).createdAt?.toMillis?.() ?? 0;
              return tb - ta;
            });
          setActivities(all);
        })
        .catch(() => setActivities([]));
    } catch {
      setActivities([]);
    }
  }, []);

  if (activities === 'loading') return null;

  const goPrev = () => setIndex(i => (i - 1 + activities.length) % activities.length);
  const goNext = () => setIndex(i => (i + 1) % activities.length);

  return (
    <section className={styles.retreatSection}>
      <WaveDivider flip fill="var(--card-bg)" />

      {activities.length > 0 ? (
        <>
          <ActivityCard key={activities[index].id} activity={activities[index]} t={t} />

          {activities.length > 1 && (
            <div className={styles.container}>
              <div className={styles.retreatSlider}>
                <button
                  type="button"
                  className={styles.retreatSliderArrow}
                  onClick={goPrev}
                  aria-label={t('previousActivity')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <div className={styles.retreatSliderDots}>
                  {activities.map((a, i) => (
                    <button
                      key={a.id}
                      type="button"
                      className={styles.retreatSliderDot + (i === index ? ' ' + styles.retreatSliderDotActive : '')}
                      onClick={() => setIndex(i)}
                      aria-label={`${t('goToSlide')} ${i + 1}`}
                      aria-current={i === index}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.retreatSliderArrow}
                  onClick={goNext}
                  aria-label={t('nextActivity')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.container}>
          <div className={styles.stayTunedInner}>
            <div className={styles.stayTunedIcon} aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <h2 className={styles.stayTunedTitle}>{t('stayTunedTitle')}</h2>
            <p className={styles.stayTunedDesc}>{t('stayTunedDesc')}</p>
          </div>
        </div>
      )}

      <WaveDivider fill="var(--background)" />
    </section>
  );
}
