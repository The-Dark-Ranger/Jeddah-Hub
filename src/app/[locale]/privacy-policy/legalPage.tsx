/* The Privacy Policy and Terms of Use pages are the same page with different
 * text (messages/*.json): a header, then the numbered sections. */
import { getTranslations } from 'next-intl/server';
import WaveDivider from '@/components/WaveDivider';
import LegalDocument from './LegalDocument';
import styles from './Legal.module.css';

type Namespace = 'PrivacyPolicyPage' | 'TermsOfUsePage';
interface Section { heading: string; body: string; }

/** Title, description and the EN/AR addresses of a legal page. */
export async function legalMetadata(locale: string, namespace: Namespace, path: string) {
  const t = await getTranslations({ locale, namespace });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: { en: `/en/${path}`, ar: `/ar/${path}` },
    },
  };
}

export async function LegalPage({ locale, namespace }: { locale: string; namespace: Namespace }) {
  const t = await getTranslations({ locale, namespace });
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
