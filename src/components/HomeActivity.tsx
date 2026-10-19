'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';
import WaveDivider from './WaveDivider';
import { slugify } from '@/lib/slug';
import { safeColor } from '@/lib/activityTypes';

interface Highlight { name: string; tag: string; }

export interface Activity {
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
  imageUrl?: string;
  kind?: 'activity' | 'workshop';
  slug?: string;
}

function ActivityCard({ activity, t }: { activity: Activity; t: ReturnType<typeof useTranslations> }) {
  const hasHighlights = (activity.highlights?.length ?? 0) > 0;
  const hasAside = hasHighlights || !!activity.imageUrl;
  const accent = safeColor(activity.color);
  const href = `/activities/${activity.slug || slugify(activity.title)}`;

  return (
    <div className={styles.container + ' ' + styles.retreatFadeIn}>
      <div
        className={styles.retreatInner}
        style={!hasAside ? { gridTemplateColumns: '1fr' } : undefined}
      >
        <div className={styles.retreatText}>
          {activity.eyebrow && (
            <p className={styles.retreatEyebrow}>{activity.eyebrow}</p>
          )}
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
                className={styles.retreatBtn + (accent ? ' ' + styles.retreatBtnAccent : '')}
              >
                {activity.ctaText}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            )}
            <Link href={href} className={styles.retreatBtnSecondary}>
              {t('viewActivityDetails')}
            </Link>
          </div>
        </div>

        {hasAside && (
          <div className={styles.retreatAside}>
            {activity.imageUrl && (
              <div className={styles.retreatMedia}>
                <img src={activity.imageUrl} alt={activity.title} className={styles.retreatMediaImg} />
              </div>
            )}
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
        )}
      </div>
    </div>
  );
}

/** createdAt may be an ISO string (server-loaded) or a Firestore Timestamp. */
function timeOf(v: unknown): number {
  if (typeof v === 'string') return Date.parse(v) || 0;
  return (v as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
}

/** Active Hub Activities, newest first. */
export function activeActivities(docs: (Activity & { createdAt?: unknown })[]): Activity[] {
  return docs.filter(a => a.active === true).sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
}

/** `initial`: Hub Activity docs loaded on the server (see HomeSections);
 *  when absent they are fetched in the browser instead. */
export default function HomeActivity({ initial }: { initial?: Activity[] }) {
  const t = useTranslations('HomePage');
  const [activities, setActivities] = useState<Activity[] | 'loading'>(() => (initial ? activeActivities(initial) : 'loading'));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (initial) return;
    // db can be undefined if Firebase failed to initialize (missing env
    // vars) — collection()/query() throw synchronously in that case. Building
    // the query inside this initial .then() turns that throw into a normal
    // promise rejection, so the final .catch() below handles it the same way
    // it already handles a getDocs() failure, keeping the homepage rendering.
    Promise.resolve()
      .then(() => getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))))
      .then(snap => setActivities(activeActivities(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) })))))
      .catch(() => setActivities([]));
  }, [initial]);

  // Hold the section's space while loading, so it doesn't pop in later and
  // push everything below it down mid-scroll.
  if (activities === 'loading') return (
    <section className={styles.retreatSection} aria-busy="true">
      <WaveDivider flip fill="var(--card-bg)" />
      <div className={styles.retreatPlaceholder} />
      <WaveDivider fill="var(--background)" />
    </section>
  );

  const current = activities[index] as Activity | undefined;
  const accent = safeColor(current?.color);

  const goPrev = () => setIndex(i => (i - 1 + activities.length) % activities.length);
  const goNext = () => setIndex(i => (i + 1) % activities.length);

  return (
    <section
      className={styles.retreatSection + (accent ? ' ' + styles.retreatSectionAccent : '')}
      style={accent ? { '--activity-accent': accent } as React.CSSProperties : undefined}
    >
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
