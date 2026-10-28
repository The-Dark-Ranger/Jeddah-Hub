/* Terms of Use page (text in messages/*.json). */
import { LegalPage, legalMetadata } from '../privacy-policy/legalPage';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata((await params).locale, 'TermsOfUsePage', 'terms-of-use');
}

export default async function TermsOfUsePage({ params }: Props) {
  return <LegalPage locale={(await params).locale} namespace="TermsOfUsePage" />;
}
