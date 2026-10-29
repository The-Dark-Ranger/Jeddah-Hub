'use client';

/* Dashboard > Roster: every initiative's team, adding members, changing team
 * roles and handling pending join and role-change requests. Initiative leads
 * see only the teams they lead; a role change they make goes to the Curator
 * or Vice Curator as a request instead of applying straight away. */
import { useState, useEffect, useCallback } from 'react';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import DashSkeleton from '@/components/dashboard/DashSkeleton';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, query, where, documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';
import SearchSelect, { type SearchOption } from '@/components/dashboard/SearchSelect';
import styles from './Roster.module.css';
import {
  isLeadRole, memberId, toTeamRole, withTeamRole,
  type InitiativeMember, type MemberEntry, type MembershipRequest, type RoleChangeRequest, type TeamRole, type UserDoc,
} from '@/lib/types';
import TeamRoleSelect, { teamRoleLabel } from '@/components/dashboard/TeamRoleSelect';

interface RosterInitiative {
  id: string;
  title: string;
  titleAr?: string;
  category?: string;
  status?: string;
  members?: MemberEntry[];
  leads?: string[];
}

/** A pending join request, with the initiative's title resolved for display. */
type RosterJoinRequest = MembershipRequest & { initiativeTitle: string };

/** Team members shown per initiative on phones before "View more". */
const MOBILE_ROSTER_ROWS = 5;

/** A team as objects, whichever shape each entry was stored in. */
const teamOf = (init: RosterInitiative): InitiativeMember[] =>
  (init.members || []).map(m => typeof m === 'string' ? { userId: m, role: 'Member' } : m);

/** Sets one person's team role on an initiative, read fresh so a change made
 *  meanwhile isn't overwritten, and keeps `leads` (what firestore.rules
 *  checks for lead rights) in step. False when they're no longer on it. */
async function applyTeamRole(initiativeId: string, userId: string, role: TeamRole): Promise<boolean> {
  const ref = doc(db, 'initiatives', initiativeId);
  const members = ((await getDoc(ref)).data()?.members || []) as MemberEntry[];
  if (!members.some(m => memberId(m) === userId)) return false;
  await updateDoc(ref, {
    members: withTeamRole(members, userId, role),
    leads: isLeadRole(role) ? arrayUnion(userId) : arrayRemove(userId),
  });
  return true;
}

