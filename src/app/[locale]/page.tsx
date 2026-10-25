import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Link } from '@/i18n/routing';
import styles from './Home.module.css';
import NewsletterForm from '@/components/NewsletterForm';
import WaveDivider from '@/components/WaveDivider';
import { HomeActivitySection, HomeFeaturedSection, HomeShapersSection } from '@/components/HomeSections';
import WefSection from '@/components/WefSection';
import PatternDivider from '@/components/PatternDivider';
import { SITE_URL } from '@/lib/seo';

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Jeddah Hub',
  alternateName: 'Global Shapers Community, Jeddah Hub',
  url: SITE_URL,
  logo: `${SITE_URL}/GSCJ.png`,
  foundingDate: '2015',
  sameAs: [
    'https://www.linkedin.com/company/global-shapers-jeddah-hub',
    'https://x.com/JeddahHub',
    'https://www.instagram.com/jeddahhub',
    'https://www.globalshapers.org',
  ],
  parentOrganization: {
    '@type': 'Organization',
    name: 'World Economic Forum',
    url: 'https://www.weforum.org',
  },
  address: { '@type': 'PostalAddress', addressLocality: 'Jeddah', addressCountry: 'SA' },
};

export default function HomePage() {
  const t   = useTranslations('HomePage');
  const nav = useTranslations('Navigation');

  const PILLARS = [
    { title: t('pillar1Title'), body: t('pillar1Body'), icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { title: t('pillar2Title'), body: t('pillar2Body'), icon: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z' },
    { title: t('pillar3Title'), body: t('pillar3Body'), icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  ];

  return (
    <main className={styles.main}>
      {/* Fixed, hand-authored object below, never interpolates request or
          user-supplied data. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />

      {/* 1. Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOrb1} />
        <div className={styles.heroOrb2} />
        <div className={styles.heroGrid}>
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

        {/* Jeddah landmarks in a Hijazi arch, desktop only */}
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.heroArch}>
            <Image src="/jeddah-building.png" alt="" width={575} height={1184} className={styles.heroTower} sizes="230px" />
          </div>
          <Image src="/globe-mosaic.png" alt="" width={1061} height={1018} className={styles.heroGlobe} sizes="200px" />
        </div>
        </div>
        <WaveDivider fill="var(--background)" className={styles.heroWave} />
      </section>


      {/* 2. About */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader + ' reveal'}>
            <h2 className={styles.sectionTitle}>{nav('about')}</h2>
            <div className={styles.sectionDivider} />
          </div>
          <p className={styles.aboutText}>{t('aboutHub')}</p>
          <div className={styles.aboutPillars}>
            {PILLARS.map(p => (
              <div key={p.title} className={styles.pillar + ' reveal'}>
                <span className={styles.pillarIcon} aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={p.icon} /></svg>
                </span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PatternDivider />

      {/* 2b. Part of the World Economic Forum */}
      <WefSection />

      <PatternDivider />

      {/* 3. Impact metrics */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader + ' reveal'}>
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
              <div key={label} className={styles.impactCard + ' reveal'}>
                <div className={styles.impactNumber}>{num}</div>
                <div className={styles.impactLabel}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* 4. Activity spotlight (curator-managed, falls back to "Stay Tuned") */}
      <HomeActivitySection />

      {/* 5. Featured projects (live from Firestore) */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader + ' reveal'}>
            <h2 className={styles.sectionTitle}>{t('projects')}</h2>
            <p className={styles.sectionSubtitle}>{t('projectsSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <HomeFeaturedSection />
          <div className={styles.sectionCta}>
            <Link href="/projects" className={styles.secondaryButton}>{t('viewAllInitiatives')}</Link>
          </div>
        </div>
      </section>

      <PatternDivider />

      {/* 6. Shapers (live from Firestore) */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader + ' reveal'}>
            <h2 className={styles.sectionTitle}>{t('members')}</h2>
            <p className={styles.sectionSubtitle}>{t('membersSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          <HomeShapersSection />
          <div className={styles.sectionCta}>
            <Link href="/about" className={styles.secondaryButton}>{t('viewAllShapers')}</Link>
          </div>
        </div>
      </section>

      <PatternDivider />

      {/* 7. Partners */}
      <section className={styles.section} style={{ backgroundColor: 'var(--background)' }}>
        <div className={styles.container}>
          <div className={styles.sectionHeader + ' reveal'}>
            <h2 className={styles.sectionTitle}>{t('partners')}</h2>
            <p className={styles.sectionSubtitle}>{t('partnersSubtitle')}</p>
            <div className={styles.sectionDivider} />
          </div>
          {/* next/image serves this as AVIF/WebP sized to the viewport
              instead of the full 412KB PNG on every visit. */}
          {/* Partner logos keep their brand colours, several of them black on
              transparent, so they always sit on a light card, which keeps
              them visible in dark mode too. */}
          <div className={styles.partnersCard + ' reveal'}>
            <Image
              src="/partners.png"
              alt={t('partners')}
              className={styles.partnersImage}
              width={1856}
              height={611}
              sizes="(max-width: 1140px) 100vw, 1100px"
            />
          </div>
        </div>
      </section>

      <PatternDivider />

      {/* 8. Newsletter */}
      <section className={styles.section} style={{ backgroundColor: 'var(--card-bg)' }}>
        <div className={styles.container}><NewsletterForm /></div>
      </section>
    </main>
  );
}
