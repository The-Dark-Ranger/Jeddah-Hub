'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Post.module.css';

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
  const [visitorId, setVisitorId]     = useState<string | null>(null);
  const [authorPhoto, setAuthorPhoto] = useState<string | null>(null);

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

  useEffect(() => {
    getDoc(doc(db, 'blogs', id)).then(snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as any;
        setPost(data);
        // Real profile photo instead of the initials fallback, when the
        // author has one set — same public mirror the projects/about pages
        // already read from (no email field, safe to read publicly).
        if (data.authorId) {
          getDoc(doc(db, 'public_profiles', data.authorId))
            .then(pSnap => setAuthorPhoto(pSnap.exists() ? (pSnap.data() as any).photoURL || null : null))
            .catch(() => {});
        }
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  /* ── Like (works for both signed-in users and visitors) ── */
  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const ref = doc(db, 'blogs', id);

    try {
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
                  {post.authorRole?.replace('_', ' ') || t('jeddahHub')}
                </div>
              </div>
            </div>
            <div className={styles.articleDate}>{formatDate(post.createdAt, locale)}</div>
          </div>
          <div className={styles.articleBody}>
            {(post.content || '').split('\n').map((para: string, i: number) =>
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
      </div>
    </main>
  );
}
