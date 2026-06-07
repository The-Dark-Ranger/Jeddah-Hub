'use client';

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

export default function ExportEmails() {
  const t = useTranslations('Dashboard');
  const [emails, setEmails]   = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const pullEmails = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'newsletter_subscribers'));
      setEmails(snap.docs.map(d => d.data().email));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const downloadCSV = () => {
    const uri = encodeURI('data:text/csv;charset=utf-8,' + emails.join('\n'));
    const a = document.createElement('a');
    a.href = uri; a.download = 'subscribers.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div>
      <h2>{t('dataExport')}</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
        <p>{t('exportDesc')}</p>
        <button onClick={pullEmails} disabled={loading}
          style={{ padding:'0.5rem 1rem', background:'var(--primary-blue)', color:'white', borderRadius:'4px', marginTop:'1rem' }}>
          {loading ? t('pulling') : t('pullEmails')}
        </button>
        {emails.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <p>{t('foundSubscribers', { n: emails.length })}</p>
            <button onClick={downloadCSV}
              style={{ padding:'0.5rem 1rem', background:'green', color:'white', borderRadius:'4px', marginTop:'0.5rem' }}>
              {t('downloadCSV')}
            </button>
            <textarea readOnly value={emails.join('\n')}
              style={{ width:'100%', height:'200px', marginTop:'1rem', padding:'0.5rem' }} />
          </div>
        )}
      </div>
    </div>
  );
}
