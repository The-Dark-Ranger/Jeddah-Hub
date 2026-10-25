/* Terms of Use page (text in messages/*.json). */
import { getTranslations } from 'next-intl/server';
import WaveDivider from '@/components/WaveDivider';
import LegalDocument from '../privacy-policy/LegalDocument';
import styles from '../privacy-policy/Legal.module.css';

interface Section { heading: string; body: string; }

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'TermsOfUsePage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: `/${locale}/terms-of-use`,
      languages: { en: '/en/terms-of-use', ar: '/ar/terms-of-use' },
    },
  };
}

export default async function TermsOfUsePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'TermsOfUsePage' });
  const tc = await getTranslations({ locale, namespace: 'Common' });
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
        <LegalDocument intro={t('intro')} sections={sections} tocLabel={tc('onThisPage')} />
      </div>
    </main>
  );
}
