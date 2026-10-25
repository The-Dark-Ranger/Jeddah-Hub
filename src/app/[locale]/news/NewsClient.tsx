'use client';
/**
 * News page
 * ---------
 * Public listing of all published news articles / hub posts.
 * Posts are stored in the 'blogs' Firestore collection with status='published'.
 * Shapers write posts from the dashboard; they appear here after publishing.
 */

import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import { newsPath } from '@/lib/slug';
import { RoleLabel } from '@/lib/roleLabel';
import { useLocale, useTranslations } from 'next-intl';
import styles from './News.module.css';
import WaveDivider from '@/components/WaveDivider';

export interface NewsPost {
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

function timeAgo(iso: string, t: (key: 'timeMinutes' | 'timeHours' | 'timeDays', values: { n: number }) => string, locale: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return t('timeMinutes', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('timeHours', { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t('timeDays', { n: days });
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getExcerpt(post: NewsPost) {
  if (post.excerpt) return post.excerpt;
  return post.content.length > 200 ? post.content.slice(0, 200).trim() + '...' : post.content;
}

/** Published posts (newest first) and their authors' photos, loaded on the
 *  server (page.tsx) or in the browser. */
export interface NewsData {
  posts: NewsPost[];
  authorPhotos: Record<string, string>;
}

export default function NewsClient({ initial }: { initial?: NewsData }) {
  const t = useTranslations('NewsPage');
  const locale = useLocale();
  const [posts, setPosts] = useState<NewsPost[]>(initial?.posts ?? []);
  const [loading, setLoading] = useState(!initial);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [authorPhotos, setAuthorPhotos] = useState<Record<string, string>>(initial?.authorPhotos ?? {});

  const allTags = Array.from(new Set(posts.flatMap(p => p.tags ?? []))).slice(0, 10);

  useEffect(() => {
    if (initial) return;
    const fetchPosts = async () => {
      try {
        let data: NewsPost[] = [];
        try {
          const snap = await getDocs(query(
            collection(db, 'blogs'),
            where('status', '==', 'published'),
            orderBy('createdAt', 'desc')
          ));
          data = snap.docs.map(d => ({ id: d.id, ...d.data() } as NewsPost));
        } catch {
          // Composite index missing, query with status filter only, sort client-side
          const snap = await getDocs(query(
            collection(db, 'blogs'),
            where('status', '==', 'published')
          ));
          data = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as NewsPost))
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
        }
        setPosts(data);
        setLoading(false);

        // Match each post's initials avatar to its author's real profile
        // photo where one exists, in chunks of 30 (Firestore 'in' limit),
        // from the public mirror (no email field, safe to read publicly).
        const authorIds = Array.from(new Set(data.map(p => p.authorId).filter(Boolean)));
        if (authorIds.length > 0) {
          const chunks: string[][] = [];
          for (let i = 0; i < authorIds.length; i += 30) chunks.push(authorIds.slice(i, i + 30));
          const snaps = await Promise.all(
            chunks.map(chunk => getDocs(query(collection(db, 'public_profiles'), where(documentId(), 'in', chunk))))
          );
          const photos: Record<string, string> = {};
          snaps.forEach(s => s.docs.forEach(d => {
            const url = d.data().photoURL;
            if (url) photos[d.id] = url;
          }));
          setAuthorPhotos(photos);
        }
      } catch {
        /* Firestore unavailable, leave empty list, stop spinner */
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [initial]);

  const filtered = useMemo(() => {
    let result = posts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    if (activeTag) result = result.filter(p => p.tags?.includes(activeTag));
    return result;
  }, [search, activeTag, posts]);

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
        </div>
        <WaveDivider fill="var(--background)" className={styles.headerWave} />
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
          {/* Kept (empty) while loading so the row's height is reserved and
              the grid below doesn't jump when the tags arrive. */}
          {(loading || allTags.length > 0) && (
            <div className={styles.tags} aria-busy={loading}>
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
              <Link key={post.id} href={newsPath(post)} className={styles.card}>
                <div className={styles.cardCategory}>
                  {post.tags && post.tags.length > 0 ? post.tags[0].toUpperCase() : t('hubUpdate').toUpperCase()}
                </div>
                <h2 className={styles.cardTitle}>{post.title}</h2>
                <p className={styles.cardExcerpt}>{getExcerpt(post)}</p>
                <div className={styles.cardMeta}>
                  <div className={styles.cardAuthor}>
                    {authorPhotos[post.authorId] ? (
                      <img className={styles.cardAvatarImg} src={authorPhotos[post.authorId]} alt="" />
                    ) : (
                      <div className={styles.cardAvatar}>
                        {(post.authorName || 'S')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className={styles.cardAuthorName}>{post.authorName || t('defaultAuthor')}</div>
                      <div className={styles.cardAuthorRole}><RoleLabel role={post.authorRole} /></div>
                    </div>
                  </div>
                  <span className={styles.cardDate}>{timeAgo(post.createdAt, t, locale)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
