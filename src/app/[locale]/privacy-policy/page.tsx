import { getTranslations } from 'next-intl/server';
import WaveDivider from '@/components/WaveDivider';
import styles from './Legal.module.css';

interface Section { heading: string; body: string; }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PrivacyPolicyPage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: `/${locale}/privacy-policy`,
      languages: { en: '/en/privacy-policy', ar: '/ar/privacy-policy' },
    },
  };
}

export default async function PrivacyPolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'PrivacyPolicyPage' });
  const sections = t.raw('sections') as Section[];

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
          <p className={styles.headerMeta}>{t('lastUpdated')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.headerWave} />
      </section>

      <div className={styles.container}>
        <p className={styles.intro}>{t('intro')}</p>
        <div className={styles.sections}>
          {sections.map((s, i) => (
            <section key={i} className={styles.section}>
              <h2 className={styles.sectionTitle}>{s.heading}</h2>
              <div className={styles.sectionBody}>
                {s.body.split('\n\n').map((para, j) => <p key={j}>{para}</p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
