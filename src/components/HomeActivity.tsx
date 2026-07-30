'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import styles from '@/app/[locale]/Home.module.css';
import WaveDivider from './WaveDivider';

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
}

export default function HomeActivity() {
  const t = useTranslations('HomePage');
  const [activity, setActivity] = useState<Activity | null | 'loading'>('loading');

  useEffect(() => {
    const q = query(
      collection(db, 'hub_activities'),
      where('active', '==', true),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    getDocs(q)
      .then(snap => {
        if (!snap.empty) {
          const d = snap.docs[0];
          setActivity({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) });
        } else {
          setActivity(null);
        }
      })
      .catch(() => setActivity(null));
  }, []);

  if (activity === 'loading') return null;

  return (
    <section className={styles.retreatSection}>
      <WaveDivider flip fill="var(--card-bg)" />

      {activity ? (
        <div className={styles.container}>
          <div className={styles.retreatInner} style={(!activity.highlights?.length) ? { gridTemplateColumns: '1fr' } : undefined}>
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
              {activity.ctaText && activity.ctaUrl && (
                <a
                  href={activity.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.retreatBtn}
                >
                  {activity.ctaText}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </a>
              )}
            </div>

            {activity.highlights && activity.highlights.length > 0 && (
              <div className={styles.retreatVenues}>
                <p className={styles.retreatVenuesTitle}>{t('activityHighlightsLabel')}</p>
                <div className={styles.retreatVenuesGrid}>
                  {activity.highlights.map(h => (
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
