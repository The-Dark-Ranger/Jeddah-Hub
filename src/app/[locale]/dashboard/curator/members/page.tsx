'use client';

import { useState, useEffect, useCallback } from 'react';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import { collection, getDocs, setDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import { isValidEmail } from '@/lib/validateEmail';
import { normalizeRole } from '@/lib/role';
import { DEFAULT_MEMBER_PASSWORD, type CreateAccountResult } from '@/lib/memberAccounts';
import { createMemberAccount } from '@/lib/createMemberAccount';
import styles from './Members.module.css';

type UserRole = 'curator' | 'vice_curator' | 'impact_officer' | 'shaper' | 'alumni';

interface RoleAssignment {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
  note?: string;
  status?: 'pending' | 'joined';
  joinedAt?: string;
  /** Result of creating this member's Firebase sign-in account. */
  account?: CreateAccountResult;
}

interface KnownUser { email: string; displayName?: string; }

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
  const [knownUsers, setKnownUsers]   = useState<KnownUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<UserRole>('shaper');
  const [note, setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [search, setSearch] = useState('');
  const [inviteState, setInviteState] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'failed'>>({});

  const normRole  = normalizeRole(user?.role);
  const isCurator = normRole === 'curator' || normRole === 'vice_curator';

  const ROLES: { value: UserRole; label: string }[] = [
    { value: 'curator',        label: t('roleLabelCurator') },
    { value: 'vice_curator',   label: t('roleLabelViceCurator') },
    { value: 'impact_officer', label: t('roleLabelImpactOfficer') },
    { value: 'shaper',         label: t('roleLabelShaper') },
    { value: 'alumni',         label: t('roleLabelAlumni') },
  ];

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'role_assignments'), orderBy('createdAt', 'desc')));
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoleAssignment)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchKnownUsers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setKnownUsers(snap.docs.map(d => {
        const data = d.data();
        return { email: data.email || '', displayName: data.displayName || '' };
      }).filter(u => u.email));
    } catch { /* users collection may not exist */ }
  };

  useEffect(() => { fetchAssignments(); fetchKnownUsers(); }, [fetchAssignments]);

  const handleEmailBlur = () => {
    if (!name.trim()) {
      const found = knownUsers.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
      if (found?.displayName) setName(found.displayName);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const emailLower = email.toLowerCase().trim();
    if (!isValidEmail(emailLower)) {
      setError(t('invalidEmail'));
      return;
    }
    if (assignments.some(a => a.email === emailLower)) {
      setError(t('emailAlreadyAssigned'));
      return;
    }
    setSaving(true); setError('');
    try {
      // Check the domain can actually receive mail before creating a
      // pending assignment for it — a regex alone accepts gibberish like
      // someone@dfgdf.com, and the invite email would just bounce.
      const check = await fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailLower }),
      }).then(r => r.json()).catch(() => ({ ok: true })); // network hiccup shouldn't block a real submission
      if (!check.ok) {
        setError(t('invalidEmail'));
        setSaving(false);
        return;
      }
      // Create their sign-in account (temporary password) so they can log
      // in right away; the role below is applied on that first sign-in.
      const account = await createMemberAccount(emailLower);
      if (account === 'not-configured') setError(t('accountNotConfigured'));
      else if (account === 'failed') setError(t('accountCreateFailed'));
      // Keyed by the lowercased email (not an auto-id) so the Firestore
      // rules' preassignedRole() can look this doc up directly by path
      // when this person applies their own pre-assigned role on first login.
      await setDoc(doc(db, 'role_assignments', emailLower), {
        email: emailLower,
        displayName: name.trim() || null,
        role,
        note: note.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        addedBy: user?.email,
        account,
      });
      setEmail(''); setName(''); setNote(''); setRole('shaper');
      await fetchAssignments();
    } catch (err) {
      console.error(err);
      setError(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmRemove'))) return;
    try {
      await deleteDoc(doc(db, 'role_assignments', id));
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      setError(t('saveFailed'));
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'role_assignments', id));
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      setError(t('saveFailed'));
    }
  };

  /* For assignments made before accounts were created automatically.
   * role_assignments has no update rule, so the doc is rewritten. */
  const [creatingLogin, setCreatingLogin] = useState<string | null>(null);
  const handleCreateLogin = async (a: RoleAssignment) => {
    setCreatingLogin(a.id); setError('');
    try {
      const account = await createMemberAccount(a.email);
      if (account === 'not-configured') { setError(t('accountNotConfigured')); return; }
      if (account === 'failed') { setError(t('accountCreateFailed')); return; }
      const { id, ...data } = a;
      await deleteDoc(doc(db, 'role_assignments', id));
      await setDoc(doc(db, 'role_assignments', id), { ...data, account });
      setAssignments(prev => prev.map(x => x.id === id ? { ...x, account } : x));
    } catch (err) {
      console.error(err);
      setError(t('saveFailed'));
    } finally {
      setCreatingLogin(null);
    }
  };

  const handleSendInvite = async (a: RoleAssignment) => {
    setInviteState(s => ({ ...s, [a.id]: 'sending' }));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ email: a.email, displayName: a.displayName, role: a.role }),
      });
      setInviteState(s => ({ ...s, [a.id]: res.ok ? 'sent' : 'failed' }));
      // reset after 3s
      setTimeout(() => setInviteState(s => ({ ...s, [a.id]: 'idle' })), 3000);
    } catch {
      setInviteState(s => ({ ...s, [a.id]: 'failed' }));
      setTimeout(() => setInviteState(s => ({ ...s, [a.id]: 'idle' })), 3000);
    }
  };

  const resolveName = (a: RoleAssignment) => {
    if (a.displayName) return a.displayName;
    const found = knownUsers.find(u => u.email.toLowerCase() === a.email.toLowerCase());
    return found?.displayName || null;
  };

  const visible = assignments.filter(a => matchesQuery(search,
    a.email, resolveName(a), a.note, ROLES.find(r => r.value === a.role)?.label));
  const pending = visible.filter(a => a.status !== 'joined');
  const joined  = visible.filter(a => a.status === 'joined');

  if (!isCurator) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;
  }

  const renderRow = (a: RoleAssignment, isJoined: boolean) => {
    const displayName = resolveName(a);
    const invState = inviteState[a.id] ?? 'idle';
    return (
      <tr key={a.id}>
        <td className={styles.emailCell}>
          {displayName && <div className={styles.memberName}>{displayName}</div>}
          <div className={styles.memberEmail}>{a.email}</div>
          {!isJoined && (
            a.account === 'created' ? (
              <div className={styles.accountChip + ' ' + styles.accountReady}>{t('accountReady', { pw: DEFAULT_MEMBER_PASSWORD })}</div>
            ) : a.account === 'exists' ? (
              <div className={styles.accountChip}>{t('accountExists')}</div>
            ) : (
              <button type="button" className={styles.createLoginBtn} onClick={() => handleCreateLogin(a)} disabled={creatingLogin === a.id}>
                {creatingLogin === a.id ? t('creatingLogin') : t('createLogin')}
              </button>
            )
          )}
        </td>
        <td>
          <span className={styles.roleBadge} style={{ color: ROLE_COLORS[a.role], borderColor: ROLE_COLORS[a.role] }}>
            {ROLES.find(r => r.value === a.role)?.label ?? a.role}
          </span>
        </td>
        <td className={styles.noteCell}>{a.note || ''}</td>
        <td className={styles.dateCell}>
          {new Date(isJoined && a.joinedAt ? a.joinedAt : a.createdAt).toLocaleDateString(
            locale === 'ar' ? 'ar-SA' : 'en-US',
            { month: 'short', day: 'numeric', year: 'numeric' }
          )}
        </td>
        <td className={styles.actionsCell}>
          {isJoined ? (
            <button className={styles.acknowledgeBtn} onClick={() => handleAcknowledge(a.id)}>
              {t('acknowledge')}
            </button>
          ) : (
            <>
              <button
                className={styles.inviteBtn + (invState === 'sent' ? ' ' + styles.inviteSent : invState === 'failed' ? ' ' + styles.inviteFailed : '')}
                onClick={() => handleSendInvite(a)}
                disabled={invState === 'sending'}
              >
                {invState === 'sent' ? t('inviteSent') : invState === 'failed' ? t('inviteFailed') : invState === 'sending' ? '…' : t('sendInvite')}
              </button>
              <button className={styles.removeBtn} onClick={() => handleDelete(a.id)}>
                {t('remove')}
              </button>
            </>
          )}
        </td>
      </tr>
    );
  };

  const renderTable = (rows: RoleAssignment[], isJoined: boolean) => (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('colMember')}</th>
            <th>{t('colRole')}</th>
            <th>{t('colNote')}</th>
            <th>{isJoined ? t('statusJoined') : t('colAdded')}</th>
            <th>{t('colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => renderRow(a, isJoined))}
        </tbody>
      </table>
    </div>
  );

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
        <p className={styles.formHint}>{t('accountAutoHint', { pw: DEFAULT_MEMBER_PASSWORD })}</p>
        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('fullNameLabel')} <span className={styles.optional}>{t('optional')}</span></label>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={locale === 'ar' ? 'الاسم الكامل' : 'Full name'}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('emailAddress')} *</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              onBlur={handleEmailBlur}
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

      {!loading && assignments.length > 0 && (
        <DashSearch
          value={search}
          onChange={setSearch}
          placeholder={t('searchMembersPh')}
          resultLabel={t('resultsCount', { count: visible.length })}
        />
      )}

      {loading ? (
        <DashSkeleton rows={4} header={false} label={t('loading')} />
      ) : (
        <>
          {/* Recently Joined — needs acknowledgement */}
          {joined.length > 0 && (
            <div className={styles.tableWrap}>
              <div className={styles.tableHeader}>
                <span className={styles.joinedDot} />
                <span>{t('joinedSection')}</span>
                <span className={styles.countJoined}>{joined.length}</span>
              </div>
              <p className={styles.tableSubtitle}>{t('roleAssignmentsSubtitleJoined')}</p>
              {renderTable(joined, true)}
            </div>
          )}

          {/* Pending assignments */}
          <div className={styles.tableWrap}>
            <div className={styles.tableHeader}>
              <span>{t('pendingSection')}</span>
              <span className={styles.count}>{pending.length}</span>
            </div>
            {pending.length === 0 ? (
              <div className={styles.empty}>{search ? t('noMatches') : t('noAssignments')}</div>
            ) : renderTable(pending, false)}
          </div>
        </>
      )}
    </div>
  );
}
