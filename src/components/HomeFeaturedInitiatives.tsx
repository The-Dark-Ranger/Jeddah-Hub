'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from '@/app/[locale]/Home.module.css';
import { CATEGORY_COLORS, PLACEHOLDER_PROJECTS } from '@/lib/placeholderProjects';
import { slugify } from '@/lib/slug';

const PROJECT_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
];

export interface Initiative {
  id: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  type?: string;
  featured?: boolean;
  featuredAt?: string;
  createdAt?: string | { toMillis?: () => number };
  category?: string;
  imageUrl?: string;
  images?: string[];
  stat?: string;
  color?: string;
  slug?: string;
}

/** Milliseconds for a createdAt that may be an ISO string or a Firestore Timestamp. */
function timeOf(v: Initiative['createdAt'] | string | undefined): number {
  if (!v) return 0;
  if (typeof v === 'string') return Date.parse(v) || 0;
  return v.toMillis?.() ?? 0;
}

/** Curator-picked initiatives (newest pick first), or — when none are
 *  picked — the newest active initiatives. */
function pickFeatured(all: Initiative[]): Initiative[] {
  const real = all.filter(i => !i.type);
  const picked = real.filter(i => i.featured).sort((a, b) => timeOf(b.featuredAt) - timeOf(a.featuredAt));
  if (picked.length > 0) return picked.slice(0, 3);
  return [...real].sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt)).slice(0, 3);
}

function cardImage(init: Initiative): string | undefined {
  return init.imageUrl || init.images?.[0];
}

function cardGradient(init: Initiative, fallback: string): string {
  const img = cardImage(init);
  if (img) {
    return `linear-gradient(to bottom,rgba(0,0,0,.08) 0%,rgba(0,0,0,.6) 100%),url(${img})`;
  }
  if (init.color) {
    return `linear-gradient(135deg,${init.color}ee,${init.color}99)`;
  }
  const cat = CATEGORY_COLORS[init.category ?? ''];
  if (cat) return `linear-gradient(135deg,${cat}ee,${cat}88)`;
  return fallback;
}

/** `initial`: active initiatives loaded on the server (see HomeSections);
 *  when absent the list is fetched in the browser instead. */
export default function HomeFeaturedInitiatives({ initial }: { initial?: Initiative[] }) {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  const [items, setItems]   = useState<Initiative[]>(() => (initial ? pickFeatured(initial) : []));
  const [loaded, setLoaded] = useState(!!initial);

  useEffect(() => {
    if (initial) return;
    // db can be undefined if Firebase failed to initialize (missing env
    // vars) — collection()/query() throw synchronously in that case. Building
    // the query inside this initial .then() turns that throw into a normal
    // promise rejection, so the .catch() below handles it the same way it
    // already handles a getDocs() failure, keeping the homepage rendering.
    // A single-field query (no composite index needed); featuring and
    // newest-first ordering are decided client-side by pickFeatured().
    Promise.resolve()
      .then(() => getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'))))
      .then(snap => setItems(pickFeatured(snap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative)))))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [initial]);

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
      {PLACEHOLDER_PROJECTS.slice(0, 3).map((p, i) => (
        <Link key={p.id} href={`/projects/${p.id}`} className={styles.projectCard}>
          <div className={styles.projectBanner} style={{ background: PROJECT_GRADIENTS[i] }} />
          <div className={styles.projectInfo}>
            <h3 className={styles.projectTitle}>{p.title}</h3>
            <p className={styles.projectDesc}>{p.description}</p>
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
        const hasImage = !!cardImage(init);
        return (
          <Link key={init.id} href={`/projects/${init.slug || slugify(init.title)}`} className={styles.projectCard}>
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
              <h3 className={styles.projectTitle}>{(locale === 'ar' && init.titleAr) || init.title}</h3>
              <p className={styles.projectDesc}>{(locale === 'ar' && init.descriptionAr) || init.description}</p>
              <span className={styles.projectBadge}>{t('active')}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
