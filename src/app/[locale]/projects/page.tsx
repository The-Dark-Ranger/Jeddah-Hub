import { setRequestLocale } from 'next-intl/server';
import ProjectsClient, { type Project } from './ProjectsClient';
import { getInitiatives } from '@/lib/publicData';

/* Built once and served from the CDN, rebuilt at most every 60 seconds
 * and straight away when a dashboard edit refreshes the public data. */
export const revalidate = 60;

/* Initiatives are loaded on the server so they arrive inside the page;
 * Hub Activities (type 'hub_activity') aren't initiatives and are left out. */
export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const all = await getInitiatives();
  return <ProjectsClient initial={all?.filter(d => !d.type) as Project[] | undefined} />;
}
