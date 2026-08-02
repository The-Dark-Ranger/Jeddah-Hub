'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations, useLocale } from 'next-intl';
import WaveDivider from '@/components/WaveDivider';
import styles from './ImpactReports.module.css';

interface Report {
  id: string;
  title: string;
  initiativeTitle?: string;
  summary?: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  createdAt?: any;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: any, locale: string): string {
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ImpactReportsPage() {
  const t = useTranslations('ImpactReportsPage');
  const locale = useLocale();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'impact_reports'), orderBy('createdAt', 'desc')));
        if (!cancelled) {
          setReports(
            snap.docs
              .map(d => ({ id: d.id, ...d.data() } as Report))
              .filter(r => !!r.fileUrl)
          );
        }
      } catch {
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.headerWave} />
      </section>

      <div className={styles.container}>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : reports.length === 0 ? (
          <div className={styles.empty}>
            <svg className={styles.emptyIcon} width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>{t('noReports')}</p>
          </div>
        ) : (
          <div className={styles.list}>
            {reports.map(r => (
              <div key={r.id} className={styles.card}>
                <div className={styles.cardIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div className={styles.cardBody}>
                  <h2 className={styles.cardTitle}>{r.title}</h2>
                  <div className={styles.cardMeta}>
                    {r.initiativeTitle && <span>{r.initiativeTitle}</span>}
                    {r.initiativeTitle && <span className={styles.cardMetaDot} />}
                    <span>{formatDate(r.createdAt, locale)}</span>
                    {r.fileSize > 0 && <span className={styles.cardMetaDot} />}
                    {r.fileSize > 0 && <span>{formatBytes(r.fileSize)}</span>}
                  </div>
                  {r.summary && <p className={styles.cardSummary}>{r.summary}</p>}
                </div>
                <a href={r.fileUrl} download={r.fileName} target="_blank" rel="noopener noreferrer" className={styles.downloadBtn}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {t('download')}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
