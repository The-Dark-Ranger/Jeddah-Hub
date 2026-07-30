'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';
import { CATEGORY_COLORS } from '@/lib/placeholderProjects';

const PROJECT_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
];

interface Initiative {
  id: string;
  title: string;
  description: string;
  category?: string;
  images?: string[];
  stat?: string;
  color?: string;
}

function cardGradient(init: Initiative, fallback: string): string {
  if (init.images?.[0]) {
    return `linear-gradient(to bottom,rgba(0,0,0,.08) 0%,rgba(0,0,0,.6) 100%),url(${init.images[0]})`;
  }
  if (init.color) {
    return `linear-gradient(135deg,${init.color}ee,${init.color}99)`;
  }
  const cat = CATEGORY_COLORS[init.category ?? ''];
  if (cat) return `linear-gradient(135deg,${cat}ee,${cat}88)`;
  return fallback;
}

export default function HomeFeaturedInitiatives() {
  const t = useTranslations('HomePage');
  const [items, setItems]   = useState<Initiative[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const activeQ = query(
      collection(db, 'initiatives'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(3),
    );
    getDocs(activeQ)
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative));
        setItems(all.filter(i => !(i as any).type));
      })
      .catch(() =>
        getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'), limit(3)))
          .then(snap => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative));
            setItems(all.filter(i => !(i as any).type));
          })
          .catch(() => {})
      )
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return (
    <div className={styles.projectsGrid}>
      {PROJECT_GRADIENTS.map((grad, i) => (
        <div key={i} className={styles.projectCard} style={{ opacity: 0.35 }}>
          <div className={styles.projectBanner} style={{ background: grad }} />
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
      {([1, 2, 3] as const).map(n => (
        <Link key={n} href={`/projects/p${n}`} className={styles.projectCard}>
          <div className={styles.projectBanner} style={{ background: PROJECT_GRADIENTS[n - 1] }} />
          <div className={styles.projectInfo}>
            <h3 className={styles.projectTitle}>{t(`featuredProjects.project${n}.title` as Parameters<typeof t>[0])}</h3>
            <p className={styles.projectDesc}>{t(`featuredProjects.project${n}.description` as Parameters<typeof t>[0])}</p>
            <span className={styles.projectBadge}>{t('active')}</span>
          </div>
        </Link>
      ))}
    </div>
  );

  return (
    <div className={styles.projectsGrid}>
      {items.map((init, i) => {
        const bg = cardGradient(init, PROJECT_GRADIENTS[i % PROJECT_GRADIENTS.length]);
        const hasImage = !!init.images?.[0];
        return (
          <Link key={init.id} href={`/projects/${init.id}`} className={styles.projectCard}>
            <div
              className={styles.projectBanner}
              style={hasImage
                ? { backgroundImage: bg, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: bg }
              }
            >
              {init.category && <span className={styles.projectBannerTag}>{init.category}</span>}
            </div>
            <div className={styles.projectInfo}>
              <h3 className={styles.projectTitle}>{init.title}</h3>
              <p className={styles.projectDesc}>{init.description?.slice(0, 120)}{(init.description?.length ?? 0) > 120 ? '…' : ''}</p>
              <span className={styles.projectBadge}>{t('active')}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
