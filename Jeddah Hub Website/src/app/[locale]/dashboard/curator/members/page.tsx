'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Members.module.css';

type UserRole = 'curator' | 'vice_curator' | 'impact_officer' | 'shaper' | 'alumni';

interface RoleAssignment {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
  note?: string;
}

const ROLE_COLORS: Record<string, string> = {
  curator:        'var(--primary-blue)',
  vice_curator:   '#7c3aed',
  impact_officer: '#10b981',
  shaper:         '#f59e0b',
  alumni:         '#94a3b8',
};

export default function MembersPage() {
  const { user } = useAuth();
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('shaper');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCurator = user?.role === 'curator' || user?.role === 'vice_curator';

  const ROLES: { value: UserRole; label: string }[] = [
    { value: 'curator',        label: t('roleLabelCurator') },
    { value: 'vice_curator',   label: t('roleLabelViceCurator') },
    { value: 'impact_officer', label: t('roleLabelImpactOfficer') },
    { value: 'shaper',         label: t('roleLabelShaper') },
    { value: 'alumni',         label: t('roleLabelAlumni') },
  ];

  const fetchAssignments = async () => {
    setLoading(true);
    const snap = await getDocs(query(collection(db, 'role_assignments'), orderBy('createdAt', 'desc')));
    setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoleAssignment)));
    setLoading(false);
  };

  useEffect(() => { fetchAssignments(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const emailLower = email.toLowerCase().trim();
    if (assignments.some(a => a.email === emailLower)) {
      setError(t('emailAlreadyAssigned'));
      return;
    }
    setSaving(true); setError('');
    await addDoc(collection(db, 'role_assignments'), {
      email: emailLower,
      role,
      note: note.trim(),
      createdAt: new Date().toISOString(),
      addedBy: user?.email,
    });
    setEmail(''); setNote(''); setRole('shaper');
    setSaving(false);
    fetchAssignments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmRemove'))) return;
    await deleteDoc(doc(db, 'role_assignments', id));
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  if (!isCurator) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{t('roleAssignmentsTitle')}</h2>
          <p className={styles.subtitle}>{t('roleAssignmentsSubtitle')}</p>
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAdd} className={styles.form}>
        <h3 className={styles.formTitle}>{t('addRoleAssignment')}</h3>
        {error && <div className={styles.errorMsg}>{error}</div>}
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('emailAddress')} *</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="shaper@example.com"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('colRole')} *</label>
            <select className={styles.select} value={role} onChange={e => setRole(e.target.value as UserRole)}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('noteOptional')} <span className={styles.optional}>{t('optional')}</span></label>
            <input
              className={styles.input}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={locale === 'ar' ? 'مثال: صانع قادم 2026' : 'e.g. Incoming Shaper 2026'}
            />
          </div>
        </div>
        <button type="submit" className={styles.addBtn} disabled={saving}>
          {saving ? t('addingDots') : t('addAssignment')}
        </button>
      </form>

      {/* Table */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span>{t('assignmentsLabel')}</span>
          <span className={styles.count}>{assignments.length}</span>
        </div>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : assignments.length === 0 ? (
          <div className={styles.empty}>{t('noAssignments')}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('colEmail')}</th>
                <th>{t('colRole')}</th>
                <th>{t('colNote')}</th>
                <th>{t('colAdded')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id}>
                  <td className={styles.emailCell}>{a.email}</td>
                  <td>
                    <span
                      className={styles.roleBadge}
                      style={{ color: ROLE_COLORS[a.role], borderColor: ROLE_COLORS[a.role] }}
                    >
                      {ROLES.find(r => r.value === a.role)?.label ?? a.role}
                    </span>
                  </td>
                  <td className={styles.noteCell}>{a.note || '—'}</td>
                  <td className={styles.dateCell}>
                    {new Date(a.createdAt).toLocaleDateString(
                      locale === 'ar' ? 'ar-SA' : 'en-US',
                      { month: 'short', day: 'numeric', year: 'numeric' }
                    )}
                  </td>
                  <td>
                    <button className={styles.removeBtn} onClick={() => handleDelete(a.id)}>
                      {t('remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
