'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/lib/auth';
import { normalizeRole } from '@/lib/role';
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

export default function BlogManager({ user }: { user: UserProfile }) {
  const t = useTranslations('BlogManager');

  const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    published:      { label: t('statusPublished'), color: '#10b981' },
    draft:          { label: t('statusDraft'),      color: '#94a3b8' },
    pending_review: { label: t('statusPending'),    color: '#f59e0b' },
  };

  const timeAgo = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return t('today');
    if (days === 1) return t('yesterday');
    return t('daysAgo', { n: days });
  };

  const normRole   = normalizeRole(user.role);
  const isCurator  = normRole === 'curator' || normRole === 'vice_curator';
  const isImpact   = normRole === 'impact_officer';
  // Only curators/impact officers may publish directly — matches the
  // Firestore rule exactly, which has no way to verify initiative-lead
  // status server-side, so offering that shortcut here would just fail.
  const canPublishDirectly = isCurator || isImpact;
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
  const [saving, setSaving]     = useState(false);
  const [filter, setFilter]     = useState('all');

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
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const autoExcerpt = excerpt.trim() || content.slice(0, 160).trim() + (content.length > 160 ? '...' : '');
      const payload = {
        title: title.trim(), content: content.trim(), excerpt: autoExcerpt,
        tags, status, authorId: user.uid,
        authorName: user.displayName || user.email || 'Shaper',
        authorRole: user.role || 'shaper',
        updatedAt: new Date().toISOString(),
      };
      if (view === 'edit' && editId) {
        await updateDoc(doc(db, 'blogs', editId), payload);
      } else {
        await addDoc(collection(db, 'blogs'), { ...payload, createdAt: new Date().toISOString(), likedBy: [] });
      }
      resetForm(); setView('list');
      await fetchPosts();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await deleteDoc(doc(db, 'blogs', id));
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      alert(t('deleteFailed'));
    }
  };

  const handleStatusChange = async (id: string, newStatus: BlogPost['status']) => {
    try {
      await updateDoc(doc(db, 'blogs', id), { status: newStatus });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
    } catch (err) {
      console.error(err);
      alert(t('statusUpdateFailed'));
    }
  };

  const filtered = posts.filter(p => filter === 'all' || p.status === filter);

  /* Write / Edit form */
  if (view === 'write' || view === 'edit') {
    return (
      <div className={styles.formPage}>
        <div className={styles.formHeader}>
          <button className={styles.backBtn} onClick={() => { setView('list'); resetForm(); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            {t('back')}
          </button>
          <h2>{view === 'edit' ? t('editPostTitle') : t('newPostTitle')}</h2>
        </div>
        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('titleLabel')}</label>
            <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} required />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('contentLabel')}</label>
            <textarea className={styles.textarea} value={content} onChange={e => setContent(e.target.value)} placeholder={t('contentPlaceholder')} rows={14} required />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t('excerptLabel')} <span className={styles.labelHint}>{t('excerptHint')}</span></label>
              <textarea className={styles.textarea} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder={t('excerptPlaceholder')} rows={3} />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>{t('tagsLabel')} <span className={styles.labelHint}>{t('tagsHint')}</span></label>
              <input className={styles.input} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder={t('tagsPlaceholder')} />
              <label className={styles.label} style={{ marginTop: '1.25rem' }}>{t('statusLabel')}</label>
              <select className={styles.select} value={status} onChange={e => setStatus(e.target.value as BlogPost['status'])}>
                {canPublishDirectly && <option value="published">{t('statusPublished')}</option>}
                <option value="draft">{t('statusDraft')}</option>
                {!canPublishDirectly && <option value="pending_review">{t('statusSubmitForReview')}</option>}
              </select>
              {!canPublishDirectly && (
                <p className={styles.statusNote}>{t('statusNote')}</p>
              )}
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => { setView('list'); resetForm(); }}>{t('cancel')}</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? t('saving') : view === 'edit' ? t('saveChanges') : t('publishPost')}
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
          <h2 className={styles.pageTitle}>{t('pageTitle')}</h2>
          <p className={styles.pageSubtitle}>
            {canSeeAll ? t('subtitleAll') : t('subtitleOwn')}
          </p>
        </div>
        <button className={styles.newBtn} onClick={() => { resetForm(); setView('write'); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {t('newPostBtn')}
        </button>
      </div>

      <div className={styles.filterBar}>
        {['all', 'published', 'pending_review', 'draft'].map(f => (
          <button key={f} className={styles.filterBtn + (filter === f ? ' ' + styles.filterBtnActive : '')} onClick={() => setFilter(f)}>
            {f === 'all' ? t('filterAll') : STATUS_LABELS[f]?.label ?? f}
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
          <p>{t('emptyText')}</p>
          <button className={styles.newBtn} style={{ marginTop: '1rem' }} onClick={() => { resetForm(); setView('write'); }}>
            {t('writeFirstPost')}
          </button>
        </div>
      ) : (
        <div className={styles.postList}>
          {filtered.map(post => {
            const si = STATUS_LABELS[post.status] ?? { label: post.status, color: '#94a3b8' };
            const isOwn = post.authorId === user.uid;
            // Own posts can only be edited while still unpublished — once a
            // curator/impact officer publishes it, firestore.rules rejects
            // further author-side edits (the update rule requires
            // resource.data.status in ['draft','pending_review']), so
            // offering Edit here would just lead to a failed-save alert.
            const canEdit = canSeeAll || (isOwn && post.status !== 'published');
            const canDelete = canSeeAll || isOwn;
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
                    <div className={styles.postAuthorLine}>{t('byAuthor')} <strong>{post.authorName}</strong> · {post.authorRole?.replace('_', ' ')}</div>
                  )}
                </div>
                <div className={styles.postActions}>
                  {canSeeAll && post.status === 'pending_review' && (
                    <>
                      <button className={styles.approveBtn} onClick={() => handleStatusChange(post.id, 'published')}>{t('publishBtn')}</button>
                      <button className={styles.rejectBtn} onClick={() => handleStatusChange(post.id, 'draft')}>{t('rejectBtn')}</button>
                    </>
                  )}
                  {canSeeAll && post.status === 'published' && (
                    <button className={styles.draftBtn} onClick={() => handleStatusChange(post.id, 'draft')}>{t('unpublishBtn')}</button>
                  )}
                  {canEdit && <button className={styles.editBtn} onClick={() => openEdit(post)}>{t('editBtn')}</button>}
                  {canDelete && <button className={styles.deleteBtn} onClick={() => handleDelete(post.id)}>{t('deleteBtn')}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
