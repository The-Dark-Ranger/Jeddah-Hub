'use client';

/* Dashboard > Export Emails: download newsletter subscribers as CSV or Excel. */
import { useCallback, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useLocale, useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import styles from './Exports.module.css';
import { spreadsheetSafe } from '@/lib/sanitize';

interface Subscriber { email: string; subscribedAt?: string; }

const DAY = 86_400_000;

export default function ExportEmails() {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const { user } = useAuth();
  const normRole  = normalizeRole(user?.role);
  const isCurator = normRole === 'curator' || normRole === 'vice_curator';
  const [subs, setSubs]       = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [copied, setCopied]   = useState<'lines' | 'commas' | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'newsletter_subscribers'));
      setSubs(snap.docs
        .map(d => d.data() as Subscriber)
        .filter(s => !!s.email)
        .sort((a, b) => (b.subscribedAt ?? '').localeCompare(a.subscribedAt ?? '')));
    } catch (e) {
      console.error(e);
      alert(t('saveFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
  useEffect(() => { if (isCurator) void load(); }, [isCurator, load]);

  const fmt = (iso?: string) => iso
    ? new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '-';

  const visible = subs.filter(s => matchesQuery(search, s.email));
  const newThisMonth = subs.filter(s => s.subscribedAt && now - Date.parse(s.subscribedAt) < 30 * DAY).length;

  const downloadCSV = () => {
    const rows = [['email', 'subscribed_at'], ...visible.map(s => [s.email, s.subscribedAt ?? ''])];
    // Quoted, with formula-looking values neutralised (subscribers type their
    // own email into a public form).
    const csv = rows.map(r => r.map(v => `"${String(spreadsheetSafe(v)).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeddah-hub-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const copy = async (mode: 'lines' | 'commas') => {
    try {
      await navigator.clipboard.writeText(visible.map(s => s.email).join(mode === 'lines' ? '\n' : ', '));
      setCopied(mode);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  if (!isCurator) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('dataExport')}</h2>
          <p className={styles.subtitle}>{t('exportDesc')}</p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => void load()} disabled={loading}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={loading ? styles.spinning : undefined}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {t('refresh')}
        </button>
      </div>

      {/* At a glance */}
      <div className={styles.stats}>
        {([
          [t('newsletterSubscribers'), loading ? '…' : subs.length.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US'), 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6'],
          [t('newLast30Days'), loading ? '…' : `+${newThisMonth}`, 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6'],
          [t('latestSignup'), loading ? '…' : fmt(subs[0]?.subscribedAt), 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2'],
        ] as const).map(([label, value, icon]) => (
          <div key={label} className={styles.stat}>
            <span className={styles.statIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
            </span>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
          </div>
        ))}
      </div>

      {/* Subscriber list */}
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <DashSearch value={search} onChange={setSearch} placeholder={t('searchSubscribersPh')}
            resultLabel={t('resultsCount', { count: visible.length })} />
          <div className={styles.actions}>
            <button type="button" className={styles.copyBtn} onClick={() => copy('lines')} disabled={!visible.length}>
              {copied === 'lines' ? t('copied') : t('copyAll')}
            </button>
            <button type="button" className={styles.copyBtn} onClick={() => copy('commas')} disabled={!visible.length} title={t('copyCommasHint')}>
              {copied === 'commas' ? t('copied') : t('copyCommas')}
            </button>
            <button type="button" className={styles.downloadBtn} onClick={downloadCSV} disabled={!visible.length}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t('downloadCSV')}
            </button>
          </div>
        </div>

        {loading ? (
          <DashSkeleton rows={4} header={false} label={t('loading')} />
        ) : visible.length === 0 ? (
          <p className={styles.empty}>{search ? t('noMatches') : t('noSubscribersYet')}</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>#</th><th>{t('emailAddresses')}</th><th>{t('subscribedOn')}</th></tr>
              </thead>
              <tbody>
                {visible.map((s, i) => (
                  <tr key={s.email}>
                    <td className={styles.num}>{i + 1}</td>
                    <td>
                      <span className={styles.email}>
                        <span className={styles.avatar} aria-hidden="true">{s.email.charAt(0).toUpperCase()}</span>
                        <span className={styles.emailText}>{s.email}</span>
                      </span>
                    </td>
                    <td className={styles.date}>{fmt(s.subscribedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
