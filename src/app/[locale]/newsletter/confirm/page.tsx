/* Confirming a newsletter subscription: the page the confirmation email's
 * link opens. It asks before doing anything (link scanners open links too),
 * then sends the link's id and token to /api/newsletter/confirm. Kept out
 * of search engines. */
import { getTranslations } from 'next-intl/server';
import EmailLinkCard from '@/components/EmailLinkCard';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'NewsletterConfirm' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default function NewsletterConfirmPage() {
  return <EmailLinkCard namespace="NewsletterConfirm" endpoint="/api/newsletter/confirm" />;
}
