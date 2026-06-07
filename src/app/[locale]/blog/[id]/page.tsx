'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, addDoc, query, where, orderBy, getDocs, onSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/routing';
import styles from './Post.module.css';

interface Comment {
  id: string;
  blogId: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  content: string;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function BlogPostPage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const liked = user ? (post?.likedBy ?? []).includes(user.uid) : false;
  const likeCount = post?.likedBy?.length ?? post?.likes ?? 0;

  // Fetch post
  useEffect(() => {
    const fetchPost = async () => {
      const ref = doc(db, 'blogs', id);
      const snap = await getDoc(ref);
      if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
      setLoading(false);
    };
    fetchPost();
  }, [id]);

  // Live comments
  useEffect(() => {
    const q = query(
      collection(db, 'comments'),
      where('blogId', '==', id),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
    }, () => {
      // Fallback: fetch once
      getDocs(q).then(snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Comment))));
    });
    return () => unsub();
  }, [id]);

  const handleLike = async () => {
    if (!user || liking) return;
    setLiking(true);
    const ref = doc(db, 'blogs', id);
    try {
      if (liked) {
        await updateDoc(ref, { likedBy: arrayRemove(user.uid) });
        setPost((p: any) => ({ ...p, likedBy: (p.likedBy ?? []).filter((u: string) => u !== user.uid) }));
      } else {
        await updateDoc(ref, { likedBy: arrayUnion(user.uid) });
        setPost((p: any) => ({ ...p, likedBy: [...(p.likedBy ?? []), user.uid] }));
      }
    } finally {
      setLiking(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim() || posting) return;
    setPosting(true);
    await addDoc(collection(db, 'comments'), {
      blogId: id,
      authorId: user.uid,
      authorName: user.displayName || user.email || 'Shaper',
      authorRole: user.role,
      content: commentText.trim(),
      createdAt: new Date().toISOString(),
    });
    setCommentText('');
    setPosting(false);
  };

  if (loading) return (
    <div className={styles.loadingScreen}>
      <div className={styles.spinner} />
    </div>
  );

  if (!post) return (
    <div className={styles.notFound}>
      <h2>Post not found</h2>
      <Link href="/blog" className={styles.backLink}>← Back to Blog</Link>
    </div>
  );

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/blog" className={styles.back}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Blog
        </Link>

        <article className={styles.article}>
          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className={styles.articleTags}>
              {post.tags.map((tag: string) => (
                <span key={tag} className={styles.articleTag}>{tag}</span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className={styles.articleTitle}>{post.title}</h1>

          {/* Meta */}
          <div className={styles.articleMeta}>
            <div className={styles.authorCard}>
              <div className={styles.authorAvatar}>
                {(post.authorName || post.authorRole || 'S')[0].toUpperCase()}
              </div>
              <div>
                <div className={styles.authorName}>{post.authorName || 'Global Shaper'}</div>
                <div className={styles.authorRole}>{post.authorRole?.replace('_', ' ') || 'Jeddah Hub'}</div>
              </div>
            </div>
            <div className={styles.articleDate}>
              {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Body */}
          <div className={styles.articleBody}>
            {post.content.split('\n').map((para: string, i: number) =>
              para.trim() ? <p key={i}>{para}</p> : <br key={i} />
            )}
          </div>

          {/* Like button */}
          <div className={styles.articleActions}>
            <button
              className={`${styles.likeBtn} ${liked ? styles.likeBtnActive : ''}`}
              onClick={handleLike}
              disabled={!user || liking}
              title={user ? (liked ? 'Unlike' : 'Like this post') : 'Sign in to like'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              {likeCount > 0 ? likeCount : ''} {likeCount === 1 ? 'Like' : 'Likes'}
            </button>
            {!user && (
              <p className={styles.signInHint}>
                <Link href="/login">Sign in</Link> to like and comment.
              </p>
            )}
          </div>
        </article>

        {/* Comments */}
        <section className={styles.comments}>
          <h2 className={styles.commentsTitle}>
            {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
          </h2>

          {user && (
            <form onSubmit={handleComment} className={styles.commentForm}>
              <div className={styles.commentFormHeader}>
                <div className={styles.commentAvatar}>
                  {(user.displayName || user.email || 'S')[0].toUpperCase()}
                </div>
                <textarea
                  className={styles.commentInput}
                  placeholder="Share your thoughts…"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={3}
                  required
                />
              </div>
              <div className={styles.commentFormFooter}>
                <button type="submit" className={styles.commentSubmit} disabled={posting || !commentText.trim()}>
                  {posting ? 'Posting…' : 'Post Comment'}
                </button>
              </div>
            </form>
          )}

          {comments.length === 0 ? (
            <div className={styles.noComments}>
              <span>💬</span>
              <p>No comments yet. {user ? 'Be the first!' : ''}</p>
            </div>
          ) : (
            <div className={styles.commentList}>
              {comments.map(c => (
                <div key={c.id} className={styles.comment}>
                  <div className={styles.commentAvatar}>
                    {(c.authorName || 'S')[0].toUpperCase()}
                  </div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentHeader}>
                      <span className={styles.commentAuthor}>{c.authorName}</span>
                      {c.authorRole && (
                        <span className={styles.commentRole}>{c.authorRole.replace('_', ' ')}</span>
                      )}
                      <span className={styles.commentTime}>{timeAgo(c.createdAt)}</span>
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
