import NewsPostClient, { type NewsPostData, type RelatedPost } from './NewsPostClient';
import { getPublicProfiles, getPublishedBlogs } from '@/lib/publicData';

/* A published post is loaded on the server so it arrives inside the page.
 * Anything else (e.g. an author's own draft, readable only when signed in)
 * is left to the browser to fetch. */
export default async function NewsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [blogs, profiles] = await Promise.all([getPublishedBlogs(), getPublicProfiles()]);
  const post = blogs?.find(b => b.id === id);
  if (!post) return <NewsPostClient />;

  const author = profiles?.find(p => p.id === post.authorId);
  const related: RelatedPost[] = (blogs ?? [])
    .filter(b => b.id !== id)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 3)
    .map(b => ({ id: b.id, title: String(b.title ?? ''), createdAt: b.createdAt as string | undefined, tags: b.tags as string[] | undefined }));

  const initial: NewsPostData = {
    post,
    authorPhoto: typeof author?.photoURL === 'string' && author.photoURL ? author.photoURL : null,
    related,
  };
  return <NewsPostClient initial={initial} />;
}
