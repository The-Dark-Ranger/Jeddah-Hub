'use client';

/* A news post: article, likes (members and guests), sharing and related posts. */
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, getDocs, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/routing';
import { newsPath } from '@/lib/slug';
import { RoleLabel } from '@/lib/roleLabel';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Post.module.css';

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** ~200 words a minute, never less than one. */
function readingMinutes(text: string) {
  return Math.max(1, Math.round((text.trim().split(/\s+/).filter(Boolean).length) / 200));
}

/** A blog post as this page reads it (blogs/{id}). */
interface BlogPost {
  id: string; title: string; content: string; slug?: string; tags?: string[];
  authorId?: string; authorName?: string; authorRole?: string; createdAt?: string;
  likedBy?: string[]; visitorLikes?: string[];
}

export interface RelatedPost { id: string; title: string; slug?: string; createdAt?: string; tags?: string[]; }

function genGuestId() {
  return 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** A published post, its author's photo and other recent posts, loaded on
 *  the server (page.tsx). */
export interface NewsPostData {
  post: Record<string, unknown>;
  authorPhoto: string | null;
  related: RelatedPost[];
}

/** `initial`: data loaded on the server; when absent (e.g. an author
 *  previewing their own unpublished draft) it is fetched in the browser. */
export default function NewsPostClient({ initial }: { initial?: NewsPostData }) {
  // The URL carries the post's title slug (or, for older links and drafts,
  // its doc id); Firestore calls below always use the doc id.
  const { id: urlId } = useParams() as { id: string };
  const id       = (initial?.post.id as string | undefined) ?? urlId;
  const router   = useRouter();
  const { user } = useAuth();
  const t        = useTranslations('NewsPostPage');
  const locale   = useLocale();

  const [post, setPost]               = useState<BlogPost | null>((initial?.post as BlogPost | undefined) ?? null);
  const [loading, setLoading]         = useState(!initial);
  const [liking, setLiking]           = useState(false);
  const [visitorId, setVisitorId]     = useState<string | null>(null);
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(initial?.authorPhoto ?? null);
  const [related, setRelated]         = useState<RelatedPost[]>(initial?.related ?? []);
  const [copied, setCopied]           = useState(false);

  /* Generate / load persistent guest ID for visitor likes */
  useEffect(() => {
    let gid = localStorage.getItem('jh_guest_id');
    if (!gid) { gid = genGuestId(); localStorage.setItem('jh_guest_id', gid); }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the guest id from browser storage
    setVisitorId(gid);
  }, []);

  /* Who has liked this post */
  const liked = user
    ? (post?.likedBy ?? []).includes(user.uid)
    : visitorId ? (post?.visitorLikes ?? []).includes(visitorId) : false;

  /* Total likes = signed-in + visitor */
  const likeCount = (post?.likedBy?.length ?? 0) + (post?.visitorLikes?.length ?? 0);

  useEffect(() => {
    if (initial) {
      // Old id-based links: switch to the clean title URL.
      const canonical = newsPath(initial.post as { id: string; title?: string; slug?: string });
      if (`/news/${decodeURIComponent(urlId)}` !== decodeURIComponent(canonical)) router.replace(canonical);
      // The server copy can be up to a minute old: refresh just the post
      // in the background so the like count is current.
      Promise.resolve()
        .then(() => getDoc(doc(db, 'blogs', id)))
        .then(snap => { if (snap.exists()) setPost({ id: snap.id, ...snap.data() } as BlogPost); })
        .catch(() => {});
      return;
    }
    getDoc(doc(db, 'blogs', id)).then(snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as BlogPost;
        setPost(data);
        // Real profile photo instead of the initials fallback, when the
        // author has one set, same public mirror the projects/about pages
        // already read from (no email field, safe to read publicly).
        if (data.authorId) {
          getDoc(doc(db, 'public_profiles', data.authorId))
            .then(pSnap => setAuthorPhoto(pSnap.exists() ? pSnap.data().photoURL || null : null))
            .catch(() => {});
        }
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });

    // "More stories": the latest few other published posts.
    (async () => {
      try {
        let docs;
        try {
          docs = (await getDocs(query(collection(db, 'blogs'), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(4)))).docs;
        } catch {
          docs = (await getDocs(query(collection(db, 'blogs'), where('status', '==', 'published')))).docs
            .sort((a, b) => String(b.data().createdAt ?? '').localeCompare(String(a.data().createdAt ?? '')));
        }
        setRelated(docs.filter(d => d.id !== id).slice(0, 3)
          .map(d => ({ id: d.id, ...(d.data() as Omit<RelatedPost, 'id'>) })));
      } catch { /* optional section, leave it out */ }
    })();
  }, [id, initial, urlId, router]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked, nothing to do */ }
  };

  /* ── Like (works for both signed-in users and visitors) ── */
  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const ref = doc(db, 'blogs', id);

    try {
      if (user) {
        if (liked) {
          await updateDoc(ref, { likedBy: arrayRemove(user.uid) });
          setPost(p => p && ({ ...p, likedBy: (p.likedBy ?? []).filter(u => u !== user.uid) }));
        } else {
          await updateDoc(ref, { likedBy: arrayUnion(user.uid) });
          setPost(p => p && ({ ...p, likedBy: [...(p.likedBy ?? []), user.uid] }));
        }
      } else if (visitorId) {
        if (liked) {
          await updateDoc(ref, { visitorLikes: arrayRemove(visitorId) });
          setPost(p => p && ({ ...p, visitorLikes: (p.visitorLikes ?? []).filter(v => v !== visitorId) }));
        } else {
          await updateDoc(ref, { visitorLikes: arrayUnion(visitorId) });
          setPost(p => p && ({ ...p, visitorLikes: [...(p.visitorLikes ?? []), visitorId!] }));
        }
      }
    } catch (err) {
      console.error('Failed to update like:', err);
    } finally {
      setLiking(false);
    }
  };

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner} /></div>;

  if (!post) return (
    <div className={styles.notFound}>
      <h2>{t('notFound')}</h2>
      <Link href="/news" className={styles.backLink}>{t('backToNews')}</Link>
    </div>
  );

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/news" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('backToNews')}
        </Link>

        <article className={styles.article}>
          {post.tags && post.tags.length > 0 && (
            <div className={styles.articleCategory}>{post.tags[0].toUpperCase()}</div>
          )}
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <div className={styles.articleMeta}>
            <div className={styles.authorCard}>
              {authorPhoto ? (
                <img className={styles.authorAvatarImg} src={authorPhoto} alt="" />
              ) : (
                <div className={styles.authorAvatar}>
                  {(post.authorName || t('globalShaper'))[0].toUpperCase()}
                </div>
              )}
              <div>
                <div className={styles.authorName}>{post.authorName || t('globalShaper')}</div>
                <div className={styles.authorRole}>
                  {post.authorRole ? <RoleLabel role={post.authorRole} /> : t('jeddahHub')}
                </div>
              </div>
            </div>
            <div className={styles.articleDate}>
              {formatDate(post.createdAt ?? "", locale)}
              <span className={styles.metaDot} aria-hidden="true" />
              {t('minRead', { n: readingMinutes(post.content || '') })}
            </div>
          </div>
          <div className={styles.articleBody}>
            {(post.content || '').split('\n').map((para: string, i: number) =>
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            )}
          </div>
          {Array.isArray(post.tags) && post.tags.length > 0 && (
            <ul className={styles.tagList} aria-label={t('tags')}>
              {post.tags.map((tag: string) => <li key={tag} className={styles.tagItem}>#{tag}</li>)}
            </ul>
          )}

          <div className={styles.articleActions}>
            <button
              className={`${styles.likeBtn} ${liked ? styles.likeBtnActive : ''}`}
              onClick={handleLike}
              disabled={liking}
            >
              <svg width="16" height="16" viewBox="0 0 24 24"
                fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {likeCount > 0 ? likeCount + ' ' : ''}{likeCount === 1 ? t('like') : t('likes')}
            </button>

            <div className={styles.share}>
              <span className={styles.shareLabel}>{t('share')}</span>
              <a className={styles.shareBtn} href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener noreferrer" aria-label="X">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24H16.17l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25H8.08l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z"/></svg>
              </a>
              <a className={styles.shareBtn} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>
              </a>
              <a className={styles.shareBtn} href={`https://wa.me/?text=${encodeURIComponent(post.title + ' ' + shareUrl)}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88a9.83 9.83 0 0 1 9.88 9.89c0 5.45-4.44 9.88-9.89 9.88zm8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41z"/></svg>
              </a>
              <button type="button" className={styles.shareBtn + (copied ? ' ' + styles.shareBtnDone : '')} onClick={copyLink} aria-label={t('copyLink')}>
                {copied ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                )}
              </button>
              <span className={styles.copiedNote} aria-live="polite">{copied ? t('linkCopied') : ''}</span>
            </div>
          </div>
        </article>

        {related.length > 0 && (
          <section className={styles.related} aria-labelledby="related-title">
            <h2 id="related-title" className={styles.relatedTitle}>{t('moreStories')}</h2>
            <div className={styles.relatedGrid}>
              {related.map(r => (
                <Link key={r.id} href={newsPath(r)} className={styles.relatedCard}>
                  {r.tags?.[0] && <span className={styles.relatedTag}>{r.tags[0]}</span>}
                  <span className={styles.relatedName}>{r.title}</span>
                  {r.createdAt && <span className={styles.relatedDate}>{formatDate(r.createdAt, locale)}</span>}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
