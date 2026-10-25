'use client';

/* Dashboard > Roster: every initiative's team, adding members and handling
 * pending join requests. */
import { useState, useEffect } from 'react';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import {
  collection, getDocs, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, query, where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';
import SearchSelect, { type SearchOption } from '@/components/dashboard/SearchSelect';
import styles from './Roster.module.css';
import type { InitiativeMember, MembershipRequest, UserDoc } from '@/lib/types';

interface RosterInitiative {
  id: string;
  title: string;
  titleAr?: string;
  category?: string;
  status?: string;
  members?: InitiativeMember[];
  leads?: string[];
}

/** A pending join request, with the initiative's title resolved for display. */
type RosterJoinRequest = MembershipRequest & { initiativeTitle: string };

/** Team members shown per initiative on phones before "View more". */
const MOBILE_ROSTER_ROWS = 5;

export default function ManageRoster() {
  const t = useTranslations('Dashboard');
  const tRole = useTranslations('Role');
  const { user } = useAuth();
  const normRole  = normalizeRole(user?.role);
  const isCurator = normRole === 'curator' || normRole === 'vice_curator';
  const [initiatives, setInitiatives] = useState<RosterInitiative[]>([]);
  const [users, setUsers]             = useState<UserDoc[]>([]);
  const [joinRequests, setJoinRequests] = useState<RosterJoinRequest[]>([]);
  const [selectedInit, setSelectedInit] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [tempRole, setTempRole]         = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);
  // Initiatives whose full team is shown on phones (otherwise the first 5).
  const [expandedInits, setExpandedInits] = useState<Set<string>>(() => new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [initSnap, usersSnap, reqSnap] = await Promise.all([
        getDocs(collection(db, 'initiatives')),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'join_requests'), where('status', '==', 'pending'))),
      ]);
      // Hub Activities (dashboard/curator/activities) are stored as
      // initiatives docs tagged type:'hub_activity', exclude them so they
      // don't show up as rosterable/team-having initiatives here.
      const inits = initSnap.docs.filter(d => !d.data().type).map(d => ({ id: d.id, ...d.data() } as RosterInitiative));
      const usrs         = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc));
      const reqs         = reqSnap.docs.map(d => {
        const data = d.data();
        const init = inits.find(i => i.id === data.initiativeId);
        return { id: d.id, ...data, initiativeTitle: init?.title || data.initiativeId } as RosterJoinRequest;
      });
      setInitiatives(inits);
      setUsers(usrs);
      setJoinRequests(reqs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once on mount
  useEffect(() => { fetchData(); }, []);

  const handleAddMember = async () => {
    if (!selectedInit || !selectedUser) return;
    setSaving(true);
    try {
      const role = tempRole.trim() || 'Member';
      // The `leads` array (not this display role text) is what
      // firestore.rules actually checks to grant a member edit rights on
      // their own initiative, writing role text alone without also
      // updating `leads` here is exactly what leaves a "Lead"-badged
      // member unable to save their own edits (permission-denied).
      const payload: Record<string, unknown> = {
        members: arrayUnion({ userId: selectedUser, role }),
      };
      if (role.toLowerCase().includes('lead')) {
        payload.leads = arrayUnion(selectedUser);
      }
      await updateDoc(doc(db, 'initiatives', selectedInit), payload);
      setTempRole('');
      setSelectedUser('');
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptJoinRequest = async (req: RosterJoinRequest) => {
    try {
      await updateDoc(doc(db, 'initiatives', req.initiativeId), {
        members: arrayUnion({ userId: req.userId, role: 'Member' }),
      });
      await deleteDoc(doc(db, 'join_requests', req.id));
      setJoinRequests(prev => prev.filter(r => r.id !== req.id));
      setInitiatives(prev => prev.map(i =>
        i.id === req.initiativeId
          ? { ...i, members: [...(i.members || []), { userId: req.userId, role: 'Member' }] }
          : i
      ));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleRejectJoinRequest = async (reqId: string) => {
    try {
      await updateDoc(doc(db, 'join_requests', reqId), { status: 'rejected' });
      setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const handleRemoveMember = async (initiativeId: string, userId: string) => {
    if (!confirm(t('confirmRemoveMember'))) return;
    const init = initiatives.find(i => i.id === initiativeId);
    if (!init) return;
    try {
      const removed = (init.members || []).find((m: InitiativeMember) => m.userId === userId);
      const updated = (init.members || []).filter((m: InitiativeMember) => m.userId !== userId);
      const payload: Record<string, unknown> = { members: updated };
      // Keep `leads` in sync in the other direction too, a removed lead
      // should lose write access, not keep a stale entry in the array
      // firestore.rules actually checks.
      if (removed?.role?.toLowerCase().includes('lead')) {
        payload.leads = arrayRemove(userId);
      }
      await updateDoc(doc(db, 'initiatives', initiativeId), payload);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  /** True when a member's role text implies "lead" but their uid was never
   *  actually added to the initiative's `leads` array, the exact drift
   *  that causes a "Lead"-badged member to hit permission-denied trying to
   *  save their own initiative. */
  const isDriftedLead = (init: RosterInitiative, m: InitiativeMember) =>
    (m.role || '').toLowerCase().includes('lead') && !(init.leads || []).includes(m.userId);

  const handleFixLeadAccess = async (initiativeId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'initiatives', initiativeId), { leads: arrayUnion(userId) });
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  const getUserLabel = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.displayName || u?.email || userId;
  };

  const activeInitiatives = initiatives.filter(i => i.status !== 'archived');

  const initiativeOptions: SearchOption[] = activeInitiatives
    .map(i => ({ value: i.id, label: i.title, hint: i.category, keywords: i.titleAr || '' }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Searchable by name, Arabic name, email and role; anyone already on the
  // chosen initiative is listed but can't be picked again.
  const memberIds = new Set<string>(
    (initiatives.find(i => i.id === selectedInit)?.members || []).map((m: InitiativeMember) => m.userId));
  const userOptions: SearchOption[] = users
    .map(u => {
      const role = normalizeRole(u.role);
      const roleLabel = role && tRole.has(role as 'shaper') ? tRole(role as 'shaper') : '';
      return {
        value: u.id,
        label: u.displayName || u.email || u.id,
        hint: [u.email, roleLabel].filter(Boolean).join(' · '),
        keywords: u.displayNameAr || '',
        disabledNote: memberIds.has(u.id) ? t('alreadyOnInitiative') : undefined,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  // An initiative stays listed if its title matches, or any member does,
  // in which case only the matching members are shown.
  const visibleInitiatives = initiatives
    .map(init => {
      const members: InitiativeMember[] = init.members || [];
      if (matchesQuery(search, init.title)) return { init, members };
      return { init, members: members.filter(m => matchesQuery(search, getUserLabel(m.userId), m.role)) };
    })
    .filter(({ init, members }) => !search.trim() || members.length > 0 || matchesQuery(search, init.title));

  if (!isCurator) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('manageRoster')}</h2>
      </div>

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <div className={styles.card} style={{ borderInlineStart: '3px solid var(--primary-blue)' }}>
          <h3 className={styles.cardTitle}>
            {t('pendingJoinRequests')}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 22, height: 20, padding: '0 6px', borderRadius: 10,
              background: 'var(--primary-blue)', color: 'white',
              fontSize: '0.72rem', fontWeight: 700, marginInlineStart: '0.5rem',
            }}>{joinRequests.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {joinRequests.map(req => (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: '1rem', padding: '0.9rem 1rem',
                background: 'var(--background-alt)', borderRadius: 10,
                border: '1px solid var(--border-color)', flexWrap: 'wrap',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {req.userName || req.userEmail}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {t('wantsToJoin')} <strong>{req.initiativeTitle}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button className={styles.acceptBtn} onClick={() => handleAcceptJoinRequest(req)}>
                    {t('acceptRequest')}
                  </button>
                  <button className={styles.rejectBtn} onClick={() => handleRejectJoinRequest(req.id)}>
                    {t('rejectRequest')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assign form */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>{t('assignMember')}</h3>
        <div className={styles.formRow}>
          <SearchSelect
            options={initiativeOptions}
            value={selectedInit}
            onChange={setSelectedInit}
            placeholder={t('searchInitiativePh')}
            noResults={t('noMatches')}
            clearLabel={t('clearSelection')}
          />
          <SearchSelect
            options={userOptions}
            value={selectedUser}
            onChange={setSelectedUser}
            placeholder={t('searchMemberPh')}
            noResults={t('noMatches')}
            clearLabel={t('clearSelection')}
          />
          <input
            value={tempRole}
            onChange={e => setTempRole(e.target.value)}
            placeholder={t('tempRolePlaceholder')}
            className={styles.input}
          />
        </div>
        <button
          onClick={handleAddMember}
          className={styles.assignBtn}
          disabled={!selectedInit || !selectedUser || saving}
        >
          {saving ? '…' : t('assignMemberBtn')}
        </button>
      </div>

      {/* Roster list per initiative */}
      <div className={styles.card}>
        <div className={styles.cardTitleRow}>
          <h3 className={styles.cardTitle}>{t('initiativeMembers')}</h3>
          <DashSearch
            value={search}
            onChange={setSearch}
            placeholder={t('searchRosterPh')}
            resultLabel={t('resultsCount', { count: visibleInitiatives.length })}
          />
        </div>
        {loading ? (
          <DashSkeleton rows={4} header={false} label={t('loading')} />
        ) : initiatives.length === 0 ? (
          <div className={styles.empty}>{t('noMembers')}</div>
        ) : visibleInitiatives.length === 0 ? (
          <div className={styles.empty}>{t('noMatches')}</div>
        ) : (
          <div className={styles.initiativeList}>
            {visibleInitiatives.map(({ init, members }) => {
              return (
                <div key={init.id} className={styles.initiativeBlock}>
                  <div className={styles.initiativeHeader}>
                    <span className={styles.initiativeName}>{init.title}</span>
                    <span className={styles.memberCount}>
                      {t('memberCount', { count: members.length })}
                    </span>
                    <span
                      className={styles.statusPill}
                      style={{ color: init.status === 'active' ? '#059669' : '#94a3b8' }}
                    >
                      {init.status === 'archived' ? t('filterArchived') : t('filterActive')}
                    </span>
                  </div>
                  {members.length === 0 ? (
                    <p className={styles.noMembersRow}>{t('noMembers')}</p>
                  ) : (
                    <div className={styles.tableScroll}><table className={styles.memberTable}>
                      <thead>
                        <tr>
                          <th>{t('colMember')}</th>
                          <th>{t('colRole')}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m, idx) => (
                          <tr key={m.userId + idx} className={idx >= MOBILE_ROSTER_ROWS && !expandedInits.has(init.id) ? styles.rowExtra : undefined}>
                            <td className={styles.memberEmail}>{getUserLabel(m.userId)}</td>
                            <td>
                              <span className={styles.rolePill}>{m.role || t('memberDefaultRole')}</span>
                            </td>
                            <td className={styles.actionsTd}>
                              <div className={styles.rowActions}>
                              {isDriftedLead(init, m) && (
                                <button
                                  className={styles.assignBtn}
                                  title={t('fixLeadAccessHint')}
                                  onClick={() => handleFixLeadAccess(init.id, m.userId)}
                                >
                                  {t('fixLeadAccess')}
                                </button>
                              )}
                              <button
                                className={styles.removeBtn}
                                onClick={() => handleRemoveMember(init.id, m.userId)}
                              >
                                {t('removeMember')}
                              </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Phones only (CSS): long teams show 5, then the rest on demand. */}
                    {members.length > MOBILE_ROSTER_ROWS && (
                      <button
                        type="button"
                        className={styles.rosterMore}
                        aria-expanded={expandedInits.has(init.id)}
                        onClick={() => setExpandedInits(prev => {
                          const next = new Set(prev);
                          if (next.has(init.id)) next.delete(init.id); else next.add(init.id);
                          return next;
                        })}
                      >
                        {expandedInits.has(init.id)
                          ? t('viewLess')
                          : t('viewMoreMembers', { count: members.length - MOBILE_ROSTER_ROWS })}
                      </button>
                    )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
