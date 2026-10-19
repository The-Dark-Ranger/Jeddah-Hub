import NewsClient, { type NewsData, type NewsPost } from './NewsClient';
import { getPublicProfiles, getPublishedBlogs } from '@/lib/publicData';

/* Published posts are loaded on the server so they arrive inside the page. */
export default async function NewsPage() {
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
