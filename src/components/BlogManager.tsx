'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/auth';
import styles from './BlogManager.module.css';

interface BlogPost {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  authorId: string;
  authorName: string;
  authorRole: string;
  status: 'draft' | 'published' | 'pending_review';
  createdAt: string;
  likedBy?: string[];
  instagramUrl?: string;
}

const INSTAGRAM_URL_RE = /^https:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/?/;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  published:      { label: 'Published', color: '#10b981' },
  draft:          { label: 'Draft',     color: '#94a3b8' },
  pending_review: { label: 'Pending',   color: '#f59e0b' },
};

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  return days + ' days ago';
}

export default function BlogManager({ user, isInitiativeLead = false }: { user: UserProfile; isInitiativeLead?: boolean }) {
  const normRole   = user.role?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const isCurator  = normRole === 'curator' || normRole === 'vice_curator';
  const isImpact   = normRole === 'impact_officer';
  const canPublishDirectly = isCurator || isImpact || isInitiativeLead;
  const canSeeAll  = isCurator;

  const [posts, setPosts]       = useState<BlogPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<'list' | 'write' | 'edit'>('list');
  const [editId, setEditId]     = useState<string | null>(null);
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [excerpt, setExcerpt]   = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus]     = useState<BlogPost['status']>(canPublishDirectly ? 'published' : 'draft');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [saving, setSaving]     = useState(false);
  const [filter, setFilter]     = useState('all');

  const instagramUrlInvalid = instagramUrl.trim() !== '' && !INSTAGRAM_URL_RE.test(instagramUrl.trim());

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const q = canSeeAll
        ? query(collection(db, 'blogs'), orderBy('createdAt', 'desc'))
        : query(collection(db, 'blogs'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
      setPosts(data);
      return data;
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const resetForm = () => {
    setTitle(''); setContent(''); setExcerpt(''); setTagsInput(''); setInstagramUrl('');
    setStatus(canPublishDirectly ? 'published' : 'draft');
    setEditId(null);
  };

  const openEdit = (post: BlogPost) => {
    setTitle(post.title); setContent(post.content);
    setExcerpt(post.excerpt || '');
    setTagsInput((post.tags || []).join(', '));
    setInstagramUrl(post.instagramUrl || '');
    setStatus(post.status); setEditId(post.id);
    setView('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || instagramUrlInvalid) return;
    setSaving(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const autoExcerpt = excerpt.trim() || content.slice(0, 160).trim() + (content.length > 160 ? '...' : '');
    const cleanInstagramUrl = instagramUrl.trim();
    const payload = {
      title: title.trim(), content: content.trim(), excerpt: autoExcerpt,
      tags, status, authorId: user.uid,
      authorName: user.displayName || user.email || 'Shaper',
      authorRole: user.role || 'shaper',
      instagramUrl: cleanInstagramUrl || null,
      updatedAt: new Date().toISOString(),
    };
    let newPostId: string | null = null;
    if (view === 'edit' && editId) {
      await updateDoc(doc(db, 'blogs', editId), payload);
    } else {
      const ref = await addDoc(collection(db, 'blogs'), { ...payload, createdAt: new Date().toISOString(), likedBy: [] });
      newPostId = ref.id;
    }
    setSaving(false); resetForm(); setView('list');
    await fetchPosts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'blogs', id));
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: BlogPost['status']) => {
    await updateDoc(doc(db, 'blogs', id), { status: newStatus });
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const filtered = posts.filter(p => filter === 'all' || p.status === filter);

  /* Write / Edit form */
  if (view === 'write' || view === 'edit') {
    return (
      <div className={styles.formPage}>
        <div className={styles.formHeader}>
          <button className={styles.backBtn} onClick={() => { setView('list'); resetForm(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <h2>{view === 'edit' ? 'Edit Post' : 'New Post'}</h2>
        </div>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Title *</label>
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your post a compelling title..." required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Content *</label>
            <textarea className={styles.textarea} value={content} onChange={e => setContent(e.target.value)} placeholder="Write your post here..." rows={14} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Excerpt <span className={styles.labelHint}>(auto-generated if empty)</span></label>
              <textarea className={styles.textarea} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Short summary..." rows={3} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Tags <span className={styles.labelHint}>(comma-separated)</span></label>
              <input className={styles.input} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="Education, Sustainability" />
              <label className={styles.label} style={{ marginTop: '1.25rem' }}>Status</label>
              <select className={styles.select} value={status} onChange={e => setStatus(e.target.value as BlogPost['status'])}>
                {canPublishDirectly && <option value="published">Published</option>}
                <option value="draft">Draft</option>
                {!canPublishDirectly && <option value="pending_review">Submit for Review</option>}
              </select>
              {!canPublishDirectly && (
                <p className={styles.statusNote}>Posts submitted for review will be published by a Curator.</p>
              )}
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Instagram post <span className={styles.labelHint}>(optional — embeds a post or reel in the article)</span>
            </label>
            <input
              className={styles.input}
              value={instagramUrl}
              onChange={e => setInstagramUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              type="url"
              aria-invalid={instagramUrlInvalid}
            />
            {instagramUrlInvalid && (
              <p className={styles.statusNote} style={{ color: 'var(--danger)' }}>
                Paste a link to a specific Instagram post or reel (instagram.com/p/... or /reel/...).
              </p>
            )}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => { setView('list'); resetForm(); }}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={saving || instagramUrlInvalid}>
              {saving ? 'Saving...' : view === 'edit' ? 'Save Changes' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* List view */
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Blog Portal</h2>
          <p className={styles.pageSubtitle}>
            {canSeeAll ? 'Manage and moderate all community posts.' : 'Write and manage your posts.'}
          </p>
        </div>
        <button className={styles.newBtn} onClick={() => { resetForm(); setView('write'); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Post
        </button>
      </div>

      <div className={styles.filterBar}>
        {['all', 'published', 'pending_review', 'draft'].map(f => (
          <button key={f} className={styles.filterBtn + (filter === f ? ' ' + styles.filterBtnActive : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]?.label ?? f}
            <span className={styles.filterCount}>
              {f === 'all' ? posts.length : posts.filter(p => p.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>✍️</div>
          <p>No posts here yet.</p>
          <button className={styles.newBtn} style={{ marginTop: '1rem' }} onClick={() => { resetForm(); setView('write'); }}>
            Write your first post
          </button>
        </div>
      ) : (
        <div className={styles.postList}>
          {filtered.map(post => {
            const si = STATUS_LABELS[post.status] ?? { label: post.status, color: '#94a3b8' };
            const canEdit = canSeeAll || post.authorId === user.uid;
            return (
              <div key={post.id} className={styles.postItem}>
                <div className={styles.postMain}>
                  <div className={styles.postTopRow}>
                    <span className={styles.postStatus} style={{ color: si.color, borderColor: si.color }}>{si.label}</span>
                    <span className={styles.postDate}>{timeAgo(post.createdAt)}</span>
                  </div>
                  <h3 className={styles.postTitle}>{post.title}</h3>
                  <p className={styles.postExcerpt}>{(post.excerpt || post.content).slice(0, 120)}...</p>
                  {post.tags && post.tags.length > 0 && (
                    <div className={styles.postTags}>
                      {post.tags.slice(0, 3).map(tag => <span key={tag} className={styles.postTag}>{tag}</span>)}
                    </div>
                  )}
                  {canSeeAll && (
                    <div className={styles.postAuthorLine}>By: <strong>{post.authorName}</strong> · {post.authorRole?.replace('_', ' ')}</div>
                  )}
                </div>
                <div className={styles.postActions}>
                  {canSeeAll && post.status === 'pending_review' && (
                    <>
                      <button className={styles.approveBtn} onClick={() => handleStatusChange(post.id, 'published')}>Publish</button>
                      <button className={styles.rejectBtn} onClick={() => handleStatusChange(post.id, 'draft')}>Reject</button>
                    </>
                  )}
                  {canSeeAll && post.status === 'published' && (
                    <button className={styles.draftBtn} onClick={() => handleStatusChange(post.id, 'draft')}>Unpublish</button>
                  )}
                  {canEdit && <button className={styles.editBtn} onClick={() => openEdit(post)}>Edit</button>}
                  {canEdit && <button className={styles.deleteBtn} onClick={() => handleDelete(post.id)}>Delete</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
