'use client';

import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { useLocale, useTranslations } from 'next-intl';
import { db } from '@/lib/firebase';
import { normalizeRole } from '@/lib/role';
import { refreshPublicPages } from '@/lib/spotlight';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import styles from './ShaperStatus.module.css';

type Status = 'shaper' | 'alumni';

interface Member {
  uid: string;
  name: string;
  nameAr?: string;
  email?: string;
  photoURL?: string;
  status: Status;
}

/** Curators and vice curators move members between active Shaper and
 *  Alumni. The change is written to the member's private record
 *  (users/{uid}.role, the role every permission check reads) and to their
 *  public mirror (public_profiles/{uid}.role, which Who We Are, the
 *  homepage and the member counts read), plus any still-pending role
 *  assignment so it doesn't re-apply the old status. */
export default function ShaperStatusPanel({ onChanged }: { onChanged?: () => void }) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setMembers(snap.docs
        .map(d => {
          const u = d.data();
          const role = normalizeRole(u.role);
          return {
            uid: d.id,
            name: (u.displayName as string) || (u.email as string) || d.id,
            nameAr: u.displayNameAr as string | undefined,
            email: u.email as string | undefined,
            photoURL: u.photoURL as string | undefined,
            status: role as Status,
          };
        })
        .filter(m => m.status === 'shaper' || m.status === 'alumni')
        .sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setError(t('statusLoadFailed'));
      setMembers([]);
    }
  }, [t]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (m: Member, next: Status) => {
    if (m.status === next) return;
    setBusy(m.uid); setError('');
    try {
      await updateDoc(doc(db, 'users', m.uid), { role: next });
      await setDoc(doc(db, 'public_profiles', m.uid), { role: next }, { merge: true });
      // A pending assignment for this email would otherwise still show (and
      // could re-apply) the old status. It has no update rule, so rewrite it.
      if (m.email) {
        const ref = doc(db, 'role_assignments', m.email.toLowerCase());
        const snap = await getDoc(ref).catch(() => null);
        if (snap?.exists() && snap.data().role !== next) {
          const data = snap.data();
          await deleteDoc(ref);
          await setDoc(ref, { ...data, role: next });
        }
      }
      setMembers(prev => prev?.map(x => x.uid === m.uid ? { ...x, status: next } : x) ?? null);
      void refreshPublicPages();
      onChanged?.();
    } catch (err) {
      console.error(err);
      setError(t('statusSaveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const shaperCount = members?.filter(m => m.status === 'shaper').length ?? 0;
  const alumniCount = members?.filter(m => m.status === 'alumni').length ?? 0;
  const visible = (members ?? []).filter(m =>
    (filter === 'all' || m.status === filter) && matchesQuery(search, m.name, m.nameAr, m.email));

  return (
    <section className={styles.panel} aria-labelledby="shaper-status-title">
      <div className={styles.head}>
        <div>
          <h3 id="shaper-status-title" className={styles.title}>{t('statusTitle')}</h3>
          <p className={styles.hint}>{t('statusHint')}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.tabs} role="tablist">
          {([
            ['all', t('filterAll'), (members?.length ?? 0)],
            ['shaper', t('roleLabelShaper'), shaperCount],
            ['alumni', t('roleLabelAlumni'), alumniCount],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={styles.tab + (filter === key ? ' ' + styles.tabActive : '')}
              onClick={() => setFilter(key)}
            >
              {label}<span className={styles.tabCount}>{count}</span>
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

      {error && <p className={styles.error}>{error}</p>}

      {members === null ? (
        <DashSkeleton rows={4} header={false} label={t('loading')} />
      ) : visible.length === 0 ? (
        <p className={styles.empty}>{t('noMatches')}</p>
      ) : (
        <ul className={styles.list}>
          {visible.map(m => {
            const name = (locale === 'ar' && m.nameAr) || m.name;
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
                <div className={styles.segment} role="radiogroup" aria-label={t('statusTitle') + ': ' + name}>
                  {(['shaper', 'alumni'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={m.status === s}
                      disabled={busy === m.uid}
                      className={styles.segBtn + (m.status === s ? ' ' + (s === 'shaper' ? styles.segShaper : styles.segAlumni) : '')}
                      onClick={() => changeStatus(m, s)}
                    >
                      {s === 'shaper' ? t('roleLabelShaper') : t('roleLabelAlumni')}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
