'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, orderBy, arrayUnion, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import { downloadInitiativeReport } from '@/lib/exportInitiative';
import ImageUploader from '@/components/ImageUploader';
import ModalPortal from '@/components/ModalPortal';
import styles from './Projects.module.css';

interface Member { userId: string; role: string; }

interface Initiative {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  category?: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  images?: string[];
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  createdAt: string;
  members?: Member[];
}

interface UserRecord { id: string; displayName?: string; email?: string; }

const CATEGORIES = [
  'Environment', 'Education', 'Health', 'Technology',
  'Arts & Culture', 'Economic Empowerment', 'Community', 'Wellbeing', 'Economy', 'Other',
];

const emptyForm = {
  title: '', description: '', category: '', startDate: '', endDate: '',
  imageUrl: '', images: '', stat: '', problem: '', objective: '', impact: '', impactAreas: '',
};
type FormShape = typeof emptyForm;

/* ── Form fields (defined outside to prevent re-mount) ── */
function FormFields({ form, onChange }: { form: FormShape; onChange: (k: keyof FormShape, v: string) => void }) {
  const t  = useTranslations('Dashboard');
  const mk = (k: keyof FormShape) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(k, e.target.value);

  return (
    <>
      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldTitle')} *</label>
        <input className={styles.input} value={form.title} onChange={mk('title')} placeholder={t('phInitiativeName')} required />
      </div>

      <div className={styles.editRow3}>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldCategory')}</label>
          <select className={styles.input} value={form.category} onChange={mk('category')}>
            <option value="">{t('categorySelectPrompt')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldStartDate')}</label>
          <input className={styles.input} type="date" value={form.startDate} onChange={mk('startDate')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldEndDate')}</label>
          <input className={styles.input} type="date" value={form.endDate} onChange={mk('endDate')} />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldKeyStat')}</label>
        <input className={styles.input} value={form.stat} onChange={mk('stat')} placeholder={t('phStat')} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldDescription')} *</label>
        <textarea className={styles.textarea} value={form.description} onChange={mk('description')} placeholder={t('phDescription')} required rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldProblem')}</label>
        <textarea className={styles.textarea} value={form.problem} onChange={mk('problem')} placeholder={t('phProblem')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldObjective')}</label>
        <textarea className={styles.textarea} value={form.objective} onChange={mk('objective')} placeholder={t('phObjective')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldImpact')}</label>
        <textarea className={styles.textarea} value={form.impact} onChange={mk('impact')} placeholder={t('phImpact')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>
          {t('fieldImpactAreas')}
          <span className={styles.fieldHint}>{t('fieldImpactAreasHint')}</span>
        </label>
        <input className={styles.input} value={form.impactAreas} onChange={mk('impactAreas')} placeholder={t('phImpactAreas')} />
      </div>

      <ImageUploader coverUrl={form.imageUrl} photos={form.images} onChange={onChange} />
    </>
  );
}

/* ── Main page ── */
export default function ImpactProjects() {
  const { user } = useAuth();
  const t        = useTranslations('Dashboard');
  const locale   = useLocale();

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [users, setUsers]             = useState<UserRecord[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [filter, setFilter]           = useState<'all' | 'active' | 'archived'>('all');

  /* Modal state */
  const [modalMode, setModalMode]       = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [form, setForm]                 = useState<FormShape>(emptyForm);

  /* Team panel state — tracks which card has the team panel open */
  const [teamOpenId, setTeamOpenId]     = useState<string | null>(null);
  const [assignUser, setAssignUser]     = useState('');
  const [assignRole, setAssignRole]     = useState('');
  const [assigning, setAssigning]       = useState(false);

  const role      = user?.role?.toLowerCase().replace(/\s+/g, '_') ?? '';
  const canManage = role === 'curator' || role === 'vice_curator' || role === 'impact_officer';

  const handleFormChange = useCallback((key: keyof FormShape, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [initSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'initiatives'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
      ]);
      setInitiatives(initSnap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative)));
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord)));
    } catch { /* Firestore not configured */ }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── Modal helpers ── */
  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditingTitle('');
    setModalMode('create');
  };

  const openEdit = (init: Initiative) => {
    setEditingId(init.id);
    setEditingTitle(init.title);
    setForm({
      title:       init.title,
      description: init.description,
      category:    init.category    || '',
      startDate:   init.startDate   || '',
      endDate:     init.endDate     || '',
      imageUrl:    init.imageUrl    || '',
      images:      (init.images     || []).join('\n'),
      stat:        init.stat        || '',
      problem:     init.problem     || '',
      objective:   init.objective   || '',
      impact:      init.impact      || '',
      impactAreas: (init.impactAreas || []).join(', '),
    });
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditingId(null); setEditingTitle(''); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (modalMode) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalMode]);

  useEffect(() => {
    document.body.style.overflow = modalMode ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalMode]);

  /* ── Serialise form → Firestore doc ── */
  const formToDoc = (f: FormShape) => ({
    title: f.title, description: f.description, category: f.category,
    startDate: f.startDate, endDate: f.endDate, imageUrl: f.imageUrl,
    images:      f.images      ? f.images.split('\n').map(s => s.trim()).filter(Boolean) : [],
    stat:        f.stat,
    problem:     f.problem,
    objective:   f.objective,
    impact:      f.impact,
    impactAreas: f.impactAreas ? f.impactAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
  });

  /* ── CRUD ── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'initiatives'), {
        ...formToDoc(form), status: 'active', members: [], createdAt: new Date().toISOString(),
      });
      closeModal(); fetchAll();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.title) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'initiatives', editingId), formToDoc(form));
      closeModal(); fetchAll();
    } catch (err: any) {
      alert(`${t('saveFailed')} ${err?.code || err?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  /* Notify all curators and vice curators about an archive/restore action */
  const notifyCurators = async (type: 'archive_request' | 'restore_request', initiativeId: string, initiativeTitle: string, message: string) => {
    try {
      // Query actual curator accounts directly rather than role_assignments'
      // status=='joined' flag — that transition requires an update Firestore
      // rule for role_assignments that this app deliberately doesn't grant,
      // so it never fires and that query would always return zero curators.
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['curator', 'vice_curator', 'vice curator'])),
      );
      const curators = usersSnap.docs
        .map(d => d.data())
        .filter(d => d.email);

      await Promise.all(curators.map(c =>
        addDoc(collection(db, 'notifications'), {
          type,
          initiativeId,
          initiativeTitle,
          fromUserId: user?.uid,
          fromUserName: user?.displayName || user?.email || 'Impact Officer',
          toEmail: c.email,
          message,
          read: false,
          createdAt: new Date().toISOString(),
        }),
      ));
    } catch { /* notifications optional */ }
  };

  const handleArchive = async (id: string) => {
    if (!confirm(t('archiveInitiativeConfirm'))) return;
    const init = initiatives.find(i => i.id === id);
    try {
      await updateDoc(doc(db, 'initiatives', id), { status: 'archived', archivedAt: new Date().toISOString() });
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
      return;
    }

    await notifyCurators(
      'archive_request',
      id,
      init?.title || id,
      `${user?.displayName || 'Impact Officer'} archived the project "${init?.title}".`,
    );

    await fetchAll();
  };

  const handleRestore = async (id: string) => {
    const init = initiatives.find(i => i.id === id);
    try {
      await updateDoc(doc(db, 'initiatives', id), { status: 'active', archivedAt: null });
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
      return;
    }

    await notifyCurators(
      'restore_request',
      id,
      init?.title || id,
      `${user?.displayName || 'Impact Officer'} restored the project "${init?.title}" from archive.`,
    );

    await fetchAll();
  };

  /* ── Team / shaper assignment ── */
  const toggleTeam = (id: string) => {
    setTeamOpenId(prev => prev === id ? null : id);
    setAssignUser('');
    setAssignRole('');
  };

  const handleAssign = async (initiativeId: string) => {
    if (!assignUser) return;
    setAssigning(true);
    try {
      await updateDoc(doc(db, 'initiatives', initiativeId), {
        members: arrayUnion({ userId: assignUser, role: assignRole.trim() || 'Member' }),
      });
      setAssignUser('');
      setAssignRole('');
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveMember = async (initiativeId: string, userId: string) => {
    if (!confirm(t('confirmRemoveMember'))) return;
    const init = initiatives.find(i => i.id === initiativeId);
    if (!init) return;
    try {
      const updated = (init.members || []).filter(m => m.userId !== userId);
      await updateDoc(doc(db, 'initiatives', initiativeId), { members: updated });
      await fetchAll();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const getUserLabel = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.displayName || u?.email || userId;
  };

  const unassignedUsers = (init: Initiative) =>
    users.filter(u => !(init.members || []).some(m => m.userId === u.id));

  const getMemberNames = (init: Initiative) =>
    Object.fromEntries((init.members || []).map(m => [m.userId, getUserLabel(m.userId)]));

  const filtered      = initiatives.filter(i => filter === 'all' || i.status === filter);
  const activeCount   = initiatives.filter(i => i.status === 'active').length;
  const archivedCount = initiatives.filter(i => i.status === 'archived').length;

  const isCreate = modalMode === 'create';

  if (!canManage) return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>
  );

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('impactProjectsTitle')}</h2>
          <p className={styles.pageSubtitle}>
            {activeCount} {t('filterActive').toLowerCase()} · {archivedCount} {t('filterArchived').toLowerCase()}
          </p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('newProjectBtn')}
        </button>
      </div>

      {/* Modal */}
      {modalMode !== null && (
        <ModalPortal>
        <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <form className={styles.modal} onSubmit={isCreate ? handleCreate : handleSaveEdit}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {isCreate ? t('createProject') : `${t('editInitiativeTitle')}: ${editingTitle}`}
              </h3>
              <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <FormFields form={form} onChange={handleFormChange} />
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>{t('cancel')}</button>
              <button type="submit" className={styles.submitBtn} disabled={saving || !form.title}>
                {saving
                  ? (isCreate ? t('creatingDots') : t('savingDots'))
                  : (isCreate ? t('createProjectBtn') : t('saveChangesBtn'))
                }
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {/* Filter tabs */}
      <div className={styles.filterBar}>
        {([
          { key: 'all',      label: t('filterAll'),      count: initiatives.length },
          { key: 'active',   label: t('filterActive'),   count: activeCount },
          { key: 'archived', label: t('filterArchived'), count: archivedCount },
        ] as const).map(f => (
          <button
            key={f.key}
            className={styles.filterBtn + (filter === f.key ? ' ' + styles.filterBtnActive : '')}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className={styles.filterCount}>{f.count}</span>
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
          <p>{t('noInitiativesYet')}</p>
          {filter === 'active' && (
            <button className={styles.createBtn} onClick={openCreate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t('newProjectBtn')}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(init => {
            const members     = init.members || [];
            const teamOpen    = teamOpenId === init.id;
            const available   = unassignedUsers(init);

            return (
              <div key={init.id} className={styles.card + (init.status === 'archived' ? ' ' + styles.cardArchived : '')}>

                {init.imageUrl && (
                  <div className={styles.cardImage}>
                    <img
                      src={init.imageUrl}
                      alt={init.title}
                      loading="lazy"
                      decoding="async"
                      onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                    />
                  </div>
                )}

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <span className={styles.statusPill + ' ' + (init.status === 'active' ? styles.statusActive : styles.statusArchived)}>
                      {init.status === 'active' ? t('statusActive') : t('statusArchived')}
                    </span>
                    {init.category && <span className={styles.categoryPill}>{init.category}</span>}
                  </div>
                  <h3 className={styles.cardTitle}>{init.title}</h3>
                  <p className={styles.cardDesc}>{init.description}</p>
                  {init.stat && <p className={styles.cardStat}>{init.stat}</p>}
                  <div className={styles.cardMeta}>
                    {init.startDate && (
                      <span className={styles.metaItem}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        {new Date(init.startDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', year: 'numeric' })}
                        {init.endDate && ` → ${new Date(init.endDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', year: 'numeric' })}`}
                      </span>
                    )}
                    <span className={styles.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      {members.length} {t('membersLabel')}
                    </span>
                  </div>
                </div>

                {/* Action bar */}
                <div className={styles.cardActions}>
                  <button className={styles.editBtn} onClick={() => openEdit(init)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    {t('editLabel')}
                  </button>

                  <button
                    className={styles.teamBtn + (teamOpen ? ' ' + styles.teamBtnOpen : '')}
                    onClick={() => toggleTeam(init.id)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {t('teamLabel')} ({members.length})
                  </button>

                  <button
                    className={styles.downloadBtn}
                    onClick={() => void downloadInitiativeReport(init as any, getMemberNames(init))}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {t('downloadReport')}
                  </button>

                  {init.status === 'active' ? (
                    <button className={styles.archiveBtn} onClick={() => handleArchive(init.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="21 8 21 21 3 21 3 8"/>
                        <rect x="1" y="3" width="22" height="5"/>
                        <line x1="10" y1="12" x2="14" y2="12"/>
                      </svg>
                      {t('archiveLabel')} · {t('notifyCurator')}
                    </button>
                  ) : (
                    <button className={styles.restoreBtn} onClick={() => handleRestore(init.id)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 .49-3.68"/>
                      </svg>
                      {t('restoreLabel')} · {t('notifyCurator')}
                    </button>
                  )}
                </div>

                {/* Team panel */}
                {teamOpen && (
                  <div className={styles.teamPanel}>
                    <p className={styles.teamPanelTitle}>{t('assignShapers')}</p>

                    {/* Assign row */}
                    <div className={styles.teamAssignRow}>
                      <select
                        value={assignUser}
                        onChange={e => setAssignUser(e.target.value)}
                        className={styles.teamSelect}
                      >
                        <option value="">{t('selectShaper')}</option>
                        {available.map(u => (
                          <option key={u.id} value={u.id}>{u.displayName || u.email || u.id}</option>
                        ))}
                      </select>
                      <input
                        value={assignRole}
                        onChange={e => setAssignRole(e.target.value)}
                        placeholder={t('tempRolePlaceholder')}
                        className={styles.teamRoleInput}
                      />
                      <button
                        className={styles.assignBtn}
                        onClick={() => handleAssign(init.id)}
                        disabled={!assignUser || assigning}
                      >
                        {assigning ? '…' : t('addToTeam')}
                      </button>
                    </div>

                    {/* Member list */}
                    {members.length === 0 ? (
                      <p className={styles.noTeamMsg}>{t('noTeamMembers')}</p>
                    ) : (
                      <div className={styles.memberList}>
                        {members.map((m, idx) => (
                          <div key={m.userId + idx} className={styles.memberRow}>
                            <span className={styles.memberName}>{getUserLabel(m.userId)}</span>
                            <span className={styles.memberRole}>{m.role || 'Member'}</span>
                            <button
                              className={styles.removeBtn}
                              onClick={() => handleRemoveMember(init.id, m.userId)}
                            >
                              {t('removeMember')}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
