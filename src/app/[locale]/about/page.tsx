'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './About.module.css';

/* ── Types ── */
interface LiveShaper {
  uid: string;
  displayName: string;
  role: string;
  bio?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

/* ── Hardcoded curatorship (leadership roles – always displayed) ── */
const CURATORSHIP = [
  {
    name: 'Mohammed Alshawi',
    role: 'curator',
    bio: 'Passionate about leveraging technology and community-driven initiatives to shape a more inclusive Jeddah. Leads the hub with a focus on collaboration and sustainable impact.',
    linkedin: 'https://linkedin.com/in/mohammed-alshawi',
    gradient: 'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  },
  {
    name: 'Dana Sayyadah',
    role: 'vice_curator',
    bio: "Creative strategist committed to youth empowerment and social innovation. Drives the hub's community partnerships and engagement programs across Jeddah.",
    linkedin: 'https://linkedin.com/in/dana-sayyadah',
    gradient: 'linear-gradient(135deg,#10b981,#34d399)',
  },
  {
    name: 'Jana Jambi',
    role: 'impact_officer',
    bio: "Dedicated to measuring and amplifying the hub's social impact. Coordinates initiatives that bridge local needs with global frameworks for meaningful, lasting change.",
    linkedin: 'https://linkedin.com/in/jana-jambi',
    gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
  },
];

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#e11d48,#fb7185)',
];

function avatarGradient(uid: string, index: number) {
  let hash = 0;
  for (const c of uid) hash = ((hash << 5) - hash) + c.charCodeAt(0);
  return AVATAR_GRADIENTS[Math.abs(hash || index) % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
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

function LiveShaperCard({ shaper, index }: { shaper: LiveShaper; index: number }) {
  const gradient = avatarGradient(shaper.uid, index);
  return (
    <div className={styles.shaperCard}>
      <div className={styles.shaperTop}>
        <div className={styles.shaperAvatarWrap}>
          <div className={styles.shaperAvatar} style={{ background: gradient }}>
            {initials(shaper.displayName)}
          </div>
        </div>
        <div className={styles.shaperMeta}>
          <h3 className={styles.shaperName}>{shaper.displayName}</h3>
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
      {shaper.bio && <p className={styles.shaperBio}>{shaper.bio}</p>}
    </div>
  );
}

export default function AboutPage() {
  const t  = useTranslations('AboutPage');
  const tr = useTranslations('Role');
  const tc = useTranslations('Common');

  const [shapers, setShapers]             = useState<LiveShaper[]>([]);
  const [loadingShapers, setLoadingShapers] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const shaperRoles = ['shaper', 'alumni'];
      const live = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter((u: any) => shaperRoles.includes(u.role) && u.displayName)
        .map((u: any): LiveShaper => ({
          uid:         u.uid,
          displayName: u.displayName,
          role:        u.role,
          bio:         u.bio         || '',
          linkedin:    u.linkedin    || '',
          twitter:     u.twitter     || '',
          instagram:   u.instagram   || '',
        }));
      setShapers(live);
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
      </section>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}><span className={styles.statNum}>37</span><span className={styles.statLabel}>{t('shapers')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>44</span><span className={styles.statLabel}>{t('statsInitiatives')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>100K+</span><span className={styles.statLabel}>{t('statsBenefited')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>30+</span><span className={styles.statLabel}>{t('statsPartners')}</span></div>
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

      {/* Current Curatorship */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('curatorship')}</h2>
          <div className={styles.divider} />
          <div className={styles.curatorshipGrid}>
            {CURATORSHIP.map((c) => (
              <div key={c.name} className={styles.curatorCard}>
                <div className={styles.curatorAvatarWrap}>
                  <div className={styles.curatorAvatar} style={{ background: c.gradient }}>
                    {initials(c.name)}
                  </div>
                </div>
                <div className={styles.curatorBody}>
                  <div className={styles.curatorName}>{c.name}</div>
                  <div className={styles.curatorRole}>{tr(c.role as Parameters<typeof tr>[0])}</div>
                  <p className={styles.curatorBio}>{c.bio}</p>
                  {c.linkedin && (
                    <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className={styles.curatorLinkedIn}>
                      <LinkedInIcon />
                      {tc('linkedIn')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shapers — live from Firestore */}
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