export default function ManageRoster() {
  const t = useTranslations('Dashboard');
  const tRole = useTranslations('Role');
  const { user } = useAuth();
  const normRole  = normalizeRole(user?.role);
  const isCurator = normRole === 'curator' || normRole === 'vice_curator';
  const [initiatives, setInitiatives] = useState<RosterInitiative[]>([]);
  const [users, setUsers]             = useState<UserDoc[]>([]);
  const [joinRequests, setJoinRequests] = useState<RosterJoinRequest[]>([]);
  // Curators: every pending role change. Leads: the ones they've asked for.
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [selectedInit, setSelectedInit] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [tempRole, setTempRole]         = useState<TeamRole>('Member');
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [saving, setSaving]   = useState(false);
  // The member row whose role is being saved, as "initiativeId:userId".
  const [busyRow, setBusyRow] = useState('');
  // Initiatives whose full team is shown on phones (otherwise the first 5).
  const [expandedInits, setExpandedInits] = useState<Set<string>>(() => new Set());

  const uid = user?.uid;
  const fetchData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      if (isCurator) {
        const [initSnap, usersSnap, reqSnap, roleSnap] = await Promise.all([
          getDocs(collection(db, 'initiatives')),
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'join_requests'), where('status', '==', 'pending'))),
          getDocs(query(collection(db, 'role_change_requests'), where('status', '==', 'pending'))).catch(() => null),
        ]);
        // Hub Activities (dashboard/curator/activities) are stored as
        // initiatives docs tagged type:'hub_activity', exclude them so they
        // don't show up as rosterable/team-having initiatives here.
        const inits = initSnap.docs.filter(d => !d.data().type).map(d => ({ id: d.id, ...d.data() } as RosterInitiative));
        setInitiatives(inits);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc)));
        setJoinRequests(reqSnap.docs.map(d => {
          const data = d.data();
          const init = inits.find(i => i.id === data.initiativeId);
          return { id: d.id, ...data, initiativeTitle: init?.title || data.initiativeId } as RosterJoinRequest;
        }));
        setRoleRequests(roleSnap ? roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoleChangeRequest)) : []);
        return;
      }

      // A lead: only the active initiatives they lead. Names come from
      // public_profiles, since only curators can read the users collection.
      const [initSnap, roleSnap] = await Promise.all([
        getDocs(query(collection(db, 'initiatives'), where('leads', 'array-contains', uid))),
        getDocs(query(collection(db, 'role_change_requests'),
          where('requestedByUserId', '==', uid), where('status', '==', 'pending'))).catch(() => null),
      ]);
      const inits = initSnap.docs
        .filter(d => !d.data().type && d.data().status !== 'archived')
        .map(d => ({ id: d.id, ...d.data() } as RosterInitiative));
      const ids = Array.from(new Set(inits.flatMap(i => teamOf(i).map(m => m.userId))));
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
      const profileSnaps = await Promise.all(chunks.map(c =>
        getDocs(query(collection(db, 'public_profiles'), where(documentId(), 'in', c))).catch(() => null)));
      setInitiatives(inits);
      setUsers(profileSnaps.flatMap(s => s ? s.docs.map(d => ({ id: d.id, ...d.data() } as UserDoc)) : []));
      setRoleRequests(roleSnap ? roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as RoleChangeRequest)) : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [uid, isCurator]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once signed in
  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddMember = async () => {
    if (!selectedInit || !selectedUser) return;
    setSaving(true);
    try {
      const role = tempRole;
      // The `leads` array (not this display role text) is what
      // firestore.rules actually checks to grant a member edit rights on
      // their own initiative, writing role text alone without also
      // updating `leads` here is exactly what leaves a "Lead"-badged
      // member unable to save their own edits (permission-denied).
      const payload: Record<string, unknown> = {
        members: arrayUnion({ userId: selectedUser, role }),
      };
      if (isLeadRole(role)) {
        payload.leads = arrayUnion(selectedUser);
      }
      await updateDoc(doc(db, 'initiatives', selectedInit), payload);
      setTempRole('Member');
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
      const removed = teamOf(init).find(m => m.userId === userId);
      const updated = (init.members || []).filter(m => memberId(m) !== userId);
      const payload: Record<string, unknown> = { members: updated };
      // Keep `leads` in sync in the other direction too, a removed lead
      // should lose write access, not keep a stale entry in the array
      // firestore.rules actually checks.
      if (isLeadRole(removed?.role)) {
        payload.leads = arrayRemove(userId);
      }
      await updateDoc(doc(db, 'initiatives', initiativeId), payload);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  /** A role picked in the team table: a curator's change applies at once; a
   *  lead's becomes a request for the Curator or Vice Curator to approve. */
  const handleRoleChange = async (init: RosterInitiative, m: InitiativeMember, role: TeamRole) => {
    if (!user || role === toTeamRole(m.role)) return;
    const vars = { member: getUserLabel(m.userId), initiative: init.title, role: teamRoleLabel(t, role) };
    if (!confirm(t(isCurator ? 'confirmRoleChange' : 'confirmRequestRoleChange', vars))) return;
    setBusyRow(`${init.id}:${m.userId}`);
    try {
      if (isCurator) {
        await applyTeamRole(init.id, m.userId, role);
        await fetchData();
        return;
      }
      const req = {
        initiativeId: init.id,
        initiativeTitle: init.title,
        targetUserId: m.userId,
        targetUserName: vars.member,
        fromRole: toTeamRole(m.role),
        toRole: role,
        requestedByUserId: user.uid,
        requestedByName: user.displayName || user.email || '',
        status: 'pending' as const,
        requestedAt: new Date().toISOString(),
      };
      const ref = await addDoc(collection(db, 'role_change_requests'), req);
      setRoleRequests(prev => [...prev, { id: ref.id, ...req }]);
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    } finally {
      setBusyRow('');
    }
  };

  const handleCancelRoleRequest = async (reqId: string) => {
    try {
      await deleteDoc(doc(db, 'role_change_requests', reqId));
      setRoleRequests(prev => prev.filter(r => r.id !== reqId));
    } catch (err) {
      console.error(err);
      alert(t('saveFailed'));
    }
  };

  /** Curator review of a lead's request. An approval applies the role; if
   *  the person has left the team since, the request is declined instead. */
  const handleReviewRoleRequest = async (req: RoleChangeRequest, approve: boolean) => {
    if (!user) return;
    try {
      const applied = approve && await applyTeamRole(req.initiativeId, req.targetUserId, req.toRole);
      if (approve && !applied) alert(t('roleChangeMemberGone'));
      await updateDoc(doc(db, 'role_change_requests', req.id), {
        status: applied ? 'approved' : 'declined',
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
      });
      setRoleRequests(prev => prev.filter(r => r.id !== req.id));
      if (applied) await fetchData();
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
    isLeadRole(m.role) && !(init.leads || []).includes(m.userId);

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
    // A lead sees public profiles only, which members get at first sign-in.
    return u?.displayName || u?.email || (isCurator ? userId : t('pendingMemberName'));
  };

  const activeInitiatives = initiatives.filter(i => i.status !== 'archived');

  const initiativeOptions: SearchOption[] = activeInitiatives
    .map(i => ({ value: i.id, label: i.title, hint: i.category, keywords: i.titleAr || '' }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Searchable by name, Arabic name, email and role; anyone already on the
  // chosen initiative is listed but can't be picked again.
  const selected = initiatives.find(i => i.id === selectedInit);
  const memberIds = new Set<string>(selected ? teamOf(selected).map(m => m.userId) : []);
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
      const members = teamOf(init);
      if (matchesQuery(search, init.title)) return { init, members };
      return { init, members: members.filter(m => matchesQuery(search, getUserLabel(m.userId), m.role)) };
    })
    .filter(({ init, members }) => !search.trim() || members.length > 0 || matchesQuery(search, init.title));

  // Someone who is neither a curator nor leads an active initiative.
  if (!isCurator && !loading && initiatives.length === 0) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('rosterRestricted')}</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{isCurator ? t('manageRoster') : t('myTeamsRoster')}</h2>
        {!isCurator && <p className={styles.leadNote}>{t('rosterLeadNote')}</p>}
      </div>

      {/* Role changes asked for by initiative leads, for the Curator or Vice Curator */}
      {isCurator && roleRequests.length > 0 && (
        <div className={`${styles.card} ${styles.requestCard}`}>
          <h3 className={styles.cardTitle}>
            {t('roleChangeRequests')}
            <span className={styles.countBadge}>{roleRequests.length}</span>
          </h3>
          <div className={styles.requestList}>
            {roleRequests.map(req => (
              <div key={req.id} className={styles.requestRow}>
                <div className={styles.requestInfo}>
                  <span className={styles.requestName}>{req.targetUserName || req.targetUserId}</span>
                  <span className={styles.requestMeta}>
                    {t('roleChangeMeta', {
                      from: teamRoleLabel(t, req.fromRole), to: teamRoleLabel(t, req.toRole),
                      initiative: req.initiativeTitle || req.initiativeId,
                    })}
                    {req.requestedByName && <> · {t('by')} {req.requestedByName}</>}
                  </span>
                </div>
                <div className={styles.requestActions}>
                  <button className={styles.acceptBtn} onClick={() => handleReviewRoleRequest(req, true)}>
                    {t('approveRoleChange')}
                  </button>
                  <button className={styles.rejectBtn} onClick={() => handleReviewRoleRequest(req, false)}>
                    {t('rejectRequest')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending join requests */}
      {isCurator && joinRequests.length > 0 && (
        <div className={`${styles.card} ${styles.requestCard}`}>
          <h3 className={styles.cardTitle}>
            {t('pendingJoinRequests')}
            <span className={styles.countBadge}>{joinRequests.length}</span>
          </h3>
          <div className={styles.requestList}>
            {joinRequests.map(req => (
              <div key={req.id} className={styles.requestRow}>
                <div className={styles.requestInfo}>
                  <span className={styles.requestName}>{req.userName || req.userEmail}</span>
                  <span className={styles.requestMeta}>
                    {t('wantsToJoin')} <strong>{req.initiativeTitle}</strong>
                  </span>
                </div>
                <div className={styles.requestActions}>
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
      {isCurator && (
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
          <TeamRoleSelect value={tempRole} onChange={setTempRole} className={styles.input} />
        </div>
        <button
          onClick={handleAddMember}
          className={styles.assignBtn}
          disabled={!selectedInit || !selectedUser || saving}
        >
          {saving ? '…' : t('assignMemberBtn')}
        </button>
      </div>
      )}

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
                        {members.map((m, idx) => {
                          const pending = !isCurator
                            ? roleRequests.find(r => r.initiativeId === init.id && r.targetUserId === m.userId)
                            : undefined;
                          // A lead can't ask to change their own role.
                          const locked = !!pending || (!isCurator && m.userId === user?.uid)
                            || busyRow === `${init.id}:${m.userId}`;
                          return (
                          <tr key={m.userId + idx} className={idx >= MOBILE_ROSTER_ROWS && !expandedInits.has(init.id) ? styles.rowExtra : undefined}>
                            <td className={styles.memberEmail}>{getUserLabel(m.userId)}</td>
                            <td>
                              <TeamRoleSelect
                                value={toTeamRole(m.role)}
                                onChange={role => handleRoleChange(init, m, role)}
                                className={styles.roleSelect}
                                disabled={locked}
                                label={t('teamRoleOf', { member: getUserLabel(m.userId) })}
                              />
                            </td>
                            <td className={styles.actionsTd}>
                              <div className={styles.rowActions}>
                              {pending && (<>
                                <span className={styles.pendingPill}>
                                  {t('roleChangePending', { role: teamRoleLabel(t, pending.toRole) })}
                                </span>
                                <button className={styles.rejectBtn} onClick={() => handleCancelRoleRequest(pending.id)}>
                                  {t('cancelRemoval')}
                                </button>
                              </>)}
                              {isCurator && isDriftedLead(init, m) && (
                                <button
                                  className={styles.assignBtn}
                                  title={t('fixLeadAccessHint')}
                                  onClick={() => handleFixLeadAccess(init.id, m.userId)}
                                >
                                  {t('fixLeadAccess')}
                                </button>
                              )}
                              {isCurator && (
                                <button
                                  className={styles.removeBtn}
                                  onClick={() => handleRemoveMember(init.id, m.userId)}
                                >
                                  {t('removeMember')}
                                </button>
                              )}
                              </div>
                            </td>
                          </tr>
                          );
                        })}
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
