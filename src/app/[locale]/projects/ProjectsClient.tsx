'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import styles from './Projects.module.css';
import Image from 'next/image';
import WaveDivider from '@/components/WaveDivider';
import PatternDivider from '@/components/PatternDivider';
import { PLACEHOLDER_PROJECTS, CATEGORY_COLORS, type PlaceholderProject } from '@/lib/placeholderProjects';
import { slugify } from '@/lib/slug';
import { useCategoryLabel } from '@/lib/categoryLabel';
import InitiativeCover from '@/components/InitiativeCover';

export interface Project extends PlaceholderProject { slug?: string; featured?: boolean; spotlight?: boolean; }

/** The big feature card at the top of the list: a curator-featured
 *  initiative if there is one, otherwise the first active one. */
function Spotlight({ project, t, catLabel }: {
  project: Project;
  t: ReturnType<typeof useTranslations>;
  catLabel: (category: string) => string;
}) {
  const locale = useLocale();
  const title = locale === 'ar' && project.titleAr ? project.titleAr : project.title;
  const description = locale === 'ar' && project.descriptionAr ? project.descriptionAr : project.description;
  const accent = project.color || CATEGORY_COLORS[project.category ?? ''] || CATEGORY_COLORS.Default;
  const cover = project.imageUrl || project.images?.[0];
  return (
    <Link
      href={'/projects/' + (project.slug || slugify(project.title))}
      className={styles.spotlight}
      style={{ '--spot-accent': accent } as React.CSSProperties}
    >
      <div className={styles.spotlightMedia}>
        <InitiativeCover src={cover} title={title} accent={accent} imgClassName={styles.spotlightImg} className={styles.spotlightCover} eager />
        <span className={styles.spotlightTag}>{t('spotlight')}</span>
      </div>
      <div className={styles.spotlightBody}>
        {project.category && <span className={styles.spotlightCategory}>{catLabel(project.category)}</span>}
        <h2 className={styles.spotlightTitle}>{title}</h2>
        <p className={styles.spotlightDesc}>{description}</p>
        {project.stat && <p className={styles.spotlightStat}>{project.stat}</p>}
        <span className={styles.spotlightLink}>
          {t('exploreProject')}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function ProjectCard({ project, archived, t, catLabel, index = 0 }: {
  project: Project;
  archived?: boolean;
  t: ReturnType<typeof useTranslations>;
  catLabel: (category: string) => string;
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
  const teamSize = Array.isArray(project.members) ? project.members.length : 0;
  const yearOf = (v?: string) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d.getFullYear() : null; };
  const startYear = yearOf(project.startDate), endYear = yearOf(project.endDate);
  const year = startYear
    ? (endYear && endYear !== startYear ? `${startYear}–${endYear}` : String(startYear)).replace(/\d/g, dgt => locale === 'ar' ? '٠١٢٣٤٥٦٧٨٩'[+dgt] : dgt)
    : '';

  return (
    <Link
      href={'/projects/' + (project.slug || slugify(project.title))}
      className={styles.card + (archived ? ' ' + styles.cardArchived : '')}
      style={{ '--card-index': index } as React.CSSProperties}
    >
      <div className={styles.cardSlider}>
        <InitiativeCover src={coverImg} title={title} accent={accentColor} imgClassName={styles.cardSliderImg} />
      </div>
      <div className={styles.cardAccent} style={{ background: accentColor }} />
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          {project.category && (
            <span className={styles.cardCategory} style={{ color: accentColor, background: accentColor + '22' }}>
              {catLabel(project.category).toLocaleUpperCase(locale)}
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
            {project.stat}
          </div>
        )}
        {(teamSize > 0 || year) && (
          <div className={styles.cardFacts}>
            {teamSize > 0 && (
              <span className={styles.cardFact}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {t('shapersCount', { count: teamSize })}
              </span>
            )}
            {year && (
              <span className={styles.cardFact}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {year}
              </span>
            )}
          </div>
        )}
        <div className={styles.cardLink}>
          {t('exploreProject')}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
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

/** `initial`: initiatives loaded on the server (page.tsx); when absent
 *  they are fetched in the browser instead. */
export default function ProjectsClient({ initial }: { initial?: Project[] }) {
  const t  = useTranslations('ProjectsPage');
  const tc = useTranslations('Categories');
  const locale = useLocale();
  // Known categories get a translated label; custom ones show as typed.
  const catLabel = useCategoryLabel();
  const [projects, setProjects]     = useState<Project[]>(() =>
    initial ? (initial.length > 0 ? initial : PLACEHOLDER_PROJECTS) : []);
  const [loading, setLoading]       = useState(!initial);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch]         = useState('');

  useEffect(() => {
    if (initial) return;
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'initiatives'));
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Project))
          .filter(p => !(p as Project & { type?: string }).type);
        setProjects(all.length > 0 ? all : PLACEHOLDER_PROJECTS);
      } catch {
        setProjects(PLACEHOLDER_PROJECTS);
      }
      setLoading(false);
    };
    fetchProjects();
  }, [initial]);

  // Built from whatever categories actually exist on fetched initiatives,
  // rather than a hardcoded/translated list — a curator picking any
  // category (including a custom "Other" one) always gets a matching,
  // clickable tab instead of silently having no way to filter to it.
  const categoryTabs = Array.from(
    new Set(projects.map(p => p.category?.trim()).filter((c): c is string => !!c))
  ).sort((a, b) => a.localeCompare(b));

  const q = search.trim().toLowerCase();
  const filtered = projects.filter(p => {
    const matchCat = activeCategory === 'all' || p.category?.trim() === activeCategory;
    const matchSearch = !q || [p.title, p.titleAr, p.description, p.descriptionAr, p.category, p.category && catLabel(p.category)]
      .some(v => v?.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });
  const countIn = (cat: string) => projects.filter(p => p.category?.trim() === cat).length;

  // Spotlight only on the unfiltered view, so a search never hides a match in it.
  const showSpotlight = activeCategory === 'all' && !q;
  // Only the initiative a curator / impact officer put in the spotlight.
  // With none picked (or after "Remove spotlight") there's no Spotlight
  // card and the page is just the grid.
  const isActive = (p: Project) => p.status === 'active' || !p.status;
  const spotlight = showSpotlight ? projects.find(p => p.spotlight && isActive(p)) : undefined;
  const active   = filtered.filter(p => (p.status === 'active' || !p.status) && p.id !== spotlight?.id);
  const archived = filtered.filter(p => p.status && p.status !== 'active');

  // Summary strip under the header (whole list, not the current filter).
  const activeCount = projects.filter(isActive).length;
  const shaperCount = new Set(projects.flatMap(p => (Array.isArray(p.members) ? p.members : []).map(m => m.userId))).size;
  const stats = [
    { value: activeCount, label: t('statActive') },
    { value: shaperCount, label: t('statShapers') },
    { value: categoryTabs.length, label: t('statAreas') },
  ].filter(s => s.value > 0);
  const clearFilters = () => { setSearch(''); setActiveCategory('all'); };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerOrb} />
        <Image src="/globe-mosaic.png" alt="" width={1061} height={1018} className={styles.headerGlobe} sizes="260px" aria-hidden="true" />
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.headerWave} />
      </section>
      <PatternDivider />

      <div className={styles.container}>
        {!loading && stats.length > 0 && (
          <dl className={styles.stats}>
            {stats.map(s => (
              <div key={s.label} className={styles.stat}>
                <dt>{s.label}</dt>
                <dd>{s.value.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              aria-label={t('searchPlaceholder')}
              className={styles.searchInput}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.categoryTabs} role="group" aria-label={t('filterByArea')}>
            <button
              type="button"
              aria-pressed={activeCategory === 'all'}
              className={styles.catBtn + (activeCategory === 'all' ? ' ' + styles.catBtnActive : '')}
              onClick={() => setActiveCategory('all')}
            >
              {tc('all')}
              <span className={styles.catCount}>{projects.length}</span>
            </button>
            {categoryTabs.map(cat => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
                className={styles.catBtn + (activeCategory === cat ? ' ' + styles.catBtnActive : '')}
                onClick={() => setActiveCategory(cat)}
              >
                {catLabel(cat)}
                <span className={styles.catCount}>{countIn(cat)}</span>
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
            <button type="button" className={styles.clearBtn} onClick={clearFilters}>{t('clearFilters')}</button>
          </div>
        ) : (
          <>
            {spotlight && <Spotlight project={spotlight} t={t} catLabel={catLabel} />}
            {active.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <span className={styles.dot} style={{ background: '#10b981' }} />
                  {t('activeSection')}
                  <span className={styles.sectionCount}>{active.length}</span>
                </div>
                <div className={styles.grid}>
                  {active.map((p, i) => <ProjectCard catLabel={catLabel} key={p.id} project={p} t={t} index={i} />)}
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
                  {archived.map((p, i) => <ProjectCard catLabel={catLabel} key={p.id} project={p} archived t={t} index={i} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
