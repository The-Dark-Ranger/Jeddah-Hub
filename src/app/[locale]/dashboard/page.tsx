'use client';

/* Dashboard home: a greeting, role-specific stats and quick links. */
import { useAuth } from '@/context/AuthContext';
import { Link } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, getCountFromServer, query, where,
  updateDoc, doc, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useLocale, useTranslations } from 'next-intl';
import { normalizeRole } from '@/lib/role';
import { safeColor } from '@/lib/activityTypes';
import { newsPath, slugify } from '@/lib/slug';
import { useCategoryLabel } from '@/lib/categoryLabel';
import type { UserProfile } from '@/lib/auth';
import styles from './DashboardHome.module.css';
import { memberId, type MemberEntry } from '@/lib/types';

interface Stats {
  initiatives: number; activeInitiatives: number;
  blogs: number; subscribers: number;
  myProjects: number; unreadMessages: number;
  activityResponses: number; pendingActivityRequests: number;
}

interface LiveActivity {
  id: string; title: string; slug?: string; date?: string; location?: string;
  imageUrl?: string; color?: string; kind?: string; active?: boolean;
  createdAt?: { toMillis?: () => number };
}

interface InitiativeLite {
  id: string; title: string; titleAr?: string; slug?: string; category?: string; status?: string;
  imageUrl?: string; problem?: string; objective?: string; impact?: string;
  members?: { userId: string; role?: string }[];
}

interface MessageLite { id: string; name: string; subject: string; message: string; submittedAt: string; read?: boolean; }

interface LatestPost { id: string; title: string; authorName?: string; createdAt?: string; }

interface Notification {
  id: string; type: string; message: string;
  initiativeTitle?: string; fromUserName?: string;
  read: boolean; createdAt: string;
}

