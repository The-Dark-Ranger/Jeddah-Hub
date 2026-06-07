'use client';
/**
 * News page
 * ---------
 * Public listing of all published news articles / hub posts.
 * Posts are stored in the 'blogs' Firestore collection with status='published'.
 * Shapers write posts from the dashboard; they appear here after publishing.
 */

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import styles from './News.module.css';

interface NewsPost {
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

function getExcerpt(post: NewsPost) {
  if (post.excerpt) return post.excerpt;
  return post.content.length > 200 ? post.content.slice(0, 200).trim() + '...' : post.content;
}

export default function NewsPage() {
  const t = useTranslations('NewsPage');
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [filtered, setFiltered] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags ?? []))).slice(0, 10);

  useEffect(() => {
    const fetchPosts = async () => {
      const q = query(
        collection(db, 'blogs'),
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc')
      );
      try {
        const snap = await getDocs(q);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsPost));
        setPosts(data);
        setFiltered(data);
      } catch {
        const fallback = await getDocs(query(collection(db, 'blogs'), orderBy('createdAt', 'desc')));
        const data = fallback.docs.map(d => ({ id: d.id, ...d.data() } as NewsPost));
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
    if (activeTag) result = result.filter(p => p.tags?.includes(activeTag));
    setFiltered(result);
  }, [search, activeTag, posts]);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
        </div>
      </section>

      <div className={styles.container}>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className={styles.searchInput}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {allTags.length > 0 && (
            <div className={styles.tags}>
              <button className={styles.tag + (!activeTag ? ' ' + styles.tagActive : '')} onClick={() => setActiveTag('')}>{t('tagAll')}</button>
              {allTags.map(tag => (
                <button key={tag} className={styles.tag + (activeTag === tag ? ' ' + styles.tagActive : '')} onClick={() => setActiveTag(tag === activeTag ? '' : tag)}>{tag}</button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <h3>{t('noArticlesTitle')}</h3>
            <p>{search || activeTag ? t('noArticlesSearch') : t('noArticlesSoon')}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map(post => (
              <Link key={post.id} href={`/news/${post.id}`} className={styles.card}>
                <div className={styles.cardCategory}>
                  {post.tags && post.tags.length > 0 ? post.tags[0].toUpperCase() : t('hubUpdate').toUpperCase()}
                </div>
                <h2 className={styles.cardTitle}>{post.title}</h2>
                <p className={styles.cardExcerpt}>{getExcerpt(post)}</p>
                <div className={styles.cardMeta}>
                  <div className={styles.cardAuthor}>
                    <div className={styles.cardAvatar}>
                      {(post.authorName || 'S')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.cardAuthorName}>{post.authorName || t('defaultAuthor')}</div>
                      <div className={styles.cardAuthorRole}>{post.authorRole?.replace('_', ' ')}</div>
                    </div>
                  </div>
                  <span className={styles.cardDate}>{timeAgo(post.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
