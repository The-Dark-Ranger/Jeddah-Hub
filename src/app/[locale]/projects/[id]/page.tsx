import ProjectClient, { type Initiative, type InitiativeData, type UserRecord } from './ProjectClient';
import { getInitiatives, getPublicProfiles } from '@/lib/publicData';
import { slugify } from '@/lib/slug';

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/* The initiative, its members' public profiles and related initiatives are
 * loaded on the server so they arrive inside the page. URLs resolve the same
 * way the browser fallback does: `slug` field, then a slug of the title,
 * then old "name--docId" or bare-id links. Hub Activities are excluded. */
export default async function InitiativePage({ params }: { params: Promise<{ id: string }> }) {
  const rawId = decode((await params).id);
  const [all, profiles] = await Promise.all([getInitiatives(), getPublicProfiles()]);
  if (!all) return <ProjectClient />;

  const real = all.filter(d => !d.type) as unknown as Initiative[];
  const legacyId = rawId.includes('--') ? rawId.slice(rawId.lastIndexOf('--') + 2) : rawId;
  const initiative =
    real.find(d => d.slug === rawId)
    ?? real.find(d => slugify(d.title || '') === rawId)
    ?? real.find(d => d.id === legacyId)
    ?? null;

  let related: Initiative[] = [];
  let users: UserRecord[] = [];
  if (initiative) {
    // "More initiatives": same category first, then active before archived.
    related = real
      .filter(o => o.id !== initiative.id)
      .sort((x, y) =>
        Number(y.category === initiative.category) - Number(x.category === initiative.category)
        || Number(y.status !== 'archived') - Number(x.status !== 'archived'))
      .slice(0, 3);
    const memberIds = new Set((initiative.members ?? []).map(m => m.userId).filter(Boolean));
    users = (profiles ?? []).filter(p => memberIds.has(p.id)) as unknown as UserRecord[];
  }

  const initial: InitiativeData = { initiative, related, users };
  return <ProjectClient initial={initial} />;
}
