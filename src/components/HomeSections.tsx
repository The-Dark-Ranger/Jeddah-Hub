import HomeActivity, { type Activity } from './HomeActivity';
import HomeFeaturedInitiatives, { type Initiative } from './HomeFeaturedInitiatives';
import HomeShapers, { type Shaper } from './HomeShapers';
import { getInitiatives, getPublicProfiles } from '@/lib/publicData';

/* Server wrappers for the homepage's data-driven sections: they load the
 * data on the server (src/lib/publicData.ts) so it arrives inside the page
 * HTML. If that load fails, the sections fetch in the browser as before.
 * Only the fields the cards show are passed on: everything handed to a
 * client component is also written into the page, and full documents
 * (both languages' stories, members, registration forms) would make every
 * visitor download all of it. */

/** `doc` with only `keys`. */
function only<T>(doc: Record<string, unknown>, keys: readonly (keyof T & string)[]): T {
  return Object.fromEntries(keys.filter(k => doc[k] !== undefined).map(k => [k, doc[k]])) as T;
}

const ACTIVITY_FIELDS = ['id', 'title', 'eyebrow', 'subtitle', 'description', 'date', 'location', 'ctaText', 'ctaUrl',
  'highlights', 'active', 'color', 'imageUrl', 'kind', 'slug'] as const satisfies readonly (keyof Activity)[];
const INITIATIVE_FIELDS = ['id', 'title', 'titleAr', 'description', 'descriptionAr', 'type', 'featured', 'featuredAt',
  'createdAt', 'category', 'imageUrl', 'images', 'stat', 'color', 'slug'] as const satisfies readonly (keyof Initiative)[];

const MEMBER_ROLES = ['shaper', 'alumni', 'curator', 'vice_curator', 'vice curator', 'impact_officer', 'impact officer'];

export async function HomeActivitySection() {
  const all = await getInitiatives();
  // Only the activities visitors can see (the section shows active ones).
  const activities = all?.filter(d => d.type === 'hub_activity' && d.active === true)
    .map(d => only<Activity & { createdAt?: unknown }>(d, [...ACTIVITY_FIELDS, 'createdAt']));
  return <HomeActivity initial={activities} />;
}

export async function HomeFeaturedSection() {
  const all = await getInitiatives();
  const active = all?.filter(d => d.status === 'active')
    .map(d => ({ ...only<Initiative>(d, INITIATIVE_FIELDS), images: (d.images as string[] | undefined)?.slice(0, 1) }));
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
