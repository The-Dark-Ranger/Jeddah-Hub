import ActivityClient, { type Activity } from './ActivityClient';
import { getInitiatives } from '@/lib/publicData';
import { slugify } from '@/lib/slug';

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/* The activity is loaded on the server so it arrives inside the page. URLs
 * resolve the same way the browser fallback does: `slug` field, then a slug
 * of the title, then a bare doc id. Only Hub Activities match. */
export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const rawId = decode((await params).id);
  const all = await getInitiatives();
  if (!all) return <ActivityClient />;

  const activities = all.filter(d => d.type === 'hub_activity') as unknown as Activity[];
  const activity =
    activities.find(a => a.slug === rawId)
    ?? activities.find(a => slugify(a.title || '') === rawId)
    ?? activities.find(a => a.id === rawId)
    ?? null;
  return <ActivityClient initial={activity} />;
}
