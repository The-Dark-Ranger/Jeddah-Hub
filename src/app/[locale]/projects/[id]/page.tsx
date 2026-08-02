'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Initiative.module.css';
import InitiativeGallery from '@/components/InitiativeGallery';
import { PLACEHOLDER_PROJECTS, CATEGORY_COLORS } from '@/lib/placeholderProjects';

interface Initiative {
  id: string;
  title: string;
  description: string;
  category?: string;
  status?: string;
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  images?: string[];
  members?: { userId: string; role?: string }[];
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
}

interface UserRecord {
  id: string;
  displayName?: string;
  displayNameAr?: string;
  photoURL?: string;
  role?: string;
}

export default function InitiativePage() {
  const { id } = useParams() as { id: string };
  const t      = useTranslations('ProjectsPage');
  const locale = useLocale();
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [users, setUsers]           = useState<UserRecord[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [snap, usersSnap] = await Promise.all([
          getDoc(doc(db, 'initiatives', id)),
          getDocs(collection(db, 'users')),
        ]);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord)));
        if (snap.exists()) {
          setInitiative({ id: snap.id, ...snap.data() } as Initiative);
        } else {
          setInitiative(PLACEHOLDER_PROJECTS.find(p => p.id === id) as Initiative ?? null);
        }
      } catch {
        setInitiative(PLACEHOLDER_PROJECTS.find(p => p.id === id) as Initiative ?? null);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    if (!u) return null;
    return (locale === 'ar' && u.displayNameAr) ? u.displayNameAr : (u.displayName || null);
  };

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner} /></div>;

  if (!initiative) return (
    <div className={styles.notFound}>
      <h2>{t('notFound')}</h2>
      <Link href="/projects" className={styles.backLink}>{t('backToProjects')}</Link>
    </div>
  );

  const isActive = !initiative.status || initiative.status === 'active';
  const categoryColor = CATEGORY_COLORS[initiative.category ?? ''] ?? CATEGORY_COLORS.Default;
  const heroColor = initiative.color || categoryColor;
  const photos = (initiative.images || []).filter(Boolean);

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
          <h1 className={styles.heroTitle}>{initiative.title}</h1>
          <p className={styles.heroDescription}>{initiative.description}</p>

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
                {initiative.members.map((m, i) => {
                  const name = getUserName(m.userId) ?? m.userId;
                  return (
                    <div key={m.userId + i} className={styles.teamCard}>
                      <div className={styles.teamAvatar} style={{ background: heroColor + '22', color: heroColor }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
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
