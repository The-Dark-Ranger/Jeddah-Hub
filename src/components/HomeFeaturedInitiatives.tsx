'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';

const PROJECT_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
];

interface Initiative { id: string; title: string; description: string; category?: string; }

export default function HomeFeaturedInitiatives() {
  const t = useTranslations('HomePage');
  const [items, setItems]   = useState<Initiative[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getDocs(query(
      collection(db, 'initiatives'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(3),
    )).then(snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  if (!loaded) return (
    <div className={styles.projectsGrid}>
      {[0, 1, 2].map(i => (
        <div key={i} className={styles.projectCard} style={{ opacity: 0.35 }}>
          <div className={styles.projectBanner} style={{ background: PROJECT_GRADIENTS[i] }} />
          <div className={styles.projectInfo}>
            <div style={{ height: 16, background: 'var(--border-color)', borderRadius: 6, width: '60%', marginBottom: 8 }} />
            <div style={{ height: 12, background: 'var(--border-color)', borderRadius: 4, width: '90%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  if (items.length === 0) return (
    <div className={styles.projectsGrid}>
      {[0, 1, 2].map(n => (
        <Link key={n} href={`/projects/p${n + 1}`} className={styles.projectCard}>
          <div className={styles.projectBanner} style={{ background: PROJECT_GRADIENTS[n] }} />
          <div className={styles.projectInfo}>
            <h3 className={styles.projectTitle}>{t(('featuredProjects.project' + (n + 1) + '.title') as Parameters<typeof t>[0])}</h3>
            <p className={styles.projectDesc}>{t(('featuredProjects.project' + (n + 1) + '.description') as Parameters<typeof t>[0])}</p>
            <span className={styles.projectBadge}>{t('active')}</span>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className={styles.projectsGrid}>
      {items.map((init, i) => (
        <Link key={init.id} href={`/projects/${init.id}`} className={styles.projectCard}>
          <div className={styles.projectBanner} style={{ background: PROJECT_GRADIENTS[i % PROJECT_GRADIENTS.length] }} />
          <div className={styles.projectInfo}>
            {init.category && <span className={styles.projectCategory}>{init.category}</span>}
            <h3 className={styles.projectTitle}>{init.title}</h3>
            <p className={styles.projectDesc}>{init.description?.slice(0, 120)}{init.description?.length > 120 ? '…' : ''}</p>
            <span className={styles.projectBadge}>{t('active')}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
