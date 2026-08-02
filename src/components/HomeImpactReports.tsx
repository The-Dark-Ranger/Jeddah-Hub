'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';

interface Report {
  id: string;
  title: string;
  initiativeTitle?: string;
  fileUrl: string;
  createdAt?: any;
}

function formatDate(value: any, locale: string): string {
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', year: 'numeric' });
}

/** Homepage preview of the 3 most recent impact reports, linking through to
 *  the full /impact-reports page. Self-contained and quiet on failure, same
 *  pattern as HomeFeaturedInitiatives — a missing composite index or an
 *  empty collection should never break the homepage. */
export default function HomeImpactReports() {
  const t = useTranslations('ImpactReportsPage');
  const locale = useLocale();
  const [items, setItems]   = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, 'impact_reports'), orderBy('createdAt', 'desc'), limit(3)))
      .then(snap => {
        if (cancelled) return;
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)).filter(r => !!r.fileUrl));
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  if (!loaded || items.length === 0) return null;

  return (
    <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('title')}</h2>
          <p className={styles.sectionSubtitle}>{t('homeSubtitle')}</p>
          <div className={styles.sectionDivider} />
        </div>

        <div className={styles.reportsList}>
          {items.map(r => (
            <Link key={r.id} href="/impact-reports" className={styles.reportCard}>
              <div className={styles.reportIcon}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className={styles.reportInfo}>
                <span className={styles.reportTitle}>{r.title}</span>
                <span className={styles.reportMeta}>
                  {r.initiativeTitle ? `${r.initiativeTitle} · ` : ''}{formatDate(r.createdAt, locale)}
                </span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={styles.reportArrow}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          ))}
        </div>

        <div className={styles.sectionCta}>
          <Link href="/impact-reports" className={styles.secondaryButton}>{t('viewAll')}</Link>
        </div>
      </div>
    </section>
  );
}
