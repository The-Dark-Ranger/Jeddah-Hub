'use client';

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

interface Initiative {
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

interface UserRecord {
  id: string;
  displayName?: string;
  displayNameAr?: string;
  photoURL?: string;
  role?: string;
}

export default function InitiativePage() {
  const { id: rawId } = useParams() as { id: string };
  // URLs read as "the-initiative-name" (see src/lib/slug.ts) — just the
  // name, no ID. Resolved by querying for a matching `slug` field first;
  // older initiatives saved before that field existed are found by
  // computing the same slug from their title on the fly, and even older
  // "name--docId" or bare-doc-ID links (from before this page had slugs
  // at all) still resolve and get redirected to the clean URL.
  const t      = useTranslations('ProjectsPage');
  const locale = useLocale();
  const router = useRouter();
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [users, setUsers]           = useState<UserRecord[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        let data: Initiative | null = null;

        const slugSnap = await getDocs(query(collection(db, 'initiatives'), where('slug', '==', rawId)));
        if (!slugSnap.empty) {
          const d = slugSnap.docs[0];
          data = { id: d.id, ...(d.data() as Omit<Initiative, 'id'>) };
        }

        if (!data) {
          // Hub Activities live in this same collection (tagged
          // type:'hub_activity') but have their own /activities/[id] page —
          // excluded here the same defensive way every other public list
          // does (absence of `type`, not a query filter, since Firestore's
          // `!=` would also exclude every real initiative that predates
          // the field existing at all).
          const allSnap = await getDocs(collection(db, 'initiatives'));
          const match = allSnap.docs.find(d => {
            const docData = d.data() as any;
            return !docData.type && slugify(docData.title || '') === rawId;
          });
          if (match) data = { id: match.id, ...(match.data() as Omit<Initiative, 'id'>) };
        }

        if (!data) {
          const legacyId = rawId.includes('--') ? rawId.slice(rawId.lastIndexOf('--') + 2) : rawId;
          const legacySnap = await getDoc(doc(db, 'initiatives', legacyId));
          if (legacySnap.exists()) data = { id: legacySnap.id, ...(legacySnap.data() as Omit<Initiative, 'id'>) };
        }

        if (data) {
          setInitiative(data);

          const canonical = data.slug || slugify(data.title);
          if (rawId !== canonical) router.replace(`/projects/${canonical}`);

          // Only fetch the specific member docs needed to resolve display
          // names, in chunks of 30 (Firestore 'in' query limit), from the
          // public_profiles mirror (no email field, see firestore.rules) —
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
  }, [rawId]);

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    if (!u) return null;
    return (locale === 'ar' && u.displayNameAr) ? u.displayNameAr : (u.displayName || null);
  };

  const getUserPhoto = (userId: string) => users.find(u => u.id === userId)?.photoURL || null;

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
  /* Cover image first, then the gallery photos, deduped — so the curator's
   * cover doubles as the faded hero backdrop without having to be re-added to
   * the photo list just to produce that effect. */
  const photos = [...new Set(
    [initiative.imageUrl, ...(initiative.images || [])].filter(Boolean),
  )] as string[];

  return (
    <main className={styles.page}>
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
                {initiative.category.toUpperCase()}
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
                {initiative.startDate && new Date(initiative.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {initiative.startDate && initiative.endDate && ' – '}
                {initiative.endDate && new Date(initiative.endDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('backToProjects')}
        </Link>

        <div className={styles.divider} />

        <div className={styles.sections}>
          {initiative.problem && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                {t('problem')}
              </h2>
              <p className={styles.sectionBody}>{initiative.problem}</p>
            </section>
          )}
          {initiative.objective && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                </span>
                {t('objective')}
              </h2>
              <p className={styles.sectionBody}>{initiative.objective}</p>
            </section>
          )}
          {initiative.impact && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon} style={{ color: heroColor }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </span>
                {t('impactTitle')}
              </h2>
              <p className={styles.sectionBody}>{initiative.impact}</p>
            </section>
          )}
          {!initiative.problem && !initiative.objective && !initiative.impact && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>{t('objective')}</h2>
              <p className={styles.sectionBody}>{initiative.description}</p>
            </section>
          )}
        </div>

        {photos.length > 0 && (
          <>
            <div className={styles.divider} />
            <InitiativeGallery photos={photos} title={initiative.title} accent={heroColor} />
          </>
        )}

        {initiative.impactAreas && initiative.impactAreas.length > 0 && (
          <>
            <div className={styles.divider} />
            <section className={styles.impactAreas}>
              <h3 className={styles.impactAreasTitle}>{t('impactAreas')}</h3>
              <div className={styles.impactAreaTags}>
                {initiative.impactAreas.map((area, i) => (
                  <span
                    key={area}
                    className={styles.impactAreaTag}
                    style={i === 0 ? { color: heroColor, background: heroColor + '18', borderColor: heroColor + '44' } : undefined}
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}

        {Array.isArray(initiative.members) && initiative.members.length > 0 && (
          <>
            <div className={styles.divider} />
            <section className={styles.teamSection}>
              <h3 className={styles.impactAreasTitle}>{t('teamMembers')}</h3>
              <div className={styles.teamGrid}>
                {[...initiative.members]
                  .sort((a, b) => {
                    const aLead = initiative.leads?.includes(a.userId) ? 0 : 1;
                    const bLead = initiative.leads?.includes(b.userId) ? 0 : 1;
                    return aLead - bLead;
                  })
                  .map((m, i) => {
                  const name = getUserName(m.userId) ?? m.userId;
                  const photo = getUserPhoto(m.userId);
                  return (
                    <div key={m.userId + i} className={styles.teamCard}>
                      {photo ? (
                        <img className={styles.teamAvatarImg} src={photo} alt="" />
                      ) : (
                        <div className={styles.teamAvatar} style={{ background: heroColor + '22', color: heroColor }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className={styles.teamInfo}>
                        <span className={styles.teamName}>{name}</span>
                        {m.role && <span className={styles.teamRole}>{m.role}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
