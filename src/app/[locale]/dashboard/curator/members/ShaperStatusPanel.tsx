'use client';

/* Dashboard > Role Assignments > Members: switch Shaper/Alumni and remove members. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { useLocale, useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import { normalizeRole } from '@/lib/role';
import { useRoleLabel } from '@/lib/roleLabel';
import { refreshPublicPages } from '@/lib/spotlight';
import { deleteMember } from '@/lib/createMemberAccount';
import { useAuth } from '@/context/AuthContext';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import ViewMoreButton, { useViewMore } from '@/components/dashboard/ViewMore';
import styles from './ShaperStatus.module.css';

type Status = 'shaper' | 'alumni';
type Role = 'curator' | 'vice_curator' | 'impact_officer' | Status;
type Filter = 'all' | Status | 'team';

const ROLES: readonly Role[] = ['curator', 'vice_curator', 'impact_officer', 'shaper', 'alumni'];

interface Member {
  uid: string;
  name: string;
  nameAr?: string;
  email?: string;
  photoURL?: string;
  role: Role;
}

/** How long a Remove button stays armed waiting for the confirming click. */
const CONFIRM_MS = 4000;

/** Every member with an account, for curators and vice curators:
 *
 *  - Shaper / Alumni buttons move a member between active and alumni. The
 *    change goes to users/{uid}.role (what every permission check reads),
 *    public_profiles/{uid}.role (Who We Are, homepage, member counts) and
 *    any still-pending role assignment so it can't re-apply the old status.
 *  - Remove deletes the member from the Hub (sign-in account included) via
 *    the server; see deleteMember in /api/members/create-account. First
 *    click arms it, a second click within a few seconds confirms. */
