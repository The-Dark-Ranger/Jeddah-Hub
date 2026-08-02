import { getTranslations } from 'next-intl/server';
import { alternateLanguages } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ImpactReportsPage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: `/${locale}/impact-reports`, languages: alternateLanguages('/impact-reports') },
  };
}

export default function ImpactReportsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
