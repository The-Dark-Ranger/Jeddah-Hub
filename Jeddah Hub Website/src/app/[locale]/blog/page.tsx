'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import styles from './Blog.module.css';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  authorId: string;
  authorName?: string;
  authorRole?: string;
  tags?: string[];
  status: string;
  likes?: number;
  createdAt: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getExcerpt(post: BlogPost) {
  if (post.excerpt) return post.excerpt;
  return post.content.length > 180 ? post.content.slice(0, 180).trim() + '…' : post.content;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [filtered, setFiltered] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags ?? []))).slice(0, 12);

  useEffect(() => {
    const fetchPosts = async () => {
      const q = query(
        collection(db, 'blogs'),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      try {
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
        setPosts(data);
        setFiltered(data);
      } catch {
        // Fallback without status filter (for older docs)
        const fallback = await getDocs(query(collection(db, 'blogs'), orderBy('createdAt', 'desc')));
        const data = fallback.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
        setPosts(data);
        setFiltered(data);
      }
      setLoading(false);
    };
    fetchPosts();
  }, []);

  useEffect(() => {
    let result = posts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    if (activeTag) {
      result = result.filter(p => p.tags?.includes(activeTag));
    }
    setFiltered(result);
  }, [search, activeTag, posts]);

  return (
    <main className={styles.page}>
      {/* Header */}
      <section className={styles.header}>
        <div className={styles.headerOrb} />
        <div className={styles.headerContent}>
          <div className={styles.headerBadge}>Community Blog</div>
          <h1 className={styles.headerTitle}>Voices from the Hub</h1>
          <p className={styles.headerSubtitle}>
            Thoughts, stories, and insights from our Global Shapers community.
          </p>
        </div>
      </section>

      <div className={styles.container}>
        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className={styles.searchInput}
              placeholder="Search posts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {allTags.length > 0 && (
            <div className={styles.tags}>
              <button
                className={`${styles.tag} ${!activeTag ? styles.tagActive : ''}`}
                onClick={() => setActiveTag('')}
              >All</button>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`${styles.tag} ${activeTag === tag ? styles.tagActive : ''}`}
                  onClick={() => setActiveTag(tag === activeTag ? '' : tag)}
                >{tag}</button>
              ))}
            </div>
          )}
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <p>Loading posts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✍️</div>
            <h3>No posts found</h3>
            <p>{search || activeTag ? 'Try a different search or tag.' : 'No blog posts have been published yet.'}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((post, i) => (
              <Link key={post.id} href={`/blog/${post.id}`} className={styles.card}>
                <div className={styles.cardGradient} style={{ background: CARD_GRADIENTS[i % CARD_GRADIENTS.length] }}>
                  <div className={styles.cardEmoji}>{POST_EMOJIS[i % POST_EMOJIS.length]}</div>
                </div>
                <div className={styles.cardBody}>
                  {post.tags && post.tags.length > 0 && (
                    <div className={styles.cardTags}>
                      {post.tags.slice(0, 2).map(tag => (
                        <span key={tag} className={styles.cardTag}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <h2 className={styles.cardTitle}>{post.title}</h2>
                  <p className={styles.cardExcerpt}>{getExcerpt(post)}</p>
                  <div className={styles.cardMeta}>
                    <div className={styles.cardAuthor}>
                      <div className={styles.cardAvatar}>
                        {(post.authorName || post.authorRole || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className={styles.cardAuthorName}>{post.authorName || 'Shaper'}</div>
                        <div className={styles.cardAuthorRole}>{post.authorRole?.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div className={styles.cardRight}>
                      <span className={styles.cardDate}>{timeAgo(post.createdAt)}</span>
                      {(post.likes ?? 0) > 0 && (
                        <span className={styles.cardLikes}>♥ {post.likes}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

const CARD_GRADIENTS = [
  'linear-gradient(135deg, #0f5a9f 0%, #1a7fd4 100%)',
  'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
  'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
  'linear-gradient(135deg, #0891b2 0%, #22d3ee 100%)',
];

const POST_EMOJIS = ['💡', '🌍', '🚀', '🤝', '📚', '🌱', '✨', '💬'];
