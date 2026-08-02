import { getTranslations } from 'next-intl/server';
import { alternateLanguages } from '@/lib/seo';

// This route's page.tsx is a Client Component (needs useState/useEffect for
// live Firestore data), and generateMetadata can only run in a Server
// Component. A sibling layout.tsx is the standard way to attach metadata to
// a route without changing the page itself.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AboutPage' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: `/${locale}/about`, languages: alternateLanguages('/about') },
  };
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
