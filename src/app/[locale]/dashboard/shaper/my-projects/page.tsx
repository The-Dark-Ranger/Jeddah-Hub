'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './MyProjects.module.css';

interface MyProject {
  id: string;
  title: string;
  category?: string;
  stat?: string;
  imageUrl?: string;
}

export default function MyProjects() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const [projects, setProjects] = useState<MyProject[]>([]);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    if (!user) return;

    // Filter server-side so archived initiatives are never downloaded.
    getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'))).then(snap => {
      const joined: MyProject[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        // Hub Activities are stored as initiatives docs tagged
        // type:'hub_activity' — never a real "My Projects" entry.
        if (data.type) return;
        if (data.members?.some((m: any) => m === user.uid || m?.userId === user.uid)) {
          joined.push({
            id: d.id,
            title: data.title || d.id,
            category: data.category || undefined,
            stat: data.stat || undefined,
            imageUrl: data.imageUrl || undefined,
          });
        }
      });
      setProjects(joined);
    }).catch(() => setProjects([])).finally(() => setLoaded(true));
  }, [user]);

  if (!user || !loaded) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('loading')}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t('profileActiveProjects')}</h2>
        <p className={styles.pageSubtitle}>{t('myProjectsSubtitle')}</p>
      </div>

      {projects.length === 0 ? (
        <div className={styles.empty}>{t('noActiveProjects')}</div>
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} className={styles.card}>
              <div
                className={styles.cardBanner}
                style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}
              >
                {!p.imageUrl && (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                )}
              </div>
              <div className={styles.cardBody}>
                {p.category && <span className={styles.categoryPill}>{p.category}</span>}
                <h3 className={styles.cardTitle}>{p.title}</h3>
                {p.stat && <p className={styles.cardStat}>{p.stat}</p>}
                <span className={styles.viewLink}>
                  {t('viewProject')}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
