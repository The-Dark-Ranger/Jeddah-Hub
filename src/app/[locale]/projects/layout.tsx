import { getTranslations } from 'next-intl/server';
import { alternateLanguages } from '@/lib/seo';

// Covers both the /projects listing and /projects/[id] detail route with the
// same generic metadata — both are Client Components (live Firestore data),
// so metadata has to live in this sibling Server Component layout instead.
// Per-initiative titles would need a server-side Firestore read at request
// time for a marginal gain, so this stays intentionally generic.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ProjectsPage' });
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: `/${locale}/projects`, languages: alternateLanguages('/projects') },
  };
}

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
