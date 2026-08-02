'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, addDoc, query, where, orderBy, getDocs, onSnapshot, deleteDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Post.module.css';

interface Comment {
  id: string; blogId: string; authorId: string;
  authorName: string; authorRole?: string; content: string; createdAt: string;
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function genGuestId() {
  return 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function NewsPostPage() {
  const { id }   = useParams() as { id: string };
  const { user } = useAuth();
  const t        = useTranslations('NewsPostPage');
  const locale   = useLocale();

  const [post, setPost]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [liking, setLiking]           = useState(false);
  const [comments, setComments]       = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting]         = useState(false);
  const [visitorId, setVisitorId]     = useState<string | null>(null);

  /* Generate / load persistent guest ID for visitor likes */
  useEffect(() => {
    let gid = localStorage.getItem('jh_guest_id');
    if (!gid) { gid = genGuestId(); localStorage.setItem('jh_guest_id', gid); }
    setVisitorId(gid);
  }, []);

  /* Who has liked this post */
  const liked = user
    ? (post?.likedBy ?? []).includes(user.uid)
    : visitorId ? (post?.visitorLikes ?? []).includes(visitorId) : false;

  /* Total likes = signed-in + visitor */
  const likeCount = (post?.likedBy?.length ?? 0) + (post?.visitorLikes?.length ?? 0);

  /* Localised relative time */
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 2) return t('justNow');
    if (mins < 60) return t('minutesAgo', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('hoursAgo', { n: hrs });
    return t('daysAgo', { n: Math.floor(hrs / 24) });
  }

  useEffect(() => {
    getDoc(doc(db, 'blogs', id)).then(snap => {
      if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('blogId', '==', id),
      orderBy('createdAt', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    }, () => {
      getDocs(q).then(snap =>
        setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)))
      );
    });
    return () => unsub();
  }, [id]);

  /* ── Like (works for both signed-in users and visitors) ── */
  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const ref = doc(db, 'blogs', id);

    if (user) {
      if (liked) {
        await updateDoc(ref, { likedBy: arrayRemove(user.uid) });
        setPost((p: any) => ({ ...p, likedBy: (p.likedBy ?? []).filter((u: string) => u !== user.uid) }));
      } else {
        await updateDoc(ref, { likedBy: arrayUnion(user.uid) });
        setPost((p: any) => ({ ...p, likedBy: [...(p.likedBy ?? []), user.uid] }));
      }
    } else if (visitorId) {
      if (liked) {
        await updateDoc(ref, { visitorLikes: arrayRemove(visitorId) });
        setPost((p: any) => ({ ...p, visitorLikes: (p.visitorLikes ?? []).filter((v: string) => v !== visitorId) }));
      } else {
        await updateDoc(ref, { visitorLikes: arrayUnion(visitorId) });
        setPost((p: any) => ({ ...p, visitorLikes: [...(p.visitorLikes ?? []), visitorId] }));
      }
    }
    setLiking(false);
  };

  /* ── Post comment ── */
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim() || posting) return;
    const text = commentText.trim();
    setCommentText('');
    const optimistic: Comment = {
      id: 'tmp_' + Date.now(),
      blogId: id,
      authorId:   user.uid,
      authorName: user.displayName || user.email || t('globalShaper'),
      authorRole: (user as any).role,
      content:    text,
      createdAt:  new Date().toISOString(),
    };
    setComments(prev => [...prev, optimistic]);
    setPosting(true);
    const ref = await addDoc(collection(db, 'comments'), {
      blogId: id,
      authorId:   user.uid,
      authorName: user.displayName || user.email || t('globalShaper'),
      authorRole: (user as any).role,
      content:    text,
      createdAt:  new Date().toISOString(),
    });
    setComments(prev => prev.map(c => c.id === optimistic.id ? { ...c, id: ref.id } : c));
    setPosting(false);
  };

  /* ── Delete comment ── */
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(t('confirmDeleteComment'))) return;
    setComments(prev => prev.filter(c => c.id !== commentId));
    await deleteDoc(doc(db, 'comments', commentId));
  };

  /* Translated comments header */
  function commentsHeader() {
    if (comments.length === 0) return t('commentsEmpty');
    if (comments.length === 1) return t('commentsTitle', { n: 1 });
    return t('commentsTitlePlural', { n: comments.length });
  }

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
              <div className={styles.authorAvatar}>
                {(post.authorName || t('globalShaper'))[0].toUpperCase()}
              </div>
              <div>
                <div className={styles.authorName}>{post.authorName || t('globalShaper')}</div>
                <div className={styles.authorRole}>
                  {post.authorRole?.replace('_', ' ') || t('jeddahHub')}
                </div>
              </div>
            </div>
            <div className={styles.articleDate}>{formatDate(post.createdAt, locale)}</div>
          </div>
          <div className={styles.articleBody}>
            {post.content.split('\n').map((para: string, i: number) =>
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            )}
          </div>
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
          </div>
        </article>

        <section className={styles.comments}>
          <h2 className={styles.commentsTitle}>{commentsHeader()}</h2>
          {user && (
            <form onSubmit={handleComment} className={styles.commentForm}>
              <div className={styles.commentFormRow}>
                <div className={styles.commentAvatar}>
                  {(user.displayName || user.email || t('globalShaper'))[0].toUpperCase()}
                </div>
                <textarea
                  className={styles.commentInput}
                  placeholder={t('commentPlaceholder')}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className={styles.commentFormFooter}>
                <button
                  type="submit"
                  className={styles.commentSubmit}
                  disabled={posting || !commentText.trim()}
                >
                  {posting ? t('posting') : t('postComment')}
                </button>
              </div>
            </form>
          )}
          {comments.length === 0 ? (
            <div className={styles.noComments}>
              <p>{t('noComments')} {user ? t('beFirst') : ''}</p>
            </div>
          ) : (
            <div className={styles.commentList}>
              {comments.map(c => (
                <div key={c.id} className={styles.comment}>
                  <div className={styles.commentAvatar}>
                    {(c.authorName || t('globalShaper'))[0].toUpperCase()}
                  </div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>{c.authorName}</span>
                      {c.authorRole && (
                        <span className={styles.commentRole}>{c.authorRole.replace('_', ' ')}</span>
                      )}
                      <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
                      {user && user.uid === c.authorId && (
                        <button
                          className={styles.commentDeleteBtn}
                          onClick={() => handleDeleteComment(c.id)}
                          title={t('deleteComment')}
                          type="button"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    <p className={styles.commentContent}>{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
