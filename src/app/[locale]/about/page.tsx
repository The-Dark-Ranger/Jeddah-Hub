import { setRequestLocale } from 'next-intl/server';
import AboutClient, { type AboutData } from './AboutClient';
import { getInitiatives, getPublicProfiles } from '@/lib/publicData';

/* Built once and served from the CDN, rebuilt at most every 60 seconds
 * and straight away when a dashboard edit refreshes the public data. */
export const revalidate = 60;

/* Members and the initiative count are loaded on the server so they arrive
 * inside the page. */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [profiles, initiatives] = await Promise.all([getPublicProfiles(), getInitiatives()]);
  const initial: AboutData | undefined = profiles
    ? {
        profiles: profiles.map(({ id, ...p }) => ({ uid: id, ...p })),
        initiativeCount: initiatives ? initiatives.filter(d => d.type !== 'hub_activity').length : null,
      }
    : undefined;
  return <AboutClient initial={initial} />;
}
