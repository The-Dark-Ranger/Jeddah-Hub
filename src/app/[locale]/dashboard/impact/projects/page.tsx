/* Dashboard > Projects used to be the impact officers' own copy of the
 * Initiatives page. They now use that page (it shows them everything they may
 * do, and still tells the curators when they archive or restore one), and
 * this address forwards there so old links and bookmarks keep working. */
import { redirect } from 'next/navigation';

export default async function ImpactProjects({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/curator/initiatives`);
}
