import { getTranslations } from 'next-intl/server';
import { alternateLanguages } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ContactPage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: `/${locale}/contact`, languages: alternateLanguages('/contact') },
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
