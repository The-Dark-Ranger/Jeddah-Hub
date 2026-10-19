import AboutClient, { type AboutData } from './AboutClient';
import { getInitiatives, getPublicProfiles } from '@/lib/publicData';

/* Members and the initiative count are loaded on the server so they arrive
 * inside the page. */
export default async function AboutPage() {
  const [profiles, initiatives] = await Promise.all([getPublicProfiles(), getInitiatives()]);
  const initial: AboutData | undefined = profiles
    ? {
        profiles: profiles.map(({ id, ...p }) => ({ uid: id, ...p })),
        initiativeCount: initiatives ? initiatives.filter(d => d.type !== 'hub_activity').length : null,
      }
    : undefined;
  return <AboutClient initial={initial} />;
}
