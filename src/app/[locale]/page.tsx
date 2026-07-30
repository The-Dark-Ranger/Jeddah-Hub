import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './Home.module.css';
import NewsletterForm from '@/components/NewsletterForm';
import HomeShapers from '@/components/HomeShapers';
import HomeFeaturedInitiatives from '@/components/HomeFeaturedInitiatives';
import WaveDivider from '@/components/WaveDivider';
import HomeActivity from '@/components/HomeActivity';

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


      {/* 4. Activity spotlight (curator-managed, falls back to "Stay Tuned") */}
      <HomeActivity />

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
