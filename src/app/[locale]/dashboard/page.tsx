'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/i18n/routing';
import { useEffect, useState } from 'react';
import {
  collection, getDocs, getCountFromServer, query, where,
  updateDoc, doc, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations } from 'next-intl';
import styles from './DashboardHome.module.css';

interface Stats {
  initiatives: number; activeInitiatives: number;
  blogs: number; subscribers: number;
  myProjects: number; unreadMessages: number;
  activityResponses: number;
}

interface Notification {
  id: string; type: string; message: string;
  initiativeTitle?: string; fromUserName?: string;
  read: boolean; createdAt: string;
}

export default function DashboardHome() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const t = useTranslations('Dashboard');
  const [stats, setStats] = useState<Stats>({
    initiatives: 0, activeInitiatives: 0, blogs: 0,
    subscribers: 0, myProjects: 0, unreadMessages: 0, activityResponses: 0,
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!loading && user?.role) fetchStats();
  }, [loading, user]);

  const fetchStats = async () => {
    const role      = user?.role?.toLowerCase().replace(/\s+/g, '_');
    const isCurator = role === 'curator' || role === 'vice_curator';
    const isShaper  = role === 'shaper'  || role === 'alumni';

    const next: Stats = {
      initiatives: 0, activeInitiatives: 0, blogs: 0,
      subscribers: 0, myProjects: 0, unreadMessages: 0, activityResponses: 0,
    };

    /* Each stat is isolated: a collection the current role may not read must
     * leave its own card at zero rather than blanking every other card. */
    const safe = async (fn: () => Promise<void>) => {
      try { await fn(); } catch { /* leave this stat at 0 */ }
    };

    await Promise.all([
      safe(async () => {
        // Hub Activities (dashboard/curator/activities) are stored as
        // initiatives docs tagged type:'hub_activity' — excluded from every
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
          const activeDocs = activeSnap.docs.filter(d => !(d.data() as any).type);
          next.initiatives       = total.data().count - activityCount;
          next.activeInitiatives = activeDocs.length;
          activeDocs.forEach(d => {
            const data = d.data();
            if (user && data.members?.some((m: any) => m.userId === user.uid)) next.myProjects++;
          });
        } else {
          // Nobody else needs the documents — count them server-side instead.
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

      // Curator-only collections — never queried by other roles, so they no
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
          next.activityResponses = (await getCountFromServer(collection(db, 'activity_responses'))).data().count;
        }),
        safe(async () => {
          // The panel renders at most 10, so only fetch 10.
          const notifSnap = await getDocs(
            query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(10)),
          );
          setNotifications(notifSnap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
        }),
      ] : []),
    ]);

    setStats(next);
  };

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

  const role      = user.role.toLowerCase().replace(/\s+/g, '_');
  const isCurator = role === 'curator' || role === 'vice_curator';
  const isImpact  = role === 'impact_officer';
  const isShaper  = role === 'shaper' || role === 'alumni';

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
        <h1 className={styles.greeting}>
          {greeting()}, {user.displayName || user.email?.split('@')[0] || 'there'}!
        </h1>
        <p className={styles.roleLine}>
          {t('loggedInAs')}{' '}
          <span className="badge badge-blue">{user.role.replace(/_/g, ' ')}</span>
        </p>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {isCurator && (<>
          <StatCard label={t('statActiveInitiatives')} value={stats.activeInitiatives} colorVar="blue"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard label={t('statBlogPosts')} value={stats.blogs} colorVar="purple"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
          <StatCard label={t('statSubscribers')} value={stats.subscribers} colorVar="green"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>} />
          <StatCard label={t('statUnreadMessages')} value={stats.unreadMessages} colorVar={stats.unreadMessages > 0 ? 'warning' : 'muted'}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard label={t('statActivityResponses')} value={stats.activityResponses} colorVar={stats.activityResponses > 0 ? 'warning' : 'muted'}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>} />
        </>)}
        {isImpact && (<>
          <StatCard label={t('statBlogPosts')} value={stats.blogs} colorVar="purple"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>} />
          <StatCard label={t('statTotalInitiatives')} value={stats.initiatives} colorVar="green"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
        </>)}
        {isShaper && (<>
          <StatCard label={t('statMyProjects')} value={stats.myProjects} colorVar="blue"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>} />
          <StatCard label={t('statTotalInitiatives')} value={stats.initiatives} colorVar="purple"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>} />
          <StatCard label={t('statBlogPosts')} value={stats.blogs} colorVar="green"
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
            <ActionCard title={t('dashInitiativesCardTitle')} desc={t('dashInitiativesCardDesc')} href="/dashboard/curator/initiatives" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>} />
            <ActionCard title={t('roster')} desc={t('dashRosterCardDesc')} href="/dashboard/curator/roster" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>} />
            <ActionCard title={`${t('dashMessagesCardTitle')}${stats.unreadMessages > 0 ? ` (${stats.unreadMessages})` : ''}`}
              desc={t('dashMessagesCardDesc')} href="/dashboard/curator/messages" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>}
              accent={stats.unreadMessages > 0} />
            <ActionCard title={t('actionWriteBlog')} desc={t('actionWriteBlogDesc')} href="/dashboard/curator/blogs" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
            <ActionCard title={t('roleAssignments')} desc={t('dashRoleAssignmentsCardDesc')} href="/dashboard/curator/members" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20v-1a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v1"/>
              </svg>} />
            <ActionCard title={t('exportEmails')} desc={t('actionExportEmailsDesc')} href="/dashboard/curator/exports" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>} />
            <ActionCard title={`${t('dashActivitiesCardTitle')}${stats.activityResponses > 0 ? ` (${stats.activityResponses})` : ''}`}
              desc={t('dashActivitiesCardDesc')} href="/dashboard/curator/activities" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>}
              accent={stats.activityResponses > 0} />
          </>)}
          {isImpact && (<>
            <ActionCard title={t('dashProjectsCardTitle')} desc={t('dashProjectsCardDesc')} href="/dashboard/impact/projects" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>} />
            <ActionCard title={t('actionWriteBlog')} desc={t('dashImpactWriteBlogDesc')} href="/dashboard/impact/blogs" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
          </>)}
          {isShaper && (<>
            <ActionCard title={t('actionBrowseInitiatives')} desc={t('actionBrowseInitiativesDesc')} href="/dashboard/shaper/initiatives" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>} />
            <ActionCard title={t('actionPostBlog')} desc={t('actionPostBlogDesc')} href="/dashboard/shaper/blogs" router={router}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>} />
          </>)}
        </div>
      </div>
      {/* Curator notifications panel */}
      {isCurator && notifications.length > 0 && (
        <div className={styles.notifSection}>
          <h3 className={styles.sectionTitle}>
            {t('notificationsLabel')}
            {unreadNotifs.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10,
                background: 'var(--primary-blue)', color: 'white',
                fontSize: '0.72rem', fontWeight: 700, marginInlineStart: '0.5rem',
              }}>{unreadNotifs.length}</span>
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
                    {new Date(n.createdAt).toLocaleString()}
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

function StatCard({ label, value, icon, colorVar }: { label: string; value: number; icon: React.ReactNode; colorVar?: string }) {
  return (
    <div className={styles.statCard} data-accent={colorVar}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

function ActionCard({ title, desc, href, router, icon, accent }: {
  title: string; desc: string; href: string;
  router: ReturnType<typeof useRouter>; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <button
      className={styles.actionCard + (accent ? ' ' + styles.actionCardAccent : '')}
      onClick={() => router.push(href)}
    >
      <div className={styles.actionIcon}>{icon}</div>
      <div className={styles.actionText}>
        <div className={styles.actionTitle}>{title}</div>
        <div className={styles.actionDesc}>{desc}</div>
      </div>
      <svg className={styles.actionArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  );
}
