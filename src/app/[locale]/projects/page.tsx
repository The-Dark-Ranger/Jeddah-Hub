'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import styles from './Projects.module.css';
import WaveDivider from '@/components/WaveDivider';
import { PLACEHOLDER_PROJECTS, CATEGORY_COLORS, type PlaceholderProject } from '@/lib/placeholderProjects';
import { slugify } from '@/lib/slug';

interface Project extends PlaceholderProject { slug?: string; }

function ProjectCard({ project, archived, t, index = 0 }: {
  project: Project;
  archived?: boolean;
  t: ReturnType<typeof useTranslations>;
  index?: number;
}) {
  const locale = useLocale();
  const title = locale === 'ar' && project.titleAr ? project.titleAr : project.title;
  const description = locale === 'ar' && project.descriptionAr ? project.descriptionAr : project.description;
  const accentColor = project.color || CATEGORY_COLORS[project.category ?? ''] || CATEGORY_COLORS.Default;
  const isActive = !archived;
  // Just the cover — a multi-photo carousel on a listing-page card made
  // every card's image block a different shape (arrows/dots on some,
  // nothing on others) and encouraged clicking a nav arrow instead of the
  // card itself. Full multi-photo browsing already lives on the
  // initiative's own detail page (InitiativeGallery); this card is only
  // ever a preview.
  const coverImg = project.imageUrl || project.images?.[0];

  return (
    <Link
      href={'/projects/' + (project.slug || slugify(project.title))}
      className={styles.card + (archived ? ' ' + styles.cardArchived : '')}
      style={{ '--card-index': index } as React.CSSProperties}
    >
      <div className={styles.cardSlider}>
        {coverImg
          ? <img src={coverImg} alt={title} className={styles.cardSliderImg} loading="lazy" />
          : <div className={styles.cardImgFallback} style={{ background: `linear-gradient(135deg, ${accentColor}dd, ${accentColor}88)` }} />
        }
      </div>
      <div className={styles.cardAccent} style={{ background: accentColor }} />
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          {project.category && (
            <span className={styles.cardCategory} style={{ color: accentColor, background: accentColor + '22' }}>
              {project.category.toUpperCase()}
            </span>
          )}
          <span className={styles.cardStatus + ' ' + (isActive ? styles.cardStatusActive : styles.cardStatusArchived)}>
            <span className={styles.statusDot} />
            {isActive ? t('active') : t('completed')}
          </span>
        </div>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardDesc}>{description}</p>
        {project.stat && (
          <div className={styles.cardStat}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
            {project.stat}
          </div>
        )}
        <div className={styles.cardLink}>
          {t('exploreProject')}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={styles.skeletonAccent} />
      <div className={styles.skeletonBody}>
        <div className={styles.skeletonMeta} />
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLineShort} />
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const t  = useTranslations('ProjectsPage');
  const tc = useTranslations('Categories');
  const [projects, setProjects]     = useState<Project[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch]         = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'initiatives'));
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Project))
          .filter(p => !(p as any).type);
        setProjects(all.length > 0 ? all : PLACEHOLDER_PROJECTS);
      } catch {
        setProjects(PLACEHOLDER_PROJECTS);
      }
      setLoading(false);
    };
    fetchProjects();
  }, []);

  // Built from whatever categories actually exist on fetched initiatives,
  // rather than a hardcoded/translated list — a curator picking any
  // category (including a custom "Other" one) always gets a matching,
  // clickable tab instead of silently having no way to filter to it.
  const categoryTabs = Array.from(
    new Set(projects.map(p => p.category?.trim()).filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = projects.filter(p => {
    const matchCat = activeCategory === 'all' || p.category?.trim() === activeCategory;
    const matchSearch = !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const active   = filtered.filter(p => p.status === 'active' || !p.status);
  const archived = filtered.filter(p => p.status && p.status !== 'active');

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerOrb} />
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.headerWave} />
      </section>

      <div className={styles.container}>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.categoryTabs}>
            <button
              className={styles.catBtn + (activeCategory === 'all' ? ' ' + styles.catBtnActive : '')}
              onClick={() => setActiveCategory('all')}
            >
              {tc('all')}
            </button>
            {categoryTabs.map(cat => (
              <button
                key={cat}
                className={styles.catBtn + (activeCategory === cat ? ' ' + styles.catBtnActive : '')}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <h3>{t('noResults')}</h3>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <span className={styles.dot} style={{ background: '#10b981' }} />
                  {t('activeSection')}
                  <span className={styles.sectionCount}>{active.length}</span>
                </div>
                <div className={styles.grid}>
                  {active.map((p, i) => <ProjectCard key={p.id} project={p} t={t} index={i} />)}
                </div>
              </div>
            )}
            {archived.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <span className={styles.dot} style={{ background: '#94a3b8' }} />
                  {t('pastSection')}
                  <span className={styles.sectionCount}>{archived.length}</span>
                </div>
                <div className={styles.grid}>
                  {archived.map((p, i) => <ProjectCard key={p.id} project={p} archived t={t} index={i} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
