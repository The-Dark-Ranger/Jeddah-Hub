/* Privacy Policy page (text in messages/*.json). */
import { LegalPage, legalMetadata } from './legalPage';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  return legalMetadata((await params).locale, 'PrivacyPolicyPage', 'privacy-policy');
}

export default async function PrivacyPolicyPage({ params }: Props) {
  return <LegalPage locale={(await params).locale} namespace="PrivacyPolicyPage" />;
}