export default function ShaperStatusPanel({ onChanged }: { onChanged?: () => void }) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const roleLabel = useRoleLabel();
  const { user } = useAuth();
  const isFullCurator = normalizeRole(user?.role) === 'curator';
  const [members, setMembers] = useState<Member[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [error, setError] = useState('');
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setMembers(snap.docs
        .map(d => {
          const u = d.data();
          return {
            uid: d.id,
            name: (u.displayName as string) || (u.email as string) || d.id,
            nameAr: u.displayNameAr as string | undefined,
            email: u.email as string | undefined,
            photoURL: u.photoURL as string | undefined,
            role: normalizeRole(u.role) as Role,
          };
        })
        .filter(m => ROLES.includes(m.role))
        .sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setError(t('statusLoadFailed'));
      setMembers([]);
    }
  }, [t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (armTimer.current) clearTimeout(armTimer.current); }, []);

  const changeStatus = async (m: Member, next: Status) => {
    if (m.role === next) return;
    setBusy(m.uid); setError('');
    try {
      await updateDoc(doc(db, 'users', m.uid), { role: next });
      await setDoc(doc(db, 'public_profiles', m.uid), { role: next }, { merge: true });
      // role_assignments has no update rule, so a pending one is rewritten.
      if (m.email) {
        const ref = doc(db, 'role_assignments', m.email.toLowerCase());
        const snap = await getDoc(ref).catch(() => null);
        if (snap?.exists() && snap.data().role !== next) {
          const data = snap.data();
          await deleteDoc(ref);
          await setDoc(ref, { ...data, role: next });
        }
      }
      setMembers(prev => prev?.map(x => x.uid === m.uid ? { ...x, role: next } : x) ?? null);
      void refreshPublicPages();
      onChanged?.();
    } catch (err) {
      console.error(err);
      setError(t('statusSaveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: Member) => {
    // First click arms the button; the second (within CONFIRM_MS) removes.
    if (armed !== m.uid) {
      setArmed(m.uid);
      if (armTimer.current) clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setArmed(a => (a === m.uid ? null : a)), CONFIRM_MS);
      return;
    }
    setArmed(null);
    setBusy(m.uid); setError('');
    const result = await deleteMember(m.uid);
    setBusy(null);
    if (result === 'removed' || result === 'not-found') {
      setMembers(prev => prev?.filter(x => x.uid !== m.uid) ?? null);
      void refreshPublicPages();
      onChanged?.();
    } else {
      setError(result === 'kept' ? t('memberRemoveRefused') : t('memberRemoveFailed'));
    }
  };

  const isTeam = (r: Role) => r === 'curator' || r === 'vice_curator' || r === 'impact_officer';
  const count = (f: Filter) => (members ?? []).filter(m => f === 'all' || (f === 'team' ? isTeam(m.role) : m.role === f)).length;
  const visible = (members ?? []).filter(m =>
    (filter === 'all' || (filter === 'team' ? isTeam(m.role) : m.role === filter))
    && matchesQuery(search, m.name, m.nameAr, m.email, roleLabel(m.role)));
  // 10 at a time; a new search or tab starts over at the first 10.
  const page = useViewMore(visible, `${filter}|${search}`);

  return (
    <section className={styles.panel} aria-labelledby="shaper-status-title">
      <div className={styles.head}>
        <h3 id="shaper-status-title" className={styles.title}>{t('statusTitle')}</h3>
        <p className={styles.hint}>{t('statusHint')}</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist">
          {([
            ['all', t('filterAll')],
            ['shaper', t('roleLabelShaper')],
            ['alumni', t('roleLabelAlumni')],
            ['team', t('filterTeam')],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={styles.tab + (filter === key ? ' ' + styles.tabActive : '')}
              onClick={() => setFilter(key)}
            >
              {label}<span className={styles.tabCount}>{count(key)}</span>
            </button>
          ))}
        </div>
        <DashSearch
          value={search}
          onChange={setSearch}
          placeholder={t('searchMembersPh')}
          resultLabel={t('resultsCount', { count: visible.length })}
        />
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {members === null ? (
        <DashSkeleton rows={4} header={false} label={t('loading')} />
      ) : visible.length === 0 ? (
        <p className={styles.empty}>{t('noMatches')}</p>
      ) : (
        <ul className={styles.list}>
          {page.shown.map(m => {
            const name = (locale === 'ar' && m.nameAr) || m.name;
            const isSelf = m.uid === user?.uid;
            const canRemove = !isSelf && (m.role !== 'curator' || isFullCurator);
            return (
              <li key={m.uid} className={styles.row}>
                <div className={styles.who}>
                  {m.photoURL
                    ? <img src={m.photoURL} alt="" className={styles.avatar} loading="lazy" />
                    : <span className={styles.avatarFallback} aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
                  <div className={styles.names}>
                    <span className={styles.name}>{name}</span>
                    {m.email && <span className={styles.email}>{m.email}</span>}
                  </div>
                </div>
                <div className={styles.actions}>
                  {m.role === 'shaper' || m.role === 'alumni' ? (
                    <div className={styles.segment} role="radiogroup" aria-label={t('statusTitle') + ': ' + name}>
                      {(['shaper', 'alumni'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={m.role === s}
                          disabled={busy === m.uid}
                          className={styles.segBtn + (m.role === s ? ' ' + (s === 'shaper' ? styles.segShaper : styles.segAlumni) : '')}
                          onClick={() => changeStatus(m, s)}
                        >
                          {s === 'shaper' ? t('roleLabelShaper') : t('roleLabelAlumni')}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.roleTag}>{roleLabel(m.role)}</span>
                  )}
                  {canRemove && (
                    <button
                      type="button"
                      className={styles.removeBtn + (armed === m.uid ? ' ' + styles.removeArmed : '')}
                      disabled={busy === m.uid}
                      onClick={() => remove(m)}
                      aria-label={(armed === m.uid ? t('memberRemoveConfirm') : t('remove')) + ': ' + name}
                    >
                      {busy === m.uid && armed !== m.uid ? '…' : armed === m.uid ? t('memberRemoveConfirm') : t('remove')}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ViewMoreButton hiddenCount={page.hiddenCount} expanded={page.expanded} onMore={page.more} onLess={page.less} />
    </section>
  );
}
