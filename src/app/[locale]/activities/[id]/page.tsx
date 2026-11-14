import { setRequestLocale } from 'next-intl/server';
import ActivityClient, { type Activity } from './ActivityClient';
import { getInitiatives } from '@/lib/publicData';
import { slugify } from '@/lib/slug';

/* Built on first visit (no list ahead of time), then served from the CDN
 * and rebuilt at most every 60 seconds, or straight away after a dashboard
 * edit refreshes the public data. */
export const revalidate = 60;
export function generateStaticParams() { return []; }

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/* The activity is loaded on the server so it arrives inside the page. URLs
 * resolve the same way the browser fallback does: `slug` field, then a slug
 * of the title, then a bare doc id. Only Hub Activities match. */
export default async function ActivityPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const rawId = decode(id);
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
