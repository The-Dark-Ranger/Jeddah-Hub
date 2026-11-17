import { setRequestLocale } from 'next-intl/server';
import NewsClient, { type NewsData, type NewsPost } from './NewsClient';
import { getPublicProfiles, getPublishedBlogs } from '@/lib/publicData';

/* Built once and served from the CDN, rebuilt at most every 60 seconds
 * and straight away when a dashboard edit refreshes the public data. */
export const revalidate = 60;

/* Published posts are loaded on the server so they arrive inside the page. */
export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const [blogs, profiles] = await Promise.all([getPublishedBlogs(), getPublicProfiles()]);
  let initial: NewsData | undefined;
  if (blogs) {
    const posts = (blogs as unknown as NewsPost[])
      .slice()
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    const authorPhotos: Record<string, string> = {};
    for (const p of profiles ?? []) {
      if (typeof p.photoURL === 'string' && p.photoURL && posts.some(post => post.authorId === p.id)) authorPhotos[p.id] = p.photoURL;
    }
    initial = { posts, authorPhotos };
  }
  return <NewsClient initial={initial} />;
}
