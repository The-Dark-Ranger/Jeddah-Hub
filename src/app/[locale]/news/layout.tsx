import { getTranslations } from 'next-intl/server';
import { alternateLanguages } from '@/lib/seo';

// Covers both the /news listing and /news/[id] article route generically —
// see projects/layout.tsx for why this lives in a sibling layout rather than
// the (Client Component) pages themselves.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'NewsPage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: `/${locale}/news`, languages: alternateLanguages('/news') },
  };
}

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
