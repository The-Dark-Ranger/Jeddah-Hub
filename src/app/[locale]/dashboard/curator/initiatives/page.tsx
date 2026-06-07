'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './Initiatives.module.css';

interface Initiative {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  category?: string;
  startDate?: string;
  imageUrl?: string;
  createdAt: string;
  members?: any[];
}

const CATEGORIES = ['Environment', 'Education', 'Health', 'Technology', 'Arts & Culture', 'Economic Empowerment', 'Other'];
const emptyForm  = { title: '', description: '', category: '', startDate: '', imageUrl: '' };

export default function ManageInitiatives() {
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [filter, setFilter]           = useState<'all' | 'active' | 'archived'>('all');
  const [showCreate, setShowCreate]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState(emptyForm);
  const [editForm, setEditForm]       = useState(emptyForm);

  const setF  = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  const setEF = (k: keyof typeof emptyForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditForm(f => ({ ...f, [k]: e.target.value }));

  const fetchAll = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'initiatives'), orderBy('createdAt', 'desc')));
      setInitiatives(snap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative)));
    } catch { /* Firestore not configured yet */ }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await addDoc(collection(db, 'initiatives'), {
      ...form, status: 'active', members: [], createdAt: new Date().toISOString(),
    });
    setForm(emptyForm);
    setShowCreate(false);
    setSaving(false);
    fetchAll();
  };

  const startEdit = (init: Initiative) => {
    setEditingId(init.id);
    setShowCreate(false);
    setEditForm({
      title: init.title, description: init.description,
      category: init.category || '', startDate: init.startDate || '', imageUrl: init.imageUrl || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.title) return;
    setSaving(true);
    await updateDoc(doc(db, 'initiatives', editingId), { ...editForm });
    setSaving(false);
    setEditingId(null);
    fetchAll();
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this initiative? It will be hidden from public view but its data is retained.')) return;
    await updateDoc(doc(db, 'initiatives', id), { status: 'archived', archivedAt: new Date().toISOString() });
    fetchAll();
  };

  const handleRestore = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), { status: 'active', archivedAt: null });
    fetchAll();
  };

  const filtered      = initiatives.filter(i => filter === 'all' || i.status === filter);
  const activeCount   = initiatives.filter(i => i.status === 'active').length;
  const archivedCount = initiatives.filter(i => i.status === 'archived').length;

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Manage Initiatives</h2>
          <p className={styles.pageSubtitle}>{activeCount} active · {archivedCount} archived</p>
        </div>
        <button className={styles.createBtn} onClick={() => { setShowCreate(v => !v); setEditingId(null); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Initiative
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className={styles.createForm}>
          <h3 className={styles.formTitle}>Create New Initiative</h3>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.label}>Title *</label>
              <input className={styles.input} value={form.title} onChange={setF('title')} placeholder="Initiative name" required />
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Category</label>
              <select className={styles.input} value={form.category} onChange={setF('category')}>
                <option value="">Select category…</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Start Date</label>
              <input className={styles.input} type="date" value={form.startDate} onChange={setF('startDate')} />
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Cover Image URL</label>
              <input className={styles.input} value={form.imageUrl} onChange={setF('imageUrl')} placeholder="https://…" />
            </div>
          </div>
          <div className={styles.formField}>
            <label className={styles.label}>Description *</label>
            <textarea className={styles.textarea} value={form.description} onChange={setF('description')}
              placeholder="What is this initiative about?" required rows={3} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className={styles.submitBtn} disabled={saving}>{saving ? 'Creating…' : 'Create Initiative'}</button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className={styles.filterBar}>
        {(['all', 'active', 'archived'] as const).map(f => (
          <button key={f} className={styles.filterBtn + (filter === f ? ' ' + styles.filterBtnActive : '')} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={styles.filterCount}>
              {f === 'all' ? initiatives.length : f === 'active' ? activeCount : archivedCount}
            </span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>No {filter === 'all' ? '' : filter} initiatives yet.
            {(filter === 'active' || filter === 'all') ? ' Click "New Initiative" to create one.' : ''}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(init => (
            <div key={init.id} className={styles.card + (init.status === 'archived' ? ' ' + styles.cardArchived : '')}>

              {/* Edit mode */}
              {editingId === init.id ? (
                <div className={styles.editForm}>
                  <p className={styles.formTitle}>Editing: {init.title}</p>
                  <div className={styles.formField}>
                    <label className={styles.label}>Title *</label>
                    <input className={styles.input} value={editForm.title} onChange={setEF('title')} required />
                  </div>
                  <div className={styles.editRow}>
                    <div className={styles.formField}>
                      <label className={styles.label}>Category</label>
                      <select className={styles.input} value={editForm.category} onChange={setEF('category')}>
                        <option value="">None</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.label}>Start Date</label>
                      <input className={styles.input} type="date" value={editForm.startDate} onChange={setEF('startDate')} />
                    </div>
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.label}>Cover Image URL</label>
                    <input className={styles.input} value={editForm.imageUrl} onChange={setEF('imageUrl')} placeholder="https://…" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.label}>Description *</label>
                    <textarea className={styles.textarea} value={editForm.description} onChange={setEF('description')} rows={3} required />
                  </div>
                  <div className={styles.editActions}>
                    <button className={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                    <button className={styles.submitBtn} onClick={handleSaveEdit} disabled={saving || !editForm.title}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>

              ) : (
                /* View mode */
                <>
                  {init.imageUrl && (
                    <div className={styles.cardImage}>
                      <img src={init.imageUrl} alt={init.title}
                        onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
                    </div>
                  )}
                  <div className={styles.cardBody}>
                    <div className={styles.cardTopRow}>
                      <span className={styles.statusPill + ' ' + (init.status === 'active' ? styles.statusActive : styles.statusArchived)}>
                        {init.status}
                      </span>
                      {init.category && <span className={styles.categoryPill}>{init.category}</span>}
                    </div>
                    <h3 className={styles.cardTitle}>{init.title}</h3>
                    <p className={styles.cardDesc}>{init.description}</p>
                    <div className={styles.cardMeta}>
                      {init.startDate && (
                        <span className={styles.metaItem}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {new Date(init.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                      <span className={styles.metaItem}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        {(init.members || []).length} member{(init.members || []).length !== 1 ? 's' : ''}
                      </span>
                      <span className={styles.metaItem}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {new Date(init.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button className={styles.editBtn} onClick={() => startEdit(init)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit
                    </button>
                    {init.status === 'active' ? (
                      <button className={styles.archiveBtn} onClick={() => handleArchive(init.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="21 8 21 21 3 21 3 8"/>
                          <rect x="1" y="3" width="22" height="5"/>
                          <line x1="10" y1="12" x2="14" y2="12"/>
                        </svg>
                        Archive
                      </button>
                    ) : (
                      <button className={styles.restoreBtn} onClick={() => handleRestore(init.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="1 4 1 10 7 10"/>
                          <path d="M3.51 15a9 9 0 1 0 .49-3.68"/>
                        </svg>
                        Restore
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
