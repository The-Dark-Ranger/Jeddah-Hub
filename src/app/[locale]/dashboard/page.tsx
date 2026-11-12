'use client';

/* Dashboard Overview, where every member starts: a greeting, what is
 * waiting for them (each queue their role works on), role-specific stats,
 * quick links, and what the public sees right now. */
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
import RoleHero, { HeroBadge, HeroLine } from '@/components/dashboard/RoleHero';
import { memberId, type MemberEntry } from '@/lib/types';
import { intlLocale } from '@/lib/dates';
import DashIcon, { type DashIconName } from '@/components/dashboard/DashIcon';

interface Stats {
  initiatives: number; activeInitiatives: number; members: number;
  blogs: number; subscribers: number;
  myProjects: number; unreadMessages: number;
  activityResponses: number; pendingActivityRequests: number;
  pendingRoleChanges: number; pendingPosts: number; pendingProposals: number;
  pendingJoin: number; pendingLeave: number; pendingAdd: number; pendingRemoval: number;
  /** Initiatives this member leads, and their teams' open join and leave requests. */
  ledTeams: number; teamRequests: number;
}

const NO_STATS: Stats = {
  initiatives: 0, activeInitiatives: 0, members: 0, blogs: 0, subscribers: 0, myProjects: 0,
  unreadMessages: 0, activityResponses: 0, pendingActivityRequests: 0, pendingRoleChanges: 0,
  pendingPosts: 0, pendingProposals: 0, pendingJoin: 0, pendingLeave: 0, pendingAdd: 0, pendingRemoval: 0,
  ledTeams: 0, teamRequests: 0,
};

