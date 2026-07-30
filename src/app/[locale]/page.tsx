import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './Home.module.css';
import NewsletterForm from '@/components/NewsletterForm';
import HomeShapers from '@/components/HomeShapers';
import HomeFeaturedInitiatives from '@/components/HomeFeaturedInitiatives';
import WaveDivider from '@/components/WaveDivider';

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
            <div className={styles.heroStat}><span>120+</span> {t('metrics.shapers')}</div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}><span>50+</span> {t('metrics.projects')}</div>
            <div className={styles.heroStatDivider} />
            <div className={styles.heroStat}><span>120K+</span> {t('benefited')}</div>
          </div>
        </div>
        <WaveDivider fill="var(--background)" className={styles.heroWave} />
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
              { num: '120K+', label: t('benefited') },
              { num: '50+',   label: t('metrics.projects') },
              { num: '40+',   label: t('metrics.partners') },
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
        <WaveDivider flip fill="var(--card-bg)" />
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
        <WaveDivider fill="var(--background)" />
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