export default function DashboardHome() {
  const { user, loading } = useAuth();
  const t = useTranslations('Dashboard');
  const tcat = useCategoryLabel();
  const locale = useLocale();
  const [statsLoading, setStatsLoading] = useState(true);
  const [liveActivities, setLiveActivities] = useState<LiveActivity[]>([]);
  const [latestPosts, setLatestPosts] = useState<LatestPost[]>([]);
  const [initiatives, setInitiatives] = useState<InitiativeLite[]>([]);
  const [recentMessages, setRecentMessages] = useState<MessageLite[]>([]);
  const [stats, setStats] = useState<Stats>({
    initiatives: 0, activeInitiatives: 0, blogs: 0,
    subscribers: 0, myProjects: 0, unreadMessages: 0, activityResponses: 0,
    pendingActivityRequests: 0,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchStats = async () => {
    const role      = normalizeRole(user?.role);
    const isCurator = role === 'curator' || role === 'vice_curator';
    const isImpact  = role === 'impact_officer';
    const isShaper  = role === 'shaper'  || role === 'alumni';

    const next: Stats = {
      initiatives: 0, activeInitiatives: 0, blogs: 0,
      subscribers: 0, myProjects: 0, unreadMessages: 0, activityResponses: 0,
      pendingActivityRequests: 0,
    };

    /* Each stat is isolated: a collection the current role may not read must
     * leave its own card at zero rather than blanking every other card. */
    const safe = async (fn: () => Promise<void>) => {
      try { await fn(); } catch { /* leave this stat at 0 */ }
    };

    await Promise.all([
      safe(async () => {
        // Hub Activities (dashboard/curator/activities) are stored as
        // initiatives docs tagged type:'hub_activity', excluded from every
        // count/list below the same way HomeFeaturedInitiatives, /projects,
        // and the curator Initiatives page already do.
        const activityCount = (await getCountFromServer(
          query(collection(db, 'initiatives'), where('type', '==', 'hub_activity')),
        )).data().count;

        if (isShaper) {
          // Shapers need per-document membership, so the active initiatives are
          // downloaded once and every count derived from that one snapshot.
          const [total, activeSnap] = await Promise.all([
            getCountFromServer(collection(db, 'initiatives')),
            getDocs(query(collection(db, 'initiatives'), where('status', '==', 'active'))),
          ]);
          const activeDocs = activeSnap.docs.filter(d => !d.data().type);
          next.initiatives       = total.data().count - activityCount;
          next.activeInitiatives = activeDocs.length;
          activeDocs.forEach(d => {
            const data = d.data();
            if (user && data.members?.some((m: MemberEntry) => memberId(m) === user.uid)) next.myProjects++;
          });
        } else {
          // Nobody else needs the documents, count them server-side instead.
          const [total, active, activeActivityCount] = await Promise.all([
            getCountFromServer(collection(db, 'initiatives')),
            getCountFromServer(query(collection(db, 'initiatives'), where('status', '==', 'active'))),
            getCountFromServer(query(collection(db, 'initiatives'),
              where('type', '==', 'hub_activity'), where('status', '==', 'active'))),
          ]);
          next.initiatives       = total.data().count - activityCount;
          next.activeInitiatives = active.data().count - activeActivityCount.data().count;
        }
      }),

      safe(async () => {
        // Non-curators may only read published posts, so the query has to say
        // so for the security rules to permit it at all.
        const target = isCurator
          ? collection(db, 'blogs')
          : query(collection(db, 'blogs'), where('status', '==', 'published'));
        next.blogs = (await getCountFromServer(target)).data().count;
      }),

      // Every real initiative (public read), feeds the category chart, a
      // Shaper's "your initiatives" list and the "needs attention" list.
      safe(async () => {
        const snap = await getDocs(collection(db, 'initiatives'));
        setInitiatives(snap.docs
          .filter(d => !(d.data() as { type?: string }).type)
          .map(d => ({ id: d.id, ...(d.data() as Omit<InitiativeLite, 'id'>) })));
      }),

      // What visitors see right now, shown to every role.
      safe(async () => {
        const snap = await getDocs(query(collection(db, 'initiatives'), where('type', '==', 'hub_activity')));
        setLiveActivities(snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<LiveActivity, 'id'>) }))
          .filter(a => a.active === true)
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
          .slice(0, 3));
      }),
      safe(async () => {
        let docs;
        try {
          docs = (await getDocs(query(collection(db, 'blogs'), where('status', '==', 'published'), orderBy('createdAt', 'desc'), limit(3)))).docs;
        } catch {
          // Composite index missing, sort client-side instead.
          docs = (await getDocs(query(collection(db, 'blogs'), where('status', '==', 'published')))).docs
            .sort((a, b) => String(b.data().createdAt ?? '').localeCompare(String(a.data().createdAt ?? '')))
            .slice(0, 3);
        }
        setLatestPosts(docs.map(d => ({ id: d.id, ...(d.data() as Omit<LatestPost, 'id'>) })));
      }),

      // Curator-only collections, never queried by other roles, so they no
      // longer fail the whole dashboard with a permission error.
      ...(isCurator ? [
        safe(async () => {
          next.subscribers = (await getCountFromServer(collection(db, 'newsletter_subscribers'))).data().count;
        }),
        safe(async () => {
          next.unreadMessages = (await getCountFromServer(
            query(collection(db, 'contact_messages'), where('read', '==', false)),
          )).data().count;
        }),
        safe(async () => {
          next.activityResponses = (await getCountFromServer(
            query(collection(db, 'activity_responses'), where('read', '==', false)),
          )).data().count;
        }),
        safe(async () => {
          const snap = await getDocs(query(collection(db, 'contact_messages'), orderBy('submittedAt', 'desc'), limit(3)));
          setRecentMessages(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MessageLite, 'id'>) })));
        }),
        safe(async () => {
          // The panel renders at most 10, so only fetch 10.
          const notifSnap = await getDocs(
            query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(10)),
          );
          setNotifications(notifSnap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
        }),
      ] : []),

      // Curatorship-team collection (curator/vice_curator/impact_officer):
      // pending Hub Activity proposals/edits awaiting a decision. Counted
      // across both activity_change_requests (the current lead-facing flow)
      // and the legacy activity_requests collection, so any request
      // submitted before that flow was retired still surfaces here.
      ...(isCurator || isImpact ? [
        safe(async () => {
          const [changeCount, legacyCount] = await Promise.all([
            getCountFromServer(query(collection(db, 'activity_change_requests'), where('status', '==', 'pending'))),
            getCountFromServer(query(collection(db, 'activity_requests'), where('status', '==', 'pending'))),
          ]);
          next.pendingActivityRequests = changeCount.data().count + legacyCount.data().count;
        }),
      ] : []),
    ]);

    setStats(next);
    setStatsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load stats once the user is known
    if (!loading && user?.role) fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the signed-in user changes
  }, [loading, user]);

  if (loading) return null;

  if (!user?.role) {
    return (
      <div className={styles.pending}>
        <div className={styles.pendingIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2>{t('pendingTitle')}</h2>
        <p>{t('pendingBody')}</p>
        <p className={styles.pendingEmail}>{t('signedInAs')} <strong>{user?.email}</strong></p>
      </div>
    );
  }

  const role      = normalizeRole(user.role);
  const isCurator = role === 'curator' || role === 'vice_curator';
  const isImpact  = role === 'impact_officer';
  const isShaper  = role === 'shaper' || role === 'alumni';

  const roleLabels: Record<string, string> = {
    curator: t('roleLabelCurator'), vice_curator: t('roleLabelViceCurator'),
    impact_officer: t('roleLabelImpactOfficer'), shaper: t('roleLabelShaper'), alumni: t('roleLabelAlumni'),
  };
  const roleLabel = roleLabels[role ?? ''] ?? String(user.role).replace(/_/g, ' ');
  const name = (locale === 'ar' && user.displayNameAr) || user.displayName || user.email?.split('@')[0] || '';
  const dateLocale = locale === 'ar' ? 'ar-SA' : 'en-US';
  const today = new Date().toLocaleDateString(dateLocale, { weekday: 'long', month: 'long', day: 'numeric' });

  const initTitle = (i: InitiativeLite) => (locale === 'ar' && i.titleAr) || i.title;

  // Initiatives per category, largest first.
  const byCategory = Object.entries(initiatives.reduce<Record<string, number>>((acc, i) => {
    const c = i.category?.trim() || t('uncategorised');
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(1, ...byCategory.map(([, n]) => n));

  const myInitiatives = initiatives.filter(i => i.members?.some(m => m.userId === user.uid));
  // Active initiatives whose public page is missing something visible.
  const needsAttention = initiatives
    .filter(i => i.status !== 'archived')
    .map(i => ({ i, missing: [
      !i.imageUrl && t('missingCover'),
      !i.problem && t('missingProblem'),
      !i.objective && t('missingObjective'),
      !i.impact && t('missingImpact'),
    ].filter(Boolean) as string[] }))
    .filter(x => x.missing.length > 0)
    .slice(0, 4);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('goodMorning');
    if (h < 18) return t('goodAfternoon');
    return t('goodEvening');
  };

  const markNotifRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  };

  const unreadNotifs = notifications.filter(n => !n.read);

  return (
    <div className={styles.page}>

      {/* Welcome */}
      <div className={styles.welcome}>
        <p className={styles.today}>{today}</p>
        <h1 className={styles.greeting}>
          {greeting()}{name ? `, ${name}` : ''}!
        </h1>
        <p className={styles.roleLine}>
          {t('loggedInAs')}{' '}
          <span className="badge badge-blue">{roleLabel}</span>
        </p>
      </div>

      <ProfileCompleteness user={user} t={t} />

      {/* Stats */}
      <div className={styles.statsGrid} aria-busy={statsLoading}>
        {isCurator && (<>
          <StatCard loading={statsLoading} label={t('statActiveInitiatives')} value={stats.activeInitiatives} colorVar="blue"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statBlogPosts')} value={stats.blogs} colorVar="purple"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statSubscribers')} value={stats.subscribers} colorVar="green"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statUnreadMessages')} value={stats.unreadMessages} colorVar={stats.unreadMessages > 0 ? 'warning' : 'muted'}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statActivityResponses')} value={stats.activityResponses} colorVar={stats.activityResponses > 0 ? 'warning' : 'muted'}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>} />
        </>)}
        {isImpact && (<>
          <StatCard loading={statsLoading} label={t('statBlogPosts')} value={stats.blogs} colorVar="purple"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statTotalInitiatives')} value={stats.initiatives} colorVar="green"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
        </>)}
        {isShaper && (<>
          <StatCard loading={statsLoading} label={t('statMyProjects')} value={stats.myProjects} colorVar="blue"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statTotalInitiatives')} value={stats.initiatives} colorVar="purple"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard loading={statsLoading} label={t('statBlogPosts')} value={stats.blogs} colorVar="green"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
        </>)}
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className={styles.sectionTitle}>{t('quickActions')}</h3>
        <div className={styles.actionGrid}>
          {isCurator && (<>
            <ActionCard title={t('dashInitiativesCardTitle')} desc={t('dashInitiativesCardDesc')} href="/dashboard/curator/initiatives"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>} />
            <ActionCard title={t('roster')} desc={t('dashRosterCardDesc')} href="/dashboard/curator/roster"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>} />
            <ActionCard title={`${t('dashMessagesCardTitle')}${stats.unreadMessages > 0 ? ` (${stats.unreadMessages})` : ''}`}
              desc={t('dashMessagesCardDesc')} href="/dashboard/curator/messages"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>}
              accent={stats.unreadMessages > 0} />
            <ActionCard title={t('actionWriteBlog')} desc={t('actionWriteBlogDesc')} href="/dashboard/curator/blogs"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
            <ActionCard title={t('roleAssignments')} desc={t('dashRoleAssignmentsCardDesc')} href="/dashboard/curator/members"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/>
              </svg>} />
            <ActionCard title={t('exportEmails')} desc={t('actionExportEmailsDesc')} href="/dashboard/curator/exports"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>} />
            <ActionCard title={`${t('dashActivitiesCardTitle')}${stats.activityResponses > 0 ? ` (${stats.activityResponses})` : ''}`}
              desc={t('dashActivitiesCardDesc')} href="/dashboard/curator/activities"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>}
              accent={stats.activityResponses > 0} />
            {stats.pendingActivityRequests > 0 && (
              <ActionCard title={`${t('dashActivityRequestsCardTitle')} (${stats.pendingActivityRequests})`}
                desc={t('dashActivityRequestsCardDesc')} href="/dashboard/curator/activities"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>}
                accent />
            )}
          </>)}
          {isImpact && (<>
            <ActionCard title={t('dashProjectsCardTitle')} desc={t('dashProjectsCardDesc')} href="/dashboard/impact/projects"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>} />
            <ActionCard title={t('actionWriteBlog')} desc={t('dashImpactWriteBlogDesc')} href="/dashboard/impact/blogs"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
            <ActionCard title={t('dashActivitiesCardTitle')}
              desc={t('dashActivitiesCardDesc')} href="/dashboard/curator/activities"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>} />
            {stats.pendingActivityRequests > 0 && (
              <ActionCard title={`${t('dashActivityRequestsCardTitle')} (${stats.pendingActivityRequests})`}
                desc={t('dashActivityRequestsCardDesc')} href="/dashboard/curator/activities"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>}
                accent />
            )}
          </>)}
          {isShaper && (<>
            <ActionCard title={t('myProjects')} desc={t('dashMyProjectsCardDesc')} href="/dashboard/shaper/my-projects"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>} />
            <ActionCard title={t('actionBrowseInitiatives')} desc={t('actionBrowseInitiativesDesc')} href="/dashboard/shaper/initiatives"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>} />
            <ActionCard title={t('actionPostBlog')} desc={t('actionPostBlogDesc')} href="/dashboard/shaper/blogs"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
            <ActionCard title={t('communityCharter')} desc={t('dashCharterCardDesc')} href="/dashboard/shaper/charter"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>} />
          </>)}
        </div>
      </div>

      {/* What the public sees right now */}
      <div className={styles.liveGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{t('liveActivitiesTitle')}</h3>
            {(isCurator || isImpact) && <Link href="/dashboard/curator/activities" className={styles.panelLink}>{t('manage')}</Link>}
          </div>
          {statsLoading ? (
            <div className={styles.panelSkeleton}><span /><span /></div>
          ) : liveActivities.length === 0 ? (
            <p className={styles.panelEmpty}>{t('noLiveActivities')}</p>
          ) : (
            <ul className={styles.liveList}>
              {liveActivities.map(a => (
                <li key={a.id}>
                  <Link
                    href={`/activities/${a.slug || slugify(a.title)}`}
                    className={styles.liveItem}
                    style={safeColor(a.color) ? { '--item-accent': a.color } as React.CSSProperties : undefined}
                  >
                    {a.imageUrl
                      ? <img src={a.imageUrl} alt="" className={styles.liveThumb} loading="lazy" />
                      : <span className={styles.liveThumb + ' ' + styles.liveThumbEmpty} aria-hidden="true" />}
                    <span className={styles.liveText}>
                      <span className={styles.liveTitle}>{a.title}</span>
                      <span className={styles.liveMeta}>{[a.date, a.location].filter(Boolean).join(' · ') || (a.kind === 'workshop' ? t('kindWorkshop') : t('kindActivity'))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{t('latestNewsTitle')}</h3>
            <Link href="/news" className={styles.panelLink}>{t('viewAll')}</Link>
          </div>
          {statsLoading ? (
            <div className={styles.panelSkeleton}><span /><span /></div>
          ) : latestPosts.length === 0 ? (
            <p className={styles.panelEmpty}>{t('noLatestNews')}</p>
          ) : (
            <ul className={styles.liveList}>
              {latestPosts.map(p => (
                <li key={p.id}>
                  <Link href={newsPath(p)} className={styles.liveItem}>
                    <span className={styles.newsDot} aria-hidden="true" />
                    <span className={styles.liveText}>
                      <span className={styles.liveTitle}>{p.title}</span>
                      <span className={styles.liveMeta}>
                        {[p.authorName, p.createdAt && new Date(p.createdAt).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {/* Hub insights */}
      <div className={styles.liveGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{t('byCategoryTitle')}</h3>
            <span className={styles.panelMeta}>{t('initiativesTotal', { count: initiatives.length })}</span>
          </div>
          {statsLoading ? (
            <div className={styles.panelSkeleton}><span /><span /></div>
          ) : byCategory.length === 0 ? (
            <p className={styles.panelEmpty}>{t('noInitiativesYet')}</p>
          ) : (
            <ul className={styles.bars}>
              {byCategory.map(([cat, n]) => (
                <li key={cat} className={styles.barRow}>
                  <span className={styles.barLabel}>{tcat(cat)}</span>
                  <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${(n / maxCat) * 100}%` }} /></span>
                  <span className={styles.barValue}>{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isShaper && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>{t('yourInitiatives')}</h3>
              <Link href="/dashboard/shaper/initiatives" className={styles.panelLink}>{t('browse')}</Link>
            </div>
            {statsLoading ? (
              <div className={styles.panelSkeleton}><span /><span /></div>
            ) : myInitiatives.length === 0 ? (
              <p className={styles.panelEmpty}>{t('noInitiativesJoined')}</p>
            ) : (
              <ul className={styles.liveList}>
                {myInitiatives.slice(0, 4).map(i => (
                  <li key={i.id}>
                    <Link href={`/projects/${i.slug || slugify(i.title)}`} className={styles.liveItem}>
                      {i.imageUrl
                        ? <img src={i.imageUrl} alt="" className={styles.liveThumb} loading="lazy" />
                        : <span className={styles.liveThumb + ' ' + styles.liveThumbEmpty} aria-hidden="true" />}
                      <span className={styles.liveText}>
                        <span className={styles.liveTitle}>{initTitle(i)}</span>
                        <span className={styles.liveMeta}>
                          {[i.members?.find(m => m.userId === user.uid)?.role, i.category && tcat(i.category)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isCurator && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle}>{t('recentMessages')}</h3>
              <Link href="/dashboard/curator/messages" className={styles.panelLink}>{t('viewAll')}</Link>
            </div>
            {statsLoading ? (
              <div className={styles.panelSkeleton}><span /><span /></div>
            ) : recentMessages.length === 0 ? (
              <p className={styles.panelEmpty}>{t('noMessages')}</p>
            ) : (
              <ul className={styles.liveList}>
                {recentMessages.map(m => (
                  <li key={m.id}>
                    <Link href="/dashboard/curator/messages" className={styles.liveItem}>
                      <span className={styles.msgAvatar + (m.read ? '' : ' ' + styles.msgAvatarUnread)} aria-hidden="true">
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className={styles.liveText}>
                        <span className={styles.liveTitle}>{m.name}</span>
                        <span className={styles.liveMeta}>{m.message}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isImpact && (
          <NeedsAttention items={needsAttention} statsLoading={statsLoading} t={t} initTitle={initTitle} href="/dashboard/impact/projects" />
        )}
      </div>

      {isCurator && (
        <div className={styles.liveGrid}>
          <NeedsAttention items={needsAttention} statsLoading={statsLoading} t={t} initTitle={initTitle} href="/dashboard/curator/initiatives" />
        </div>
      )}

      {/* Curator notifications panel */}
      {isCurator && notifications.length > 0 && (
        <div className={styles.notifSection}>
          <h3 className={styles.sectionTitle}>
            {t('notificationsLabel')}
            {unreadNotifs.length > 0 && (
              <span className={styles.countBadge}>{unreadNotifs.length}</span>
            )}
          </h3>
          <div className={styles.notifList}>
            {notifications.slice(0, 10).map(n => (
              <div key={n.id} className={styles.notifCard + (!n.read ? ' ' + styles.unread : '')}>
                <div className={styles.notifIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 .49-3.68"/>
                  </svg>
                </div>
                <div className={styles.notifBody}>
                  <p className={styles.notifMsg}>{n.message}</p>
                  <p className={styles.notifTime}>
                    {new Date(n.createdAt).toLocaleString(dateLocale)}
                  </p>
                  {!n.read && (
                    <div className={styles.notifActions}>
                      <button className={styles.notifMarkRead} onClick={() => markNotifRead(n.id)}>
                        {t('markAsRead')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, colorVar, loading }: { label: string; value: number; icon: React.ReactNode; colorVar?: string; loading?: boolean }) {
  return (
    <div className={styles.statCard} data-accent={colorVar}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>
        {loading ? <span className={styles.statSkeleton} aria-hidden="true" /> : value.toLocaleString()}
      </div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

/** Active initiatives whose public page is missing a cover or story section. */
function NeedsAttention({ items, statsLoading, t, initTitle, href }: {
  items: { i: InitiativeLite; missing: string[] }[];
  statsLoading: boolean;
  t: ReturnType<typeof useTranslations>;
  initTitle: (i: InitiativeLite) => string;
  href: string;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{t('needsAttention')}</h3>
        <Link href={href} className={styles.panelLink}>{t('manage')}</Link>
      </div>
      {statsLoading ? (
        <div className={styles.panelSkeleton}><span /><span /></div>
      ) : items.length === 0 ? (
        <p className={styles.panelEmpty}>{t('allComplete')}</p>
      ) : (
        <ul className={styles.liveList}>
          {items.map(({ i, missing }) => (
            <li key={i.id}>
              <Link href={href} className={styles.liveItem}>
                <span className={styles.attentionDot} aria-hidden="true" />
                <span className={styles.liveText}>
                  <span className={styles.liveTitle}>{initTitle(i)}</span>
                  <span className={styles.liveMeta}>{t('missingLabel')}: {missing.join(' · ')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Nudges every member toward a complete public profile, the fields the
 *  "Our Shapers" page and initiative member lists actually show. */
function ProfileCompleteness({ user, t }: { user: UserProfile; t: ReturnType<typeof useTranslations> }) {
  const checks = [
    { done: !!user.photoURL, label: t('profileCheckPhoto') },
    { done: !!user.displayName, label: t('profileCheckName') },
    { done: !!user.displayNameAr, label: t('profileCheckNameAr') },
    { done: !!user.bio, label: t('profileCheckBio') },
    { done: !!user.bioAr, label: t('profileCheckBioAr') },
    { done: !!(user.linkedin || user.twitter || user.instagram), label: t('profileCheckSocial') },
  ];
  const done = checks.filter(c => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  if (pct === 100) return null;
  const missing = checks.filter(c => !c.done).slice(0, 3);

  return (
    <Link href="/dashboard/shaper/profile" className={styles.profileCard}>
      <span className={styles.profileRing} style={{ '--pct': pct } as React.CSSProperties} aria-hidden="true">
        <span>{pct}%</span>
      </span>
      <span className={styles.profileText}>
        <span className={styles.profileTitle}>{t('profileCompleteTitle', { pct })}</span>
        <span className={styles.profileMissing}>{t('profileMissing')}: {missing.map(m => m.label).join(' · ')}</span>
      </span>
      <span className={styles.profileCta}>{t('editProfile')}</span>
    </Link>
  );
}

function ActionCard({ title, desc, href, icon, accent }: {
  title: string; desc: string; href: string; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={styles.actionCard + (accent ? ' ' + styles.actionCardAccent : '')}
    >
      <div className={styles.actionIcon}>{icon}</div>
      <div className={styles.actionText}>
        <div className={styles.actionTitle}>{title}</div>
        <div className={styles.actionDesc}>{desc}</div>
      </div>
      <svg className={styles.actionArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </Link>
  );
}
