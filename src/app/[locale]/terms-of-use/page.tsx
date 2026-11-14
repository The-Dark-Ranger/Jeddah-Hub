/* Terms of Use page (text in messages/*.json). */
import { setRequestLocale } from 'next-intl/server';
import { LegalPage, legalMetadata } from '../privacy-policy/legalPage';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata((await params).locale, 'TermsOfUsePage', 'terms-of-use');
}

export default async function TermsOfUsePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage locale={locale} namespace="TermsOfUsePage" />;
}
