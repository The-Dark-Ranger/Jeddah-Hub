'use client';

/* An initiative's page: story, key facts, impact, gallery, team and more
 * initiatives. */
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Initiative.module.css';
import InitiativeGallery from '@/components/InitiativeGallery';
import { PLACEHOLDER_PROJECTS, CATEGORY_COLORS } from '@/lib/placeholderProjects';
import { slugify } from '@/lib/slug';
import { useCategoryLabel } from '@/lib/categoryLabel';

/** The initiative's story, in reading order. */
const STORY = [
  { key: 'problem',   label: 'problem',     icon: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01' },
  { key: 'objective', label: 'objective',   icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
  { key: 'impact',    label: 'impactTitle', icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' },
] as const;

export interface Initiative {
  id: string;
  title: string;
  titleAr?: string;
  description: string;
  descriptionAr?: string;
  category?: string;
  status?: string;
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  imageUrl?: string;
  images?: string[];
  members?: { userId: string; role?: string }[];
  leads?: string[];
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  slug?: string;
}

export interface UserRecord {
  id: string;
  displayName?: string;
  displayNameAr?: string;
  photoURL?: string;
  role?: string;
}

/** What the page shows, loaded on the server (page.tsx). `initiative` is
 *  null when no initiative matches the URL. */
export interface InitiativeData {
  initiative: Initiative | null;
  related: Initiative[];
  users: UserRecord[];
}

const placeholderFor = (id: string) => (PLACEHOLDER_PROJECTS.find(p => p.id === id) as Initiative | undefined) ?? null;

/** `initial`: data loaded on the server; when absent it is fetched in the
 *  browser instead. */
export default function ProjectClient({ initial }: { initial?: InitiativeData }) {
  const { id: rawId } = useParams() as { id: string };
  // URLs read as "the-initiative-name" (see src/lib/slug.ts), just the
  // name, no ID. Resolved by querying for a matching `slug` field first;
  // older initiatives saved before that field existed are found by
  // computing the same slug from their title on the fly, and even older
  // "name--docId" or bare-doc-ID links (from before this page had slugs
  // at all) still resolve and get redirected to the clean URL.
  const t      = useTranslations('ProjectsPage');
  const locale = useLocale();
  const router = useRouter();
  const [initiative, setInitiative] = useState<Initiative | null>(() =>
    initial ? (initial.initiative ?? placeholderFor(rawId)) : null);
  const [users, setUsers]           = useState<UserRecord[]>(initial?.users ?? []);
  const [loading, setLoading]       = useState(!initial);
  const [related, setRelated]       = useState<Initiative[]>(initial?.related ?? []);
  const [copied, setCopied]         = useState(false);
  // Captured once so the timeline doesn't shift between re-renders.
  const [now] = useState(() => Date.now());
  const catLabel = useCategoryLabel();

  useEffect(() => {
    if (initial) {
      // Old "name--docId" / bare-id / title-only links: switch to the clean URL.
      const found = initial.initiative;
      if (found) {
        const canonical = found.slug || slugify(found.title);
        if (rawId !== canonical) router.replace(`/projects/${canonical}`);
      }
      return;
    }
    const load = async () => {
      try {
        let data: Initiative | null = null;

        // Hub Activities live in this same collection (tagged
        // type:'hub_activity') but have their own /activities/[id] page,
        // excluded from every lookup below the same defensive way the
        // public listing does (absence of `type`, not a query filter,
        // since Firestore's `!=` would also exclude every real initiative
        // that predates the field existing at all). Without this guard, an
        // activity whose slug/title happens to be requested here would
        // render as an initiative, showing its description under
        // "Objective" since activities have no problem/objective/impact
        // fields of their own.
        const slugSnap = await getDocs(query(collection(db, 'initiatives'), where('slug', '==', rawId)));
        if (!slugSnap.empty) {
          const d = slugSnap.docs.find(d => !d.data().type);
          if (d) data = { id: d.id, ...(d.data() as Omit<Initiative, 'id'>) };
        }

        if (!data) {
          const allSnap = await getDocs(collection(db, 'initiatives'));
          const match = allSnap.docs.find(d => {
            const docData = d.data();
            return !docData.type && slugify(String(docData.title || '')) === rawId;
          });
          if (match) data = { id: match.id, ...(match.data() as Omit<Initiative, 'id'>) };
        }

        if (!data) {
          const legacyId = rawId.includes('--') ? rawId.slice(rawId.lastIndexOf('--') + 2) : rawId;
          const legacySnap = await getDoc(doc(db, 'initiatives', legacyId));
          if (legacySnap.exists() && !legacySnap.data().type) {
            data = { id: legacySnap.id, ...(legacySnap.data() as Omit<Initiative, 'id'>) };
          }
        }

        if (data) {
          setInitiative(data);

          // "More initiatives": same category first, then the most recent others.
          const current = data;
          getDocs(collection(db, 'initiatives')).then(snap => {
            const others = snap.docs
              .map(d => ({ id: d.id, ...(d.data() as Omit<Initiative, 'id'>) }))
              .filter(o => !(o as { type?: string }).type && o.id !== current.id);
            others.sort((x, y) =>
              Number(y.category === current.category) - Number(x.category === current.category)
              || Number(y.status !== 'archived') - Number(x.status !== 'archived'));
            setRelated(others.slice(0, 3));
          }).catch(() => {});

          const canonical = data.slug || slugify(data.title);
          if (rawId !== canonical) router.replace(`/projects/${canonical}`);

          // Only fetch the specific member docs needed to resolve display
          // names, in chunks of 30 (Firestore 'in' query limit), from the
          // public_profiles mirror (no email field, see firestore.rules),
          // this is a public page, so the private `users` collection isn't
          // readable here anyway.
          const memberIds = Array.from(new Set((data.members || []).map(m => m.userId).filter(Boolean)));
          if (memberIds.length > 0) {
            const chunks: string[][] = [];
            for (let i = 0; i < memberIds.length; i += 30) chunks.push(memberIds.slice(i, i + 30));
            const snaps = await Promise.all(
              chunks.map(chunk => getDocs(query(collection(db, 'public_profiles'), where(documentId(), 'in', chunk))))
            );
            setUsers(snaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord))));
          }
        } else {
          setInitiative(PLACEHOLDER_PROJECTS.find(p => p.id === rawId) as Initiative ?? null);
        }
      } catch {
        setInitiative(PLACEHOLDER_PROJECTS.find(p => p.id === rawId) as Initiative ?? null);
      }
      setLoading(false);
    };
    load();
  }, [rawId, initial, router]);

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    if (!u) return null;
    return (locale === 'ar' && u.displayNameAr) ? u.displayNameAr : (u.displayName || null);
  };

  const getUserPhoto = (userId: string) => users.find(u => u.id === userId)?.photoURL || null;

  const dateLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
  const fmtMonth = (d: Date) => d.toLocaleDateString(dateLocale, { month: 'short', year: 'numeric' });
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner} /></div>;

  if (!initiative) return (
    <div className={styles.notFound}>
      <h2>{t('notFound')}</h2>
      <Link href="/projects" className={styles.backLink}>{t('backToProjects')}</Link>
    </div>
  );

  const isActive = !initiative.status || initiative.status === 'active';
  const title = locale === 'ar' && initiative.titleAr ? initiative.titleAr : initiative.title;
  const description = locale === 'ar' && initiative.descriptionAr ? initiative.descriptionAr : initiative.description;
  const categoryColor = CATEGORY_COLORS[initiative.category ?? ''] ?? CATEGORY_COLORS.Default;
  const heroColor = initiative.color || categoryColor;
  /* Cover image first, then the gallery photos, deduped, so the curator's
   * cover doubles as the faded hero backdrop without having to be re-added to
   * the photo list just to produce that effect. */
  const photos = [...new Set(
    [initiative.imageUrl, ...(initiative.images || [])].filter(Boolean),
  )] as string[];
  /* The gallery grid below shows the extra photos, not the cover again,
   * it's already the hero backdrop just above, so repeating it there would
   * just be the same picture shown twice in a row. */
  const galleryPhotos = [...new Set((initiative.images || []).filter(Boolean))] as string[];

  // Timeline: how far between start and end we are today (null if open-ended).
  const validDate = (v?: string) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; };
  const start = validDate(initiative.startDate);
  const end = validDate(initiative.endDate);
  const progress = start && end && end > start
    ? Math.min(1, Math.max(0, (now - start.getTime()) / (end.getTime() - start.getTime())))
    : null;

  return (
    <main className={styles.page} style={{ '--hero-color': heroColor } as React.CSSProperties}>
      {/* Hero banner */}
      <div
        className={styles.hero}
        style={{ '--hero-color': heroColor } as React.CSSProperties}
      >
        {photos.length > 0 && (
          <div
            className={styles.heroImage}
            style={{ backgroundImage: `url(${photos[0]})` }}
          />
        )}
        <div className={styles.heroOrb} />
        <div className={styles.heroInner}>
          <div className={styles.heroBadges}>
            {initiative.category && (
              <span className={styles.heroCategoryTag} style={{ color: heroColor, background: heroColor + '22' }}>
                {catLabel(initiative.category).toLocaleUpperCase(locale)}
              </span>
            )}
            {initiative.status && (
              <span className={styles.statusBadge + ' ' + (isActive ? styles.statusActive : styles.statusArchived)}>
                {isActive ? t('activeStatus') : t('archiveStatus')}
              </span>
            )}
          </div>
          <h1 className={styles.heroTitle}>{title}</h1>
          <p className={styles.heroDescription}>{description}</p>

          <div className={styles.heroMeta}>
            {initiative.stat && (
              <div className={styles.statCallout} style={{ borderColor: heroColor + '55' }}>
                <span className={styles.statValue} style={{ color: heroColor }}>{initiative.stat}</span>
                <span className={styles.statLabel}>{t('keyResult')}</span>
              </div>
            )}
            {(initiative.startDate || initiative.endDate) && (
              <div className={styles.datePill}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {initiative.startDate && new Date(initiative.startDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
                {initiative.startDate && initiative.endDate && ' – '}
                {initiative.endDate && new Date(initiative.endDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' })}
              </div>
            )}
            {Array.isArray(initiative.members) && initiative.members.length > 0 && (
              <div className={styles.memberCount}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {initiative.members.length} {t('shapers')}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.container}>
        <Link href="/projects" className={styles.back}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('backToProjects')}
        </Link>

        <div className={styles.layout}>
          {/* ── The story: challenge → goal → impact ── */}
          <div className={styles.mainCol}>
            <h2 className={styles.storyHeading}>{t('storyTitle')}</h2>
            <ol className={styles.story}>
              {STORY.map(({ key, label, icon }) => {
                // With no structured story at all, the description stands in as the goal.
                const bare = !initiative.problem && !initiative.objective && !initiative.impact;
                const text = initiative[key] || (bare && key === 'objective' ? initiative.description : '');
                if (!text) return null;
                return (
                  <li key={key} className={styles.storyStep}>
                    <span className={styles.storyIcon} aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                    </span>
                    <div className={styles.storyBody}>
                      <h3 className={styles.storyLabel}>{t(label)}</h3>
                      <p className={styles.sectionBody}>{text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {galleryPhotos.length > 0 && (
              <section className={styles.block}>
                <h2 className={styles.blockTitle}>{t('galleryTitle')}</h2>
                <InitiativeGallery photos={galleryPhotos} title={initiative.title} accent={heroColor} />
              </section>
            )}

            {Array.isArray(initiative.members) && initiative.members.length > 0 && (
              <section className={styles.block}>
                <h2 className={styles.blockTitle}>{t('teamMembers')}</h2>
                <div className={styles.teamGrid}>
                  {[...initiative.members]
                    .sort((a, b) => {
                      const aLead = initiative.leads?.includes(a.userId) ? 0 : 1;
                      const bLead = initiative.leads?.includes(b.userId) ? 0 : 1;
                      return aLead - bLead;
                    })
                    .map((m, i) => {
                      const name = getUserName(m.userId) ?? t('shaperFallback');
                      const photo = getUserPhoto(m.userId);
                      const isLead = initiative.leads?.includes(m.userId);
                      return (
                        <div key={m.userId + i} className={styles.teamCard}>
                          {photo ? (
                            <img className={styles.teamAvatarImg} src={photo} alt="" loading="lazy" />
                          ) : (
                            <div className={styles.teamAvatar} style={{ background: heroColor + '22', color: heroColor }}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className={styles.teamInfo}>
                            <span className={styles.teamName}>{name}</span>
                            {(isLead || m.role) && <span className={styles.teamRole}>{isLead ? t('leadBadge') : m.role}</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}
          </div>

          {/* ── Key facts ── */}
          <aside className={styles.sideCol}>
            <div className={styles.factsCard} style={{ '--hero-color': heroColor } as React.CSSProperties}>
              <h2 className={styles.factsTitle}>{t('keyFacts')}</h2>
              <dl className={styles.factsList}>
                <div className={styles.factRow}>
                  <dt>{t('factStatus')}</dt>
                  <dd>
                    <span className={styles.factDot + (isActive ? ' ' + styles.factDotActive : '')} aria-hidden="true" />
                    {isActive ? t('activeStatus') : t('archiveStatus')}
                  </dd>
                </div>
                {initiative.category && (
                  <div className={styles.factRow}>
                    <dt>{t('factCategory')}</dt>
                    <dd>{catLabel(initiative.category)}</dd>
                  </div>
                )}
                {Array.isArray(initiative.members) && initiative.members.length > 0 && (
                  <div className={styles.factRow}>
                    <dt>{t('factTeam')}</dt>
                    <dd>{t('shapersCount', { count: initiative.members.length })}</dd>
                  </div>
                )}
                {initiative.stat && (
                  <div className={styles.factRow + ' ' + styles.factHighlight}>
                    <dt>{t('keyResult')}</dt>
                    <dd>{initiative.stat}</dd>
                  </div>
                )}
              </dl>

              {start && (
                <div className={styles.timeline}>
                  <div className={styles.timelineHead}>
                    <span>{t('factTimeline')}</span>
                    {progress !== null && <span>{t('percentComplete', { pct: Math.round(progress * 100) })}</span>}
                  </div>
                  <div className={styles.timelineTrack}>
                    <span className={styles.timelineFill} style={{ width: `${Math.round((progress ?? (isActive ? 0.5 : 1)) * 100)}%` }} />
                  </div>
                  <div className={styles.timelineDates}>
                    <span>{fmtMonth(start)}</span>
                    <span>{end ? fmtMonth(end) : t('ongoing')}</span>
                  </div>
                </div>
              )}

              {initiative.impactAreas && initiative.impactAreas.length > 0 && (
                <div className={styles.factsAreas}>
                  <span className={styles.factsAreasTitle}>{t('impactAreas')}</span>
                  <div className={styles.impactAreaTags}>
                    {initiative.impactAreas.map(area => (
                      <span key={area} className={styles.impactAreaTag}>{area}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.factsActions}>
                <button type="button" className={styles.copyBtn} onClick={copyLink}>
                  {copied ? t('linkCopied') : t('shareInitiative')}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className={styles.related}>
            <div className={styles.relatedHead}>
              <h2 className={styles.blockTitle}>{t('moreInitiatives')}</h2>
              <Link href="/projects" className={styles.relatedAll}>{t('viewAllInitiatives')}</Link>
            </div>
            <div className={styles.relatedGrid}>
              {related.map(r => {
                const rColor = r.color || CATEGORY_COLORS[r.category ?? ''] || CATEGORY_COLORS.Default;
                const rTitle = locale === 'ar' && r.titleAr ? r.titleAr : r.title;
                const cover = r.imageUrl || r.images?.[0];
                return (
                  <Link key={r.id} href={'/projects/' + (r.slug || slugify(r.title))} className={styles.relatedCard}>
                    {cover
                      ? <img src={cover} alt="" className={styles.relatedImg} loading="lazy" />
                      : <span className={styles.relatedImg} style={{ background: `linear-gradient(135deg, ${rColor}, ${rColor}88)` }} />}
                    <span className={styles.relatedBody}>
                      {r.category && <span className={styles.relatedCat} style={{ color: rColor }}>{catLabel(r.category)}</span>}
                      <span className={styles.relatedName}>{rTitle}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
