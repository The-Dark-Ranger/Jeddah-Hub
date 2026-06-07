'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function notifySubscribers(post: BlogPost, allPosts: BlogPost[]) {
  try {
    const subSnap = await getDocs(collection(db, 'newsletter_subscribers'));
    const subscribers = subSnap.docs.map(d => (d.data().email as string)).filter(Boolean);
    if (!subscribers.length) return;

    const related = allPosts
      .filter(p => p.status === 'published' && p.id !== post.id)
      .slice(0, 2);

    await fetch('/api/newsletter/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscribers, post, relatedPosts: related }),
    });
  } catch { /* email notification is best-effort */ }
}
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
}

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

export default function BlogManager({ user }: { user: UserProfile }) {
  const isCurator = user.role === 'curator' || user.role === 'vice_curator';
  const isImpact  = user.role === 'impact_officer';
  const canPublishDirectly = isCurator || isImpact;

  const [posts, setPosts]       = useState<BlogPost[]>([]);
  const [loading, setLoading]   = useState(true);
  const [view, setView]         = useState<'list' | 'write' | 'edit'>('list');
  const [editId, setEditId]     = useState<string | null>(null);
  const [title, setTitle]       = useState('');
  const [content, setContent]   = useState('');
  const [excerpt, setExcerpt]   = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [status, setStatus]     = useState<BlogPost['status']>(canPublishDirectly ? 'published' : 'draft');
  const [saving, setSaving]     = useState(false);
  const [filter, setFilter]     = useState('all');

  const fetchPosts = async () => {
    setLoading(true);
    const q = isCurator
      ? query(collection(db, 'blogs'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'blogs'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
    setPosts(data);
    setLoading(false);
    return data;
  };

  useEffect(() => { fetchPosts(); }, []);

  const resetForm = () => {
    setTitle(''); setContent(''); setExcerpt(''); setTagsInput('');
    setStatus(canPublishDirectly ? 'published' : 'draft');
    setEditId(null);
  };

  const openEdit = (post: BlogPost) => {
    setTitle(post.title); setContent(post.content);
    setExcerpt(post.excerpt || '');
    setTagsInput((post.tags || []).join(', '));
    setStatus(post.status); setEditId(post.id);
    setView('edit');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const autoExcerpt = excerpt.trim() || content.slice(0, 160).trim() + (content.length > 160 ? '...' : '');
    const payload = {
      title: title.trim(), content: content.trim(), excerpt: autoExcerpt,
      tags, status, authorId: user.uid,
      authorName: user.displayName || user.email || 'Shaper',
      authorRole: user.role || 'shaper',
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
    const updated = await fetchPosts();
    if (status === 'published' && newPostId) {
      const newPost = updated?.find((p: BlogPost) => p.id === newPostId);
      if (newPost) notifySubscribers(newPost, updated || []);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'blogs', id));
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: BlogPost['status']) => {
    await updateDoc(doc(db, 'blogs', id), { status: newStatus });
    setPosts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status: newStatus } : p);
      if (newStatus === 'published') {
        const publishedPost = updated.find(p => p.id === id);
        if (publishedPost) notifySubscribers(publishedPost, updated);
      }
      return updated;
    });
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
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => { setView('list'); resetForm(); }}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
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
            {isCurator ? 'Manage and moderate all community posts.' : 'Write and manage your posts.'}
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
            const canEdit = isCurator || post.authorId === user.uid;
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
                  {isCurator && (
                    <div className={styles.postAuthorLine}>By: <strong>{post.authorName}</strong> · {post.authorRole?.replace('_', ' ')}</div>
                  )}
                </div>
                <div className={styles.postActions}>
                  {isCurator && post.status === 'pending_review' && (
                    <>
                      <button className={styles.approveBtn} onClick={() => handleStatusChange(post.id, 'published')}>Publish</button>
                      <button className={styles.rejectBtn} onClick={() => handleStatusChange(post.id, 'draft')}>Reject</button>
                    </>
                  )}
                  {isCurator && post.status === 'published' && (
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