/** How many documents in `name` are still pending (one cheap count read). */
const countPending = async (name: string, ...filters: ReturnType<typeof where>[]) =>
  (await getCountFromServer(query(collection(db, name), where('status', '==', 'pending'), ...filters))).data().count;

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
  const [stats, setStats] = useState<Stats>(NO_STATS);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchStats = async () => {
    const role      = normalizeRole(user?.role);
    const isCurator = role === 'curator' || role === 'vice_curator';
    const isImpact  = role === 'impact_officer';

    const next: Stats = { ...NO_STATS };

    /* Each stat is isolated: a collection the current role may not read must
     * leave its own card at zero rather than blanking every other card. */
    const safe = async (fn: () => Promise<void>) => {
      try { await fn(); } catch { /* leave this stat at 0 */ }
    };

    await Promise.all([
      // One read of the collection feeds every initiative count and list on
      // this page. Hub Activities are stored here too, as docs tagged
      // type:'hub_activity', and are kept apart from real initiatives.
      safe(async () => {
        const docs = (await getDocs(collection(db, 'initiatives'))).docs;
        const real = docs.filter(d => !d.data().type);
        const active = real.filter(d => d.data().status === 'active');
        next.initiatives       = real.length;
        next.activeInitiatives = active.length;
        next.myProjects        = active.filter(d =>
          d.data().members?.some((m: MemberEntry) => memberId(m) === user?.uid)).length;
        setInitiatives(real.map(d => ({ id: d.id, ...(d.data() as Omit<InitiativeLite, 'id'>) })));
        // What visitors see right now, shown to every role.
        setLiveActivities(docs
          .filter(d => d.data().type === 'hub_activity')
          .map(d => ({ id: d.id, ...(d.data() as Omit<LiveActivity, 'id'>) }))
          .filter(a => a.active === true)
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
          .slice(0, 3));
        // A lead's teams: their open join and leave requests ('in' takes up to 30).
        const led = real.filter(d => (d.data().leads as string[] | undefined)?.includes(user?.uid ?? '')).map(d => d.id);
        next.ledTeams = led.length;
        if (led.length && !isCurator) {
          const teams = where('initiativeId', 'in', led.slice(0, 30));
          const [join, leave] = await Promise.all([countPending('join_requests', teams), countPending('leave_requests', teams)]);
          next.teamRequests = join + leave;
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
        safe(async () => { next.pendingRoleChanges = await countPending('role_change_requests'); }),
        safe(async () => { next.pendingProposals = await countPending('initiative_requests'); }),
        safe(async () => { next.pendingJoin = await countPending('join_requests'); }),
        safe(async () => { next.pendingLeave = await countPending('leave_requests'); }),
        safe(async () => { next.pendingAdd = await countPending('member_add_requests'); }),
        safe(async () => { next.pendingRemoval = await countPending('removal_requests'); }),
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
      // Hub Activity proposals and edits awaiting a decision. Counted across
      // activity_change_requests (what members send now) and the retired
      // activity_requests, so anything sent before that form was retired
      // still surfaces here.
      ...(isCurator || isImpact ? [
        safe(async () => {
          const [changes, legacy] = await Promise.all([countPending('activity_change_requests'), countPending('activity_requests')]);
          next.pendingActivityRequests = changes + legacy;
        }),
        safe(async () => {
          next.pendingPosts = (await getCountFromServer(
            query(collection(db, 'blogs'), where('status', '==', 'pending_review')),
          )).data().count;
        }),
        safe(async () => { next.members = (await getCountFromServer(collection(db, 'users'))).data().count; }),
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
  const dateLocale = intlLocale(locale);
  const today = new Date().toLocaleDateString(dateLocale, { weekday: 'long', month: 'long', day: 'numeric' });

  const initTitle = (i: InitiativeLite) => (locale === 'ar' && i.titleAr) || i.title;

  // Initiatives per category, largest first.
  const byCategory = Object.entries(initiatives.reduce<Record<string, number>>((acc, i) => {
    const c = i.category?.trim() || t('uncategorised');
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(1, ...byCategory.map(([, n]) => n));

  const myInitiatives = initiatives.filter(i => i.members?.some(m => memberId(m) === user.uid));
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

  // Each queue this role works on, linking to where it's handled; only
  // those with something in them are listed.
  const waiting: { label: string; count: number; href: string; icon: DashIconName }[] = isCurator ? [
    { label: t('waitMessages'), count: stats.unreadMessages, href: '/dashboard/curator/messages', icon: 'message' },
    { label: t('waitPosts'), count: stats.pendingPosts, href: '/dashboard/curator/blogs', icon: 'pen' },
    { label: t('waitProposals'), count: stats.pendingProposals, href: '/dashboard/curator/initiatives', icon: 'folder' },
    { label: t('waitJoin'), count: stats.pendingJoin, href: '/dashboard/curator/roster', icon: 'people' },
    { label: t('waitLeave'), count: stats.pendingLeave, href: '/dashboard/curator/initiatives', icon: 'people' },
    { label: t('waitAdd'), count: stats.pendingAdd, href: '/dashboard/curator/initiatives', icon: 'person' },
    { label: t('waitRemoval'), count: stats.pendingRemoval, href: '/dashboard/curator/initiatives', icon: 'person' },
    { label: t('waitRoleChanges'), count: stats.pendingRoleChanges, href: '/dashboard/curator/roster', icon: 'people' },
    { label: t('waitActivities'), count: stats.pendingActivityRequests, href: '/dashboard/curator/activities', icon: 'bell' },
    { label: t('waitResponses'), count: stats.activityResponses, href: '/dashboard/curator/activities', icon: 'check' },
  ] : isImpact ? [
    { label: t('waitPosts'), count: stats.pendingPosts, href: '/dashboard/impact/blogs', icon: 'pen' },
    { label: t('waitActivities'), count: stats.pendingActivityRequests, href: '/dashboard/curator/activities', icon: 'bell' },
  ] : stats.ledTeams > 0 ? [
    { label: t('waitTeamRequests'), count: stats.teamRequests, href: '/dashboard/shaper/my-projects', icon: 'people' },
  ] : [];
  const waitingNow = waiting.filter(w => w.count > 0);

  const statCards: { label: string; value: number; colorVar: string; icon: DashIconName }[] = isCurator ? [
    { label: t('statActiveInitiatives'), value: stats.activeInitiatives, colorVar: 'blue', icon: 'folder' },
    { label: t('statMembers'), value: stats.members, colorVar: 'green', icon: 'people' },
    { label: t('statBlogPosts'), value: stats.blogs, colorVar: 'purple', icon: 'pen' },
    { label: t('statSubscribers'), value: stats.subscribers, colorVar: 'blue', icon: 'mail' },
  ] : isImpact ? [
    { label: t('statTotalInitiatives'), value: stats.initiatives, colorVar: 'blue', icon: 'folder' },
    { label: t('statMembers'), value: stats.members, colorVar: 'green', icon: 'people' },
    { label: t('statBlogPosts'), value: stats.blogs, colorVar: 'purple', icon: 'pen' },
  ] : isShaper ? [
    { label: t('statMyProjects'), value: stats.myProjects, colorVar: 'blue', icon: 'star' },
    { label: t('statTotalInitiatives'), value: stats.initiatives, colorVar: 'purple', icon: 'folder' },
    { label: t('statBlogPosts'), value: stats.blogs, colorVar: 'green', icon: 'pen' },
  ] : [];

  const actions: { title: string; desc: string; href: string; icon: DashIconName }[] = isCurator ? [
    { title: t('dashInitiativesCardTitle'), desc: t('dashInitiativesCardDesc'), href: '/dashboard/curator/initiatives', icon: 'folder' },
    { title: t('roster'), desc: t('dashRosterCardDesc'), href: '/dashboard/curator/roster', icon: 'people' },
    { title: t('dashMessagesCardTitle'), desc: t('dashMessagesCardDesc'), href: '/dashboard/curator/messages', icon: 'message' },
    { title: t('actionWriteBlog'), desc: t('actionWriteBlogDesc'), href: '/dashboard/curator/blogs', icon: 'pen' },
    { title: t('roleAssignments'), desc: t('dashRoleAssignmentsCardDesc'), href: '/dashboard/curator/members', icon: 'person' },
    { title: t('exportEmails'), desc: t('actionExportEmailsDesc'), href: '/dashboard/curator/exports', icon: 'download' },
    { title: t('dashActivitiesCardTitle'), desc: t('dashActivitiesCardDesc'), href: '/dashboard/curator/activities', icon: 'check' },
  ] : isImpact ? [
    { title: t('dashProjectsCardTitle'), desc: t('dashProjectsCardDesc'), href: '/dashboard/impact/projects', icon: 'folder' },
    { title: t('actionWriteBlog'), desc: t('dashImpactWriteBlogDesc'), href: '/dashboard/impact/blogs', icon: 'pen' },
    { title: t('dashActivitiesCardTitle'), desc: t('dashActivitiesCardDesc'), href: '/dashboard/curator/activities', icon: 'check' },
  ] : isShaper ? [
    { title: t('myProjects'), desc: t('dashMyProjectsCardDesc'), href: '/dashboard/shaper/my-projects', icon: 'star' },
    { title: t('myActivitiesTitle'), desc: t('dashMyActivitiesCardDesc'), href: '/dashboard/shaper/activities', icon: 'calendar' },
    { title: t('actionBrowseInitiatives'), desc: t('actionBrowseInitiativesDesc'), href: '/dashboard/shaper/initiatives', icon: 'search' },
    { title: t('actionPostBlog'), desc: t('actionPostBlogDesc'), href: '/dashboard/shaper/blogs', icon: 'pen' },
    { title: t('communityCharter'), desc: t('dashCharterCardDesc'), href: '/dashboard/shaper/charter', icon: 'file' },
  ] : [];

  return (
    <div className={styles.page}>

      {/* Welcome banner, in the member's role colour */}
      <RoleHero
        as="h1" role={role} photoURL={user.photoURL} name={name}
        eyebrow={today}
        title={<>{greeting()}{name ? `, ${name}` : ''}!</>}
      >
        <HeroLine>{t('loggedInAs')} <HeroBadge>{roleLabel}</HeroBadge></HeroLine>
      </RoleHero>

      <ProfileCompleteness user={user} t={t} />

      {/* What is waiting for this member, queue by queue */}
      {waiting.length > 0 && (
        <section className={styles.panel + ' ' + styles.waitPanel} aria-busy={statsLoading}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{t('waitingTitle')}</h2>
            {!statsLoading && waitingNow.length > 0 && (
              <span className={styles.countBadge}>{waitingNow.reduce((n, w) => n + w.count, 0)}</span>
            )}
          </div>
          {statsLoading ? (
            <div className={styles.panelSkeleton}><span /><span /></div>
          ) : waitingNow.length === 0 ? (
            <p className={styles.panelEmpty}>{t('waitingNone')}</p>
          ) : (
            <ul className={styles.waitList}>
              {waitingNow.map(w => (
                <li key={w.label}>
                  <Link href={w.href} className={styles.waitItem}>
                    <span className={styles.waitIcon}><DashIcon name={w.icon} /></span>
                    <span className={styles.waitLabel}>{w.label}</span>
                    <span className={styles.waitCount}>{w.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Stats */}
      <div className={styles.statsGrid} aria-busy={statsLoading}>
        {statCards.map(c => <StatCard key={c.label} loading={statsLoading} {...c} />)}
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className={styles.sectionTitle}>{t('quickActions')}</h3>
        <div className={styles.actionGrid}>
          {actions.map(a => <ActionCard key={a.href + a.title} {...a} />)}
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
                          {[i.members?.find(m => memberId(m) === user.uid)?.role, i.category && tcat(i.category)].filter(Boolean).join(' · ')}
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
                <div className={styles.notifIcon}><DashIcon name="refresh" /></div>
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

function StatCard({ label, value, icon, colorVar, loading }: { label: string; value: number; icon: DashIconName; colorVar?: string; loading?: boolean }) {
  return (
    <div className={styles.statCard} data-accent={colorVar}>
      <div className={styles.statIcon}><DashIcon name={icon} size={20} /></div>
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

function ActionCard({ title, desc, href, icon }: { title: string; desc: string; href: string; icon: DashIconName }) {
  return (
    <Link href={href} className={styles.actionCard}>
      <div className={styles.actionIcon}><DashIcon name={icon} size={18} /></div>
      <div className={styles.actionText}>
        <div className={styles.actionTitle}>{title}</div>
        <div className={styles.actionDesc}>{desc}</div>
      </div>
      <DashIcon name="chevron" className={styles.actionArrow} />
    </Link>
  );
}
