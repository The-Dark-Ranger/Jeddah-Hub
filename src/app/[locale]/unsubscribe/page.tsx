/* Leaving the newsletter: the page the welcome email's link opens. It asks
 * before doing anything (link scanners open links too), then sends the
 * link's id and token to /api/newsletter/unsubscribe. Kept out of search
 * engines. */
import { getTranslations } from 'next-intl/server';
import UnsubscribeClient from './UnsubscribeClient';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Unsubscribe' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default function UnsubscribePage() {
  return <UnsubscribeClient />;
}
