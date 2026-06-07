import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './Home.module.css';
import NewsletterForm from '@/components/NewsletterForm';

// Shaper names shown in the home-page team preview (first 10 are displayed).
// Full bios live in src/app/[locale]/about/page.tsx → SHAPERS array.
const MEMBERS = [
  'Abdulaziz Alahmadi','Hanin Aljifri','Ammar Koshak','Aseel Basnawi',
  'Hashem Hashem','Haya Haddad','Masarah Hussain','Riyadh Alshehri',
  'Suhaib Darweesh','Dana Sayyadah','Jana Jambi','Toleen Attar',
  'Nagy ElSokkary','Toulin Tabbash','Faisal Aldaheri','Jodie Alsasi',
  'Musaad Aljafari','Shahad Alattas','Mohammed Al Nahari','Samar Alzanbaqi',
];

// Retreat venue cards shown inside the dark Retreat section.
// Each entry: name (displayed large) + tag (small descriptor below).
const RETREAT_VENUES = [
  { name: 'Al-Balad',       tag: 'Heritage District' },
  { name: 'teamLab',        tag: 'Immersive Art' },
  { name: 'Marbat Dhaban',  tag: 'Coastal Experience' },
  { name: 'Corniche',       tag: 'Waterfront' },
  { name: 'Red Sea Museum', tag: 'Museum' },
  { name: 'Taibat Alhijaz', tag: 'Restaurant' },
];

const PROJECT_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
];

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
];

// Active partners — update this list to add/remove partner badges on the home page
const PARTNERS = [
  'SHADA Hotel',
  'Zawiya 97',
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('');
}

export default function HomePage() {
  const t   = useTranslations('HomePage');
  const nav = useTranslations('Navigation');

  const PILLARS = [
    { title: t('pillar1Title'), body: t('pillar1Body') },
    { title: t('pillar2Title'), body: t('pillar2Body') },
    { title: t('pillar3Title'), body: t('pillar3Body') },
  ];

  return (
    <main className={styles.main}>

      {/* 1. Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOrb1} />
        <div className={styles.heroOrb2} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow + ' ' + styles.fadeInUp}>
            {t('eyebrow')}
          </p>
          <h1 className={styles.title + ' ' + styles.fadeInUp + ' ' + styles.delay1}>
            {t('title')}
          </h1>
          <p className={styles.subtitle + ' ' + styles.fadeInUp + ' ' + styles.delay2}>
            {t('subtitle')}
          </p>
          <div className={styles.heroButtons + ' ' + styles.fadeInUp + ' ' + styles.delay3}>
            <Link href="/become-a-shaper" className={styles.ctaButton}>{t('joinUs')}</Link>
            <Link href="/projects" className={styles.secondaryButton}>{t('exploreProjects')}</Link>
          </div>
          <div className={styles.heroStats + ' ' + styles.fadeInUp + ' ' + styles.delay3}>
            <div className={styles.heroStat}><span>37</span> {t('metrics.shapers')}</div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}><span>44</span> {t('metrics.projects')}</div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}><span>30+</span> {t('metrics.partners')}</div>
          </div>
        </div>
      </section>

      {/* 2. About */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{nav('about')}</h2>
            <div className={styles.sectionDivider} />
          </div>
          <p className={styles.aboutText}>{t('aboutHub')}</p>
          <div className={styles.aboutPillars}>
            {PILLARS.map(p => (
              <div key={p.title} className={styles.pillar}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Impact metrics */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('impact')}</h2>
            <p className={styles.sectionSubtitle}>{t('impactSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.impactGrid}>
            {[
              { num: '100K+', label: t('benefited') },
              { num: '44',    label: t('metrics.projects') },
              { num: '37',    label: t('metrics.shapers') },
              { num: '30+',   label: t('metrics.partners') },
            ].map(({ num, label }) => (
              <div key={label} className={styles.impactCard}>
                <div className={styles.impactNumber}>{num}</div>
                <div className={styles.impactLabel}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Retreat */}
      <section className={styles.retreatSection}>
        <div className={styles.container}>
          <div className={styles.retreatInner}>
            <div className={styles.retreatText}>
              <h2 className={styles.retreatTitle}>{t('retreat')}</h2>
              <p className={styles.retreatSubtitle}>{t('retreatSubtitle')}</p>
              <p className={styles.retreatDesc}>{t('retreatDesc')}</p>
              <div className={styles.retreatMeta}>
                <span className={styles.retreatMetaItem}>{t('retreatDate')}</span>
                <span className={styles.retreatMetaDot} />
                <span className={styles.retreatMetaItem}>{t('retreatLocation')}</span>
                <span className={styles.retreatMetaDot} />
                <span className={styles.retreatMetaItem}>{t('retreatVenues')}</span>
              </div>
              <a href="https://jeddahretreat.com" target="_blank" rel="noopener noreferrer" className={styles.retreatBtn}>
                {t('retreatCta')}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </a>
            </div>
            <div className={styles.retreatVenues}>
              <p className={styles.retreatVenuesTitle}>{t('retreatVenuesTitle')}</p>
              <div className={styles.retreatVenuesGrid}>
                {RETREAT_VENUES.map(v => (
                  <div key={v.name} className={styles.retreatVenueCard}>
                    <div className={styles.retreatVenueName}>{v.name}</div>
                    <div className={styles.retreatVenueTag}>{v.tag}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Featured projects */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('projects')}</h2>
            <p className={styles.sectionSubtitle}>{t('projectsSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.projectsGrid}>
            {[1, 2, 3].map(n => (
              <Link key={n} href={`/projects/p${n}`} className={styles.projectCard}>
                <div className={styles.projectBanner} style={{ background: PROJECT_GRADIENTS[n - 1] }} />
                <div className={styles.projectInfo}>
                  <h3 className={styles.projectTitle}>{t(('featuredProjects.project' + n + '.title') as Parameters<typeof t>[0])}</h3>
                  <p className={styles.projectDesc}>{t(('featuredProjects.project' + n + '.description') as Parameters<typeof t>[0])}</p>
                  <span className={styles.projectBadge}>{t('active')}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.sectionCta}>
            <Link href="/projects" className={styles.secondaryButton}>{t('viewAllInitiatives')}</Link>
          </div>
        </div>
      </section>

      {/* 6. Shapers — show first 10 */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('members')}</h2>
            <p className={styles.sectionSubtitle}>{t('membersSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.membersGrid}>
            {MEMBERS.slice(0, 10).map((name, i) => (
              <div key={name} className={styles.memberCard}>
                <div className={styles.memberAvatar} style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}>
                  {initials(name)}
                </div>
                <div className={styles.memberName}>{name}</div>
                <div className={styles.memberRole}>{t('globalShaper')}</div>
              </div>
            ))}
          </div>
          <div className={styles.sectionCta}>
            <Link href="/about" className={styles.secondaryButton}>{t('viewAllShapers')}</Link>
          </div>
        </div>
      </section>

      {/* 7. Partners */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('partners')}</h2>
            <p className={styles.sectionSubtitle}>{t('partnersSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <div className={styles.partnersGrid}>
            {PARTNERS.map(p => <div key={p} className={styles.partnerCard}>{p}</div>)}
          </div>
        </div>
      </section>

      {/* 8. Newsletter */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}><NewsletterForm /></div>
      </section>
    </main>
  );
}
