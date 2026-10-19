import ProjectsClient, { type Project } from './ProjectsClient';
import { getInitiatives } from '@/lib/publicData';

/* Initiatives are loaded on the server so they arrive inside the page;
 * Hub Activities (type 'hub_activity') aren't initiatives and are left out. */
export default async function ProjectsPage() {
  const all = await getInitiatives();
  return <ProjectsClient initial={all?.filter(d => !d.type) as Project[] | undefined} />;
}
