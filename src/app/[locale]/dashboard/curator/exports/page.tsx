'use client';

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import styles from './Exports.module.css';

export default function ExportEmails() {
  const t = useTranslations('Dashboard');
  const { user } = useAuth();
  const normRole  = user?.role?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const isCurator = normRole === 'curator' || normRole === 'vice_curator';
  const [emails, setEmails]   = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const pullEmails = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'newsletter_subscribers'));
      setEmails(snap.docs.map(d => d.data().email).filter(Boolean));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const downloadCSV = () => {
    const blob = new Blob([emails.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'subscribers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(emails.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isCurator) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{t('dataExport')}</h2>
        <p className={styles.subtitle}>{t('exportDesc')}</p>
      </div>

      {/* Pull section */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          {t('newsletterSubscribers')}
        </h3>
        <p className={styles.cardDesc}>{t('exportNewsletterDesc')}</p>
        <div className={styles.actionRow}>
          <button className={styles.pullBtn} onClick={pullEmails} disabled={loading}>
            {loading ? (
              <><span className={styles.spinner} /> {t('pulling')}</>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                {t('pullEmails')}
              </>
            )}
          </button>

          {emails.length > 0 && (
            <button className={styles.downloadBtn} onClick={downloadCSV}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t('downloadCSV')}
            </button>
          )}
        </div>

        {emails.length > 0 && (
          <>
            <div className={styles.resultMeta}>
              <span className={styles.countBadge}>{emails.length}</span>
              <span className={styles.resultLabel}>{t('foundSubscribers', { n: emails.length })}</span>
            </div>
            <div className={styles.listWrap}>
              <div className={styles.listHeader}>
                <span className={styles.listHeaderLabel}>{t('emailAddresses')}</span>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {t('copied')}
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      {t('copyAll')}
                    </>
                  )}
                </button>
              </div>
              <textarea
                className={styles.emailTextarea}
                readOnly
                value={emails.join('\n')}
                spellCheck={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
