'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';

export default function ImpactReports() {
  const t = useTranslations('Dashboard');
  const [initiativeId, setInitiativeId] = useState('');
  const [metrics, setMetrics]           = useState('');

  const handleSave = async () => {
    if (!initiativeId || !metrics) return;
    await addDoc(collection(db, 'impact_reports'), {
      initiativeId, metrics, createdAt: new Date().toISOString(),
    });
    setInitiativeId(''); setMetrics('');
    alert(t('reportSaved'));
  };

  return (
    <div>
      <h2>{t('impactReports')}</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '1rem' }}>
        <h3>{t('createReport')}</h3>
        <input value={initiativeId} onChange={e => setInitiativeId(e.target.value)}
          placeholder={t('initiativeIdPlaceholder')}
          style={{ display:'block', width:'100%', padding:'0.5rem', margin:'1rem 0' }} />
        <textarea value={metrics} onChange={e => setMetrics(e.target.value)}
          placeholder={t('metricsPlaceholder')}
          style={{ display:'block', width:'100%', padding:'0.5rem', margin:'1rem 0', height:'100px' }} />
        <button onClick={handleSave}
          style={{ padding:'0.5rem 1rem', background:'var(--primary-blue)', color:'white', borderRadius:'4px' }}>
          {t('saveReport')}
        </button>
      </div>
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h3>{t('visualAnalytics')}</h3>
        <div style={{ height:'200px', background:'var(--background)', display:'flex', alignItems:'center', justifyContent:'center', marginTop:'1rem', border:'1px dashed var(--border-color)' }}>
          [ Bar Chart / Graphs ]
        </div>
      </div>
    </div>
  );
}
