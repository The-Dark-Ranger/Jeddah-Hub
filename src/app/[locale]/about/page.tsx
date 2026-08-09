'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, getCountFromServer, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './About.module.css';
import WaveDivider from '@/components/WaveDivider';
import { AVATAR_GRADIENTS, avatarGradient, initials } from '@/lib/avatarUtils';
import { COMMUNITY_BENEFITED_STAT, COMMUNITY_PARTNERS_STAT } from '@/lib/siteStats';

/* ── Types ── */
interface LiveShaper {
  uid: string;
  displayName: string;
  displayNameAr?: string;
  role: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  photoURL?: string;
}

interface LiveCurator {
  uid: string;
  displayName: string;
  displayNameAr?: string;
  role: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  photoURL?: string;
}


const LinkedInIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

// Long enough that a 3-line clamp at the card's font/width would visibly
// cut it off — short of that, there's nothing to expand.
const BIO_CLAMP_THRESHOLD = 140;

function LiveShaperCard({ shaper, index }: { shaper: LiveShaper; index: number }) {
  const gradient = avatarGradient(shaper.uid, index);
  const locale   = useLocale();
  const t        = useTranslations('AboutPage');
  const name     = locale === 'ar' && shaper.displayNameAr ? shaper.displayNameAr : shaper.displayName;
  const [expanded, setExpanded] = useState(false);
  const isLong = (shaper.bio?.length ?? 0) > BIO_CLAMP_THRESHOLD;
  return (
    <div className={styles.shaperCard}>
      <div className={styles.shaperTop}>
        <div className={styles.shaperAvatarWrap}>
          {shaper.photoURL
            ? <img src={shaper.photoURL} alt={name} className={styles.shaperAvatarImg}
                loading="lazy" decoding="async"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <div className={styles.shaperAvatar} style={{ background: gradient }}>
                {initials(name)}
              </div>
          }
        </div>
        <div className={styles.shaperMeta}>
          <h3 className={styles.shaperName}>{name}</h3>
          <div className={styles.shaperActions}>
            {shaper.linkedin && (
              <a href={shaper.linkedin} target="_blank" rel="noopener noreferrer"
                className={styles.shaperIconLink} aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            )}
            {shaper.twitter && (
              <a href={shaper.twitter} target="_blank" rel="noopener noreferrer"
                className={styles.shaperIconLink} aria-label="X / Twitter">
                <TwitterIcon />
              </a>
            )}
            {shaper.instagram && (
              <a href={shaper.instagram} target="_blank" rel="noopener noreferrer"
                className={styles.shaperIconLink} aria-label="Instagram">
                <InstagramIcon />
              </a>
            )}
          </div>
        </div>
      </div>
      {shaper.bio && (
        <>
          <p className={styles.shaperBio + (isLong && !expanded ? ' ' + styles.shaperBioClamped : '')}>
            {shaper.bio}
          </p>
          {isLong && (
            <button type="button" className={styles.shaperBioToggle} onClick={() => setExpanded(v => !v)}>
              {expanded ? t('readLessBio') : t('readMoreBio')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function LiveCuratorCard({ curator, index, roleLabel }: { curator: LiveCurator; index: number; roleLabel: string }) {
  const gradient = avatarGradient(curator.uid, index);
  const locale = useLocale();
  const name   = locale === 'ar' && curator.displayNameAr ? curator.displayNameAr : curator.displayName;
  const hasSocials = curator.linkedin || curator.twitter || curator.instagram;
  return (
    <div className={styles.curatorCard}>
      <div className={styles.curatorAvatarWrap}>
        {curator.photoURL
          ? <img src={curator.photoURL} alt={name} className={styles.curatorAvatarImg}
              loading="lazy" decoding="async"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          : <div className={styles.curatorAvatar} style={{ background: gradient }}>
              {initials(name)}
            </div>
        }
      </div>
      <div className={styles.curatorBody}>
        <div className={styles.curatorName}>{name}</div>
        <div className={styles.curatorRole}>{roleLabel}</div>
        {curator.bio && <p className={styles.curatorBio}>{curator.bio}</p>}
        {hasSocials && (
          <div className={styles.curatorSocials}>
            {curator.linkedin && (
              <a href={curator.linkedin} target="_blank" rel="noopener noreferrer"
                className={styles.curatorIconLink} aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            )}
            {curator.twitter && (
              <a href={curator.twitter} target="_blank" rel="noopener noreferrer"
                className={styles.curatorIconLink} aria-label="X / Twitter">
                <TwitterIcon />
              </a>
            )}
            {curator.instagram && (
              <a href={curator.instagram} target="_blank" rel="noopener noreferrer"
                className={styles.curatorIconLink} aria-label="Instagram">
                <InstagramIcon />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const ROLE_ORDER: Record<string, number> = { curator: 0, vice_curator: 1, impact_officer: 2 };

export default function AboutPage() {
  const t  = useTranslations('AboutPage');
  const tr = useTranslations('Role');

  const [shapers, setShapers]                 = useState<LiveShaper[]>([]);
  const [alumni, setAlumni]                   = useState<LiveShaper[]>([]);
  const [curators, setCurators]               = useState<LiveCurator[]>([]);
  const [shaperStatCount, setShaperStatCount] = useState(0);
  const [initiativeCount, setInitiativeCount] = useState<number | null>(null);
  const [loadingShapers, setLoadingShapers]   = useState(true);

  useEffect(() => {
    // Firestore 'in' matching is exact-string, so this has to enumerate
    // every casing/spacing variant the app has ever written to `role`
    // (Firestore rules' isCurator()/isImpactOfficer() already tolerate
    // both "vice_curator"/"vice curator" and "impact_officer"/"impact
    // officer") — otherwise a vice curator or impact officer whose role
    // happens to be stored in one of those variants would be silently
    // excluded from this query before it ever reaches the client.
    const roleVariants = [
      'shaper', 'alumni', 'curator',
      'vice_curator', 'vice curator',
      'impact_officer', 'impact officer',
    ];
    // Public page — reads the public_profiles mirror (no email field, see
    // firestore.rules) rather than the private `users` collection, scoped
    // to roles actually displayed here, and uses a server-side count
    // instead of downloading every initiative doc just to show a number.
    Promise.all([
      getDocs(query(collection(db, 'public_profiles'), where('role', 'in', roleVariants))),
      getCountFromServer(collection(db, 'initiatives')),
      // Hub Activities (dashboard/curator/activities) are stored as
      // initiatives docs tagged type:'hub_activity' — they aren't real
      // initiatives, so subtract them from the total instead of counting
      // them here.
      getCountFromServer(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity'))),
    ]).then(([usersSnap, initCount, activityCount]) => {
      const all = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as any));
      // Normalize once so "Vice Curator"/"vice curator"/"vice_curator" etc.
      // all match the same downstream role checks.
      const normRole = (r: any) => (typeof r === 'string' ? r.toLowerCase().replace(/\s+/g, '_') : '');

      const toShaper = (u: any): LiveShaper => ({
        uid:           u.uid,
        displayName:   u.displayName,
        displayNameAr: u.displayNameAr || '',
        role:          normRole(u.role),
        bio:           u.bio          || '',
        linkedin:      u.linkedin     || '',
        twitter:       u.twitter      || '',
        instagram:     u.instagram    || '',
        photoURL:      u.photoURL     || '',
      });

      const live = all
        .filter((u: any) => normRole(u.role) === 'shaper' && u.displayName)
        .map(toShaper);

      const liveAlumni = all
        .filter((u: any) => normRole(u.role) === 'alumni' && u.displayName)
        .map(toShaper);

      const curatorRoles = ['curator', 'vice_curator', 'impact_officer'];
      const curs = all
        .filter((u: any) => curatorRoles.includes(normRole(u.role)) && u.displayName)
        .map((u: any): LiveCurator => ({
          uid:           u.uid,
          displayName:   u.displayName,
          displayNameAr: u.displayNameAr || '',
          role:          normRole(u.role),
          bio:           u.bio         || '',
          linkedin:      u.linkedin    || '',
          twitter:       u.twitter     || '',
          instagram:     u.instagram   || '',
          photoURL:      u.photoURL    || '',
        }))
        .sort((a: LiveCurator, b: LiveCurator) =>
          (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
        );

      setShapers(live);
      setAlumni(liveAlumni);
      setCurators(curs);
      setShaperStatCount(live.length + curs.length);
      setInitiativeCount(initCount.data().count - activityCount.data().count);
      setLoadingShapers(false);
    }).catch(() => setLoadingShapers(false));
  }, []);

  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOrb} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{t('eyebrow')}</p>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.description}>{t('description')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.heroWave} />
      </section>


      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>
            {loadingShapers ? '...' : shaperStatCount}
          </span>
          <span className={styles.statLabel}>{t('shapers')}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statNum}>
            {initiativeCount !== null ? initiativeCount : '44'}
          </span>
          <span className={styles.statLabel}>{t('statsInitiatives')}</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>{COMMUNITY_BENEFITED_STAT}</span><span className={styles.statLabel}>{t('statsBenefited')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>{COMMUNITY_PARTNERS_STAT}</span><span className={styles.statLabel}>{t('statsPartners')}</span></div>
      </div>

      {/* Mission */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('mission')}</h2>
          <div className={styles.divider} />
          <div className={styles.missionGrid}>
            {[
              { titleKey: 'missionGlobalTitle',   bodyKey: 'missionGlobalBody' },
              { titleKey: 'missionLocalTitle',    bodyKey: 'missionLocalBody' },
              { titleKey: 'missionYouthTitle',    bodyKey: 'missionYouthBody' },
              { titleKey: 'missionDialogueTitle', bodyKey: 'missionDialogueBody' },
            ].map(m => (
              <div key={m.titleKey} className={styles.missionCard}>
                <h3>{t(m.titleKey as Parameters<typeof t>[0])}</h3>
                <p>{t(m.bodyKey as Parameters<typeof t>[0])}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Current Curatorship (dynamic from Firestore */}
      {curators.length > 0 && (
        <section className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>{t('curatorship')}</h2>
            <div className={styles.divider} />
            <div className={styles.curatorshipGrid}>
              {curators.map((c, i) => (
                <LiveCuratorCard
                  key={c.uid}
                  curator={c}
                  index={i}
                  roleLabel={tr(c.role as Parameters<typeof tr>[0])}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shapers (live from Firestore */}
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('shapers')}</h2>
          <p className={styles.sectionSubtitle}>{t('shapersSubtitle')}</p>
          <div className={styles.divider} />
          {loadingShapers ? (
            <div className={styles.shapersLoading}>
              <div className={styles.shapersSpinner} />
            </div>
          ) : shapers.length === 0 ? (
            <p className={styles.noShapers}>{t('noShapers')}</p>
          ) : (
            <div className={styles.shapersList}>
              {shapers.map((s, i) => (
                <LiveShaperCard key={s.uid} shaper={s} index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Alumni */}
      {(loadingShapers || alumni.length > 0) && (
        <section className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>{t('alumni')}</h2>
            <p className={styles.sectionSubtitle}>{t('alumniSubtitle')}</p>
            <div className={styles.divider} />
            {loadingShapers ? (
              <div className={styles.shapersLoading}><div className={styles.shapersSpinner} /></div>
            ) : alumni.length === 0 ? (
              <p className={styles.noShapers}>{t('noAlumni')}</p>
            ) : (
              <div className={styles.shapersList}>
                {alumni.map((s, i) => <LiveShaperCard key={s.uid} shaper={s} index={i} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* WEF Context */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.wefSection}>
            <div className={styles.wefText}>
              <h2 className={styles.sectionTitle}>{t('wefTitle')}</h2>
              <div className={styles.divider} style={{ margin: '1rem 0 1.5rem' }} />
              <p className={styles.wefBody}>{t('wefDesc')}</p>
            </div>
            <div className={styles.wefStats}>
              <div className={styles.wefStat}><span>500+</span><p>{t('wefCities')}</p></div>
              <div className={styles.wefStat}><span>10K+</span><p>{t('wefShapers')}</p></div>
              <div className={styles.wefStat}><span>10+</span><p>{t('wefYears')}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.cta}>
            <h2>{t('ctaTitle')}</h2>
            <p>{t('ctaDesc')}</p>
            <div className={styles.ctaButtons}>
              <Link href="/become-a-shaper" className={styles.ctaBtn}>{t('ctaApply')}</Link>
              <Link href="/projects" className={styles.ctaSecondary}>{t('ctaProjects')} &rarr;</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
