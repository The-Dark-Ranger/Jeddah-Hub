'use client';

import { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';

export default function ImpactReports() {
  const t = useTranslations('Dashboard');
  const { user } = useAuth();
  const normRole = user?.role?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const canManage = normRole === 'curator' || normRole === 'vice_curator' || normRole === 'impact_officer';
  const [initiativeId, setInitiativeId] = useState('');
  const [metrics, setMetrics]           = useState('');
  const [saving, setSaving]             = useState(false);

  const handleSave = async () => {
    if (!initiativeId || !metrics || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'impact_reports'), {
        initiativeId, metrics, createdAt: new Date().toISOString(),
      });
      setInitiativeId(''); setMetrics('');
      alert(t('reportSaved'));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;
  }

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
        <button onClick={handleSave} disabled={saving}
          style={{ padding:'0.5rem 1rem', background:'var(--primary-blue)', color:'white', borderRadius:'4px', opacity: saving ? 0.7 : 1 }}>
          {saving ? t('savingDots') : t('saveReport')}
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
