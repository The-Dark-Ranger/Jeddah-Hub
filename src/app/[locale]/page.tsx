import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './Home.module.css';
import NewsletterForm from '@/components/NewsletterForm';
import HomeShapers from '@/components/HomeShapers';
import HomeFeaturedInitiatives from '@/components/HomeFeaturedInitiatives';
import WaveDivider from '@/components/WaveDivider';
import HomeActivity from '@/components/HomeActivity';

const PARTNERS = [
  { name: 'The Hive',                   file: 'the-hive.png' },
  { name: 'huna',                        file: 'huna.png' },
  { name: 'Zawiya 97',                   file: 'zawiya-97.png' },
  { name: 'TAM',                         file: 'tam.png' },
  { name: "Monsha'at",                   file: 'monshaat.png' },
  { name: 'Jadwa',                       file: 'jadwa.png' },
  { name: 'SHADA Hotels',               file: 'shada-hotels.png' },
  { name: 'Islamic Development Bank',   file: 'isdb.png' },
  { name: 'SIDF',                        file: 'sidf.png' },
  { name: 'UNICEF',                      file: 'unicef.png' },
  { name: 'VIBES',                       file: 'vibes.png' },
  { name: "WED Women's Entrepreneurship Day", file: 'wed.png' },
  { name: 'Social Development Bank',    file: 'social-dev-bank.png' },
  { name: 'PwC',                         file: 'pwc.png' },
  { name: 'flyadeal',                    file: 'flyadeal.png' },
  { name: 'Dar Al-Hekma University',    file: 'dar-al-hekma.png' },
  { name: 'MBSC',                        file: 'mbsc.png' },
  { name: 'KAUST',                       file: 'kaust.png' },
  { name: 'Effat University',            file: 'effat.png' },
  { name: 'UBT',                         file: 'ubt.png' },
  { name: 'Cruise Saudi',               file: 'cruise-saudi.png' },
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
          <div className={styles.partnersLogoGrid}>
            {PARTNERS.map(p => (
              <div key={p.file} className={styles.partnerLogoWrap}>
                <img
                  src={`/partners/${p.file}`}
                  alt={p.name}
                  className={styles.partnerLogo}
                  loading="lazy"
                />
              </div>
            ))}
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
