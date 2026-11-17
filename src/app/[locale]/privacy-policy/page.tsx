/* Privacy Policy page (text in messages/*.json). */
import { setRequestLocale } from 'next-intl/server';
import { LegalPage, legalMetadata } from './legalPage';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata((await params).locale, 'PrivacyPolicyPage', 'privacy-policy');
}

export default async function PrivacyPolicyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} namespace="PrivacyPolicyPage" />;
}
