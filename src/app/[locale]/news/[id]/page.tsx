import NewsPostClient, { type NewsPostData, type RelatedPost } from './NewsPostClient';
import { getPublicProfiles, getPublishedBlogs } from '@/lib/publicData';
import { slugify } from '@/lib/slug';

/* A published post is loaded on the server so it arrives inside the page.
 * Anything else (e.g. an author's own draft, readable only when signed in)
 * is left to the browser to fetch. */
const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export default async function NewsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const rawId = decode((await params).id);
  const [blogs, profiles] = await Promise.all([getPublishedBlogs(), getPublicProfiles()]);
  // The URL is the title slug (see newsPath); old links used the doc id.
  const post =
    blogs?.find(b => b.slug === rawId)
    ?? blogs?.find(b => slugify(String(b.title ?? '')) === rawId)
    ?? blogs?.find(b => b.id === rawId);
  if (!post) return <NewsPostClient />;
  const id = post.id;

  const author = profiles?.find(p => p.id === post.authorId);
  const related: RelatedPost[] = (blogs ?? [])
    .filter(b => b.id !== id)
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    .slice(0, 3)
    .map(b => ({ id: b.id, title: String(b.title ?? ''), slug: b.slug as string | undefined, createdAt: b.createdAt as string | undefined, tags: b.tags as string[] | undefined }));

  const initial: NewsPostData = {
    post,
    authorPhoto: typeof author?.photoURL === 'string' && author.photoURL ? author.photoURL : null,
    related,
  };
  return <NewsPostClient initial={initial} />;
}
