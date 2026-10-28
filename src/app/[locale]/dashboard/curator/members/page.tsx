'use client';

/* Dashboard > Role Assignments: add members (creates their login with a
 * one-time password), send invites, and track who has signed in. */
import { useState, useEffect, useCallback } from 'react';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import { collection, getDocs, setDoc, deleteDoc, updateDoc, deleteField, doc, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import { isValidEmail } from '@/lib/validateEmail';
import { normalizeRole } from '@/lib/role';
import type { CreateAccountResult } from '@/lib/memberAccounts';
import { createMemberAccount, getSignInStatus, removePendingMember, resetTempPassword } from '@/lib/createMemberAccount';
import ShaperStatusPanel from './ShaperStatusPanel';
import ViewMoreButton, { useViewMore } from '@/components/dashboard/ViewMore';
import styles from './Members.module.css';
import { ROLE_ACCENT } from '@/lib/roleColors';

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
  /** Set aside by a curator (alumni): kept under Dismissed to review later. */
  dismissed?: boolean;
  dismissedAt?: string;
}

interface KnownUser { email: string; displayName?: string; }


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
  // One-time passwords issued in this session, by assignment id. Never
  // stored anywhere: once the page is closed only a reset can show one.
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RoleAssignment));
      setAssignments(list);
      // Anyone who has signed in moves out of Pending into "Recently
      // joined" (Acknowledge clears them). Sign-in times come from the
      // server, the only place that can read them.
      const signedIn = await getSignInStatus(list.filter(a => a.status !== 'joined').map(a => a.email));
      if (Object.keys(signedIn).length) {
        setAssignments(list.map(a => signedIn[a.email.toLowerCase()]
          ? { ...a, status: 'joined', joinedAt: a.joinedAt ?? signedIn[a.email.toLowerCase()] }
          : a));
      }
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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once on mount
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
    // The name is what lists them on the public Who We Are page.
    if (!name.trim()) { setError(t('nameRequired')); return; }
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
      // pending assignment for it, a regex alone accepts gibberish like
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
      // in right away, already holding this role and listed under it on
      // the Who We Are page with this name.
      const { result: account, tempPassword } = await createMemberAccount(emailLower, name.trim(), role);
      if (tempPassword) setTempPasswords(m => ({ ...m, [emailLower]: tempPassword }));
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
      // Take a not-yet-signed-in member back off the Who We Are page and
      // delete their unused login; anyone who has signed in is kept.
      const a = assignments.find(x => x.id === id);
      if (a && a.status !== 'joined' && a.account) await removePendingMember(a.email);
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
  /** Creates the member's login; true when they have one afterwards. */
  const handleCreateLogin = async (a: RoleAssignment): Promise<boolean> => {
    setCreatingLogin(a.id); setError('');
    try {
      const { result: account, tempPassword } = await createMemberAccount(a.email, resolveName(a) ?? '', a.role);
      if (account === 'not-configured') { setError(t('accountNotConfigured')); return false; }
      if (account === 'failed') { setError(t('accountCreateFailed')); return false; }
      const { id, ...data } = a;
      await deleteDoc(doc(db, 'role_assignments', id));
      await setDoc(doc(db, 'role_assignments', id), { ...data, account });
      setAssignments(prev => prev.map(x => x.id === id ? { ...x, account } : x));
      if (tempPassword) setTempPasswords(m => ({ ...m, [id]: tempPassword }));
      return true;
    } catch (err) {
      console.error(err);
      setError(t('saveFailed'));
      return false;
    } finally {
      setCreatingLogin(null);
    }
  };

  /** A new one-time password, for a member who lost theirs before signing in. */
  const [resettingId, setResettingId] = useState<string | null>(null);
  const handleResetTemp = async (a: RoleAssignment) => {
    setResettingId(a.id); setError('');
    const pw = await resetTempPassword(a.email);
    if (pw) setTempPasswords(m => ({ ...m, [a.id]: pw }));
    else setError(t('saveFailed'));
    setResettingId(null);
  };

  const copyTempPassword = async (id: string) => {
    try {
      await navigator.clipboard.writeText(tempPasswords[id]);
      setCopiedId(id);
      setTimeout(() => setCopiedId(c => (c === id ? null : c)), 2000);
    } catch { /* clipboard blocked: the password is still on screen */ }
  };

  const handleSendInvite = async (a: RoleAssignment) => {
    setInviteState(s => ({ ...s, [a.id]: 'sending' }));
    try {
      // The invite carries their sign-in details, so they need a login first.
      if (!a.account && !(await handleCreateLogin(a))) {
        setInviteState(s => ({ ...s, [a.id]: 'failed' }));
        setTimeout(() => setInviteState(s => ({ ...s, [a.id]: 'idle' })), 3000);
        return;
      }
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ email: a.email, displayName: resolveName(a), role: a.role, locale }),
      });
      setInviteState(s => ({ ...s, [a.id]: res.ok ? 'sent' : 'failed' }));
      // The invite carries a fresh one-time password, so any shown here is now old.
      if (res.ok) setTempPasswords(m => { const next = { ...m }; delete next[a.id]; return next; });
      // reset after 3s
      setTimeout(() => setInviteState(s => ({ ...s, [a.id]: 'idle' })), 3000);
    } catch {
      setInviteState(s => ({ ...s, [a.id]: 'failed' }));
      setTimeout(() => setInviteState(s => ({ ...s, [a.id]: 'idle' })), 3000);
    }
  };

  /** Sets an alumni assignment aside under Dismissed, or brings it back. */
  const handleDismiss = async (a: RoleAssignment, dismiss: boolean) => {
    try {
      await updateDoc(doc(db, 'role_assignments', a.id), dismiss
        ? { dismissed: true, dismissedAt: new Date().toISOString() }
        : { dismissed: deleteField(), dismissedAt: deleteField() });
      setAssignments(prev => prev.map(x => x.id === a.id
        ? { ...x, dismissed: dismiss || undefined, dismissedAt: dismiss ? new Date().toISOString() : undefined }
        : x));
    } catch (err) {
      console.error(err);
      setError(t('saveFailed'));
    }
  };

  const resolveName = (a: RoleAssignment) => {
    if (a.displayName) return a.displayName;
    const found = knownUsers.find(u => u.email.toLowerCase() === a.email.toLowerCase());
    return found?.displayName || null;
  };

  const visible = assignments.filter(a => matchesQuery(search,
    a.email, resolveName(a), a.note, ROLES.find(r => r.value === a.role)?.label));
  const pending   = visible.filter(a => a.status !== 'joined' && !a.dismissed);
  const joined    = visible.filter(a => a.status === 'joined');
  const dismissed = visible.filter(a => a.status !== 'joined' && a.dismissed);
  // Long pending list: 10 at a time, starting over when the search changes.
  const pendingPage = useViewMore(pending, search);
  const joinedPage  = useViewMore(joined, search);

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
            tempPasswords[a.id] ? (
              <div className={styles.accountChip + ' ' + styles.accountReady}>
                {t('tempPassword')} <code className={styles.tempPw}>{tempPasswords[a.id]}</code>
                <button type="button" className={styles.chipBtn} onClick={() => copyTempPassword(a.id)}>
                  {copiedId === a.id ? t('copied') : t('copy')}
                </button>
              </div>
            ) : a.account === 'created' ? (
              <div className={styles.accountChip + ' ' + styles.accountReady}>
                {t('accountReady')}
                <button type="button" className={styles.chipBtn} onClick={() => handleResetTemp(a)} disabled={resettingId === a.id}>
                  {resettingId === a.id ? '…' : t('newTempPassword')}
                </button>
              </div>
            ) : a.account === 'exists' ? (
              <div className={styles.accountChip}>{t('accountExists')}</div>
            ) : (
              <button type="button" className={styles.createLoginBtn} onClick={() => handleCreateLogin(a)} disabled={creatingLogin === a.id}>
                {creatingLogin === a.id ? t('creatingLogin') : t('createLogin')}
              </button>
            )
          )}
        </td>
        <td className={styles.roleCell}>
          <span className={styles.roleBadge} style={{ color: ROLE_ACCENT[a.role], borderColor: ROLE_ACCENT[a.role] }}>
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
        <td className={styles.actionsTd}>
          <div className={styles.actionsCell}>
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
              {a.dismissed ? (
                <button className={styles.dismissBtn} onClick={() => handleDismiss(a, false)}>{t('restoreAssignment')}</button>
              ) : a.role === 'alumni' && (
                <button className={styles.dismissBtn} onClick={() => handleDismiss(a, true)}>{t('dismissAssignment')}</button>
              )}
              <button className={styles.removeBtn} onClick={() => handleDelete(a.id)}>
                {t('remove')}
              </button>
            </>
          )}
          </div>
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
        <p className={styles.formHint}>{t('accountAutoHint')}</p>
        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('fullNameLabel')} *</label>
            <input
              className={styles.input}
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              required
              maxLength={100}
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
              {/* Only the Curator can make someone a curator (firestore.rules). */}
              {ROLES.filter(r => r.value !== 'curator' || normRole === 'curator')
                .map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
          {/* Recently Joined, needs acknowledgement */}
          {joined.length > 0 && (
            <div className={styles.tableWrap}>
              <div className={styles.tableHeader}>
                <span className={styles.joinedDot} />
                <span>{t('joinedSection')}</span>
                <span className={styles.countJoined}>{joined.length}</span>
              </div>
              <p className={styles.tableSubtitle}>{t('roleAssignmentsSubtitleJoined')}</p>
              {renderTable(joinedPage.shown, true)}
              <ViewMoreButton hiddenCount={joinedPage.hiddenCount} expanded={joinedPage.expanded} onMore={joinedPage.more} onLess={joinedPage.less} />
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
            ) : (
              <>
                {renderTable(pendingPage.shown, false)}
                <ViewMoreButton
                  hiddenCount={pendingPage.hiddenCount}
                  expanded={pendingPage.expanded}
                  onMore={pendingPage.more}
                  onLess={pendingPage.less}
                />
              </>
            )}
          </div>
        </>
      )}

      {/* Dismissed alumni: set aside to review later; invite or restore any time. */}
      {!loading && dismissed.length > 0 && (
        <details className={styles.tableWrap + ' ' + styles.dismissedWrap}>
          <summary className={styles.tableHeader + ' ' + styles.dismissedSummary}>
            <span>{t('dismissedSection')}</span>
            <span className={styles.count}>{dismissed.length}</span>
          </summary>
          <p className={styles.tableSubtitle}>{t('dismissedSubtitle')}</p>
          {renderTable(dismissed, false)}
        </details>
      )}

      {/* Shaper ⇄ Alumni for members who already have an account */}
      <ShaperStatusPanel onChanged={fetchAssignments} />
    </div>
  );
}
