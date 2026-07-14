import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './Home.module.css';
import NewsletterForm from '@/components/NewsletterForm';
import HomeShapers from '@/components/HomeShapers';
import HomeFeaturedInitiatives from '@/components/HomeFeaturedInitiatives';
import JeddahStripe from '@/components/JeddahStripe';

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

// Active partners -- update this list to add/remove partner badges on the home page
const PARTNERS = [
  'SHADA Hotel',
  'Zawiya 97',
];

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
        {/* Decorative globe */}
        <div className={styles.heroGlobe} aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.heroGlobeSvg}>
            <circle cx="100" cy="100" r="98" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
            <circle cx="100" cy="100" r="98" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
            <ellipse cx="100" cy="100" rx="40" ry="98" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            <ellipse cx="100" cy="100" rx="72" ry="98" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
            <line x1="2" y1="100" x2="198" y2="100" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
            <ellipse cx="100" cy="100" rx="98" ry="36" stroke="rgba(255,255,255,0.07)" strokeWidth="1"/>
            <ellipse cx="100" cy="100" rx="98" ry="65" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            <line x1="100" y1="2" x2="100" y2="198" stroke="rgba(255,255,255,0.09)" strokeWidth="1"/>
            {/* Saudi Arabia / Jeddah dot */}
            <circle cx="118" cy="98" r="3.5" fill="rgba(255,255,255,0.6)"/>
            <circle cx="118" cy="98" r="6" fill="rgba(255,255,255,0.15)"/>
          </svg>
        </div>
        {/* Jeddah skyline silhouette */}
        <div className={styles.heroSkyline} aria-hidden="true">
          <svg viewBox="0 0 600 120" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMax meet">
            <path d="M0,120 L0,80 L20,80 L20,50 L30,50 L30,40 L40,40 L40,50 L50,50 L50,80 L60,80 L60,60 L70,60 L70,30 L75,30 L75,20 L77,20 L77,14 L79,14 L79,20 L81,20 L81,30 L85,30 L85,60 L95,60 L95,80 L110,80 L110,55 L120,55 L120,45 L125,45 L125,35 L130,35 L130,45 L135,45 L135,55 L150,55 L150,80 L165,80 L165,65 L175,65 L175,45 L180,45 L180,38 L182,38 L182,32 L184,32 L184,38 L186,38 L186,45 L190,45 L190,65 L200,65 L200,80 L215,80 L215,70 L225,70 L225,55 L235,55 L235,70 L245,70 L245,80 L260,80 L260,60 L270,60 L270,40 L275,40 L275,25 L278,25 L278,18 L280,18 L280,14 L282,14 L282,18 L284,18 L284,25 L287,25 L287,40 L295,40 L295,60 L310,60 L310,80 L325,80 L325,65 L340,65 L340,50 L350,50 L350,38 L355,38 L355,30 L358,30 L358,22 L361,22 L361,30 L364,30 L364,38 L370,38 L370,50 L380,50 L380,65 L395,65 L395,80 L410,80 L410,55 L420,55 L420,42 L430,42 L430,55 L445,55 L445,80 L460,80 L460,68 L470,68 L470,50 L480,50 L480,40 L485,40 L485,32 L487,32 L487,26 L490,26 L490,32 L492,32 L492,40 L500,40 L500,50 L510,50 L510,68 L520,68 L520,80 L540,80 L540,60 L550,60 L550,45 L560,45 L560,60 L570,60 L570,80 L580,80 L580,90 L600,90 L600,120 Z"
              fill="rgba(255,255,255,0.06)"/>
            <path d="M0,120 L0,90 L40,90 L40,75 L50,75 L50,90 L75,90 L75,70 L85,70 L85,90 L130,90 L130,78 L140,78 L140,90 L180,90 L180,72 L190,72 L190,90 L240,90 L240,82 L250,82 L250,90 L290,90 L290,72 L300,72 L300,90 L350,90 L350,80 L365,80 L365,90 L410,90 L410,76 L420,76 L420,90 L460,90 L460,84 L475,84 L475,90 L510,90 L510,75 L520,75 L520,90 L560,90 L560,82 L570,82 L570,90 L600,90 L600,120 Z"
              fill="rgba(255,255,255,0.04)"/>
          </svg>
        </div>
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

      <JeddahStripe />

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

      <JeddahStripe variant="white" />

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

      {/* 5. Featured projects (live from Firestore) */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('projects')}</h2>
            <p className={styles.sectionSubtitle}>{t('projectsSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <HomeFeaturedInitiatives />
          <div className={styles.sectionCta}>
            <Link href="/projects" className={styles.secondaryButton}>{t('viewAllInitiatives')}</Link>
          </div>
        </div>
      </section>

      {/* 6. Shapers (live from Firestore) */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t('members')}</h2>
            <p className={styles.sectionSubtitle}>{t('membersSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <HomeShapers />
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
