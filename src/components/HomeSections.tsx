import HomeActivity, { type Activity } from './HomeActivity';
import HomeFeaturedInitiatives, { type Initiative } from './HomeFeaturedInitiatives';
import HomeShapers, { type Shaper } from './HomeShapers';
import { getInitiatives, getPublicProfiles } from '@/lib/publicData';

/* Server wrappers for the homepage's data-driven sections: they load the
 * data on the server (src/lib/publicData.ts) so it arrives inside the page
 * HTML. If that load fails, the sections fetch in the browser as before. */

const MEMBER_ROLES = ['shaper', 'alumni', 'curator', 'vice_curator', 'vice curator', 'impact_officer', 'impact officer'];

export async function HomeActivitySection() {
  const all = await getInitiatives();
  const activities = all?.filter(d => d.type === 'hub_activity') as Activity[] | undefined;
  return <HomeActivity initial={activities} />;
}

export async function HomeFeaturedSection() {
  const all = await getInitiatives();
  const active = all?.filter(d => d.status === 'active') as Initiative[] | undefined;
  return <HomeFeaturedInitiatives initial={active} />;
}

export async function HomeShapersSection() {
  const profiles = await getPublicProfiles();
  const shapers = profiles
    ?.filter(p => typeof p.role === 'string' && MEMBER_ROLES.includes(p.role) && p.displayName)
    .slice(0, 10)
    .map((p): Shaper => ({
      uid: p.id,
      displayName: p.displayName as string,
      displayNameAr: (p.displayNameAr as string) || '',
      role: p.role as string,
      photoURL: (p.photoURL as string) || '',
    }));
  return <HomeShapers initial={shapers} />;
}
