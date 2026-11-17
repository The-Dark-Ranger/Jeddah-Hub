'use client';

/* Dashboard > Initiatives (curators and impact officers): create, edit,
 * archive and feature initiatives, manage teams, and review proposals and
 * membership requests. Featuring on the homepage is the curatorship's call
 * alone (firestore.rules agrees); when an impact officer archives or
 * restores an initiative, the curators get a notice on their Overview. */
import { useState, useEffect, useCallback, useId, type Dispatch, type SetStateAction } from 'react';
import {
  collection, addDoc, getDocs, updateDoc, doc, query, orderBy, where, arrayUnion, type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import DashSearch, { matchesQuery } from '@/components/dashboard/DashSearch';
import type { ReportInitiative } from '@/lib/initiativeReport';
import InitiativeCover from '@/components/InitiativeCover';
import { uniqueInitiativeSlug } from '@/lib/slug';
import { normalizeRole } from '@/lib/role';
import { intlLocale } from '@/lib/dates';
import { setSpotlight } from '@/lib/spotlight';
import SearchSelect from '@/components/dashboard/SearchSelect';
import LoadFailed from '@/components/dashboard/LoadFailed';
import { useBusy } from '@/components/dashboard/useBusy';
import { useDialog } from '@/components/dashboard/useDialog';
import { useReportDownload } from '@/components/dashboard/useReportDownload';
import { useSaveFailed } from '@/components/dashboard/useSaveFailed';
import { omitKeys } from '@/lib/omitKeys';
import { orNull } from '@/lib/partialLoad';
import { addToTeam, approveOnce, removeFromTeam } from '@/lib/teamChanges';
import ModalPortal from '@/components/ModalPortal';
import InitiativeFormFields, {
  emptyInitiativeForm as emptyForm, initiativeFormToDoc as formToDoc, initiativeToForm,
  type InitiativeFormShape as FormShape,
} from '@/components/InitiativeFormFields';
import styles from './Initiatives.module.css';
import TeamRoleSelect, { teamRoleLabel } from '@/components/dashboard/TeamRoleSelect';
import { CategoryLabel } from '@/lib/categoryLabel';
import { safeColor } from '@/lib/activityTypes';
import RequestQueue from './RequestQueue';
import {
  errorCode, isLeadRole,
  type InitiativeMember, type MemberEntry, type MembershipRequest, type LeadRequest, type Proposal, type TeamRole,
} from '@/lib/types';

interface Initiative {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'archived';
  category?: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  images?: string[];
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  color?: string;
  slug?: string;
  createdAt: string;
  /** Always objects here: older bare-id entries are read as { userId }. */
  members?: InitiativeMember[];
  /** Who has lead rights (what firestore.rules checks). */
  leads?: string[];
  /** Hand-picked for the homepage's Featured Initiatives section. */
  featured?: boolean;
  /** The one initiative shown in the Initiatives page's Spotlight card. */
  spotlight?: boolean;
  featuredAt?: string;
}

interface UserLite { id: string; displayName?: string; displayNameAr?: string; email?: string }

/** How many initiatives the homepage's Featured section shows at most. */
const MAX_FEATURED = 3;

/* ── Default seed data ── */
const DEFAULT_INITIATIVES = [
  { title: 'Rise Up', category: 'Economy', stat: '60+ businesses mentored', status: 'active',
    description: 'Mentoring small businesses with limited resources to achieve sustainable growth through expert guidance.',
    problem: 'Many small business owners in Jeddah lack access to mentorship, networks, and strategic guidance needed to scale sustainably.',
    objective: 'Connect aspiring entrepreneurs with experienced mentors across business, finance, and operations.',
    impact: 'Over three cohorts, Rise Up has mentored 60+ small businesses, with participants reporting an average 35% revenue increase within 12 months.',
    impactAreas: ['Economy', 'Entrepreneurship', 'Youth'] },
  { title: 'Anti-Bullying Campaign', category: 'Wellbeing', stat: '4,000+ students reached', status: 'active',
    description: 'Creating spaces where youth feel heard, understood, and accepted. Encouraging empathy among young people.',
    problem: 'Bullying remains a significant issue in Jeddah schools. Many students suffer in silence due to stigma and limited reporting channels.',
    objective: 'Run awareness campaigns in schools, train student ambassadors, and build peer-support structures.',
    impact: 'Reached 4,000+ students across 12 schools. Trained 200+ student ambassadors.',
    impactAreas: ['Wellbeing', 'Education', 'Youth', 'Community'] },
  { title: 'Mindfulness for Peace', category: 'Wellbeing', stat: '85% stress reduction reported', status: 'active',
    description: 'Mindfulness workshops and tools that help young people handle stress and build resilience.',
    problem: 'Academic pressure and social media are driving unprecedented stress levels among young people in Jeddah.',
    objective: 'Introduce evidence-based mindfulness practices through workshops and a free digital resource toolkit.',
    impact: 'Delivered 30+ workshops reaching 1,500+ participants. 85% reported reduced stress after a four-week program.',
    impactAreas: ['Wellbeing', 'Mental Health', 'Youth'] },
  { title: 'Green Jeddah', category: 'Environment', stat: '2,000+ trees planted', status: 'active',
    description: 'Environmental awareness campaigns and tree-planting drives across local schools and neighborhoods.',
    problem: "Rapid urban development is taking a toll on Jeddah's green spaces. Young people feel disconnected from environmental issues.",
    objective: 'Mobilize youth as environmental stewards through tree-planting events, beach clean-ups, and school sustainability modules.',
    impact: 'Planted 2,000+ trees across six neighborhoods. Organized 15 beach clean-ups removing 4+ tonnes of waste.',
    impactAreas: ['Environment', 'Community', 'Education'] },
  { title: 'Tech Literacy', category: 'Education', stat: '800+ participants trained', status: 'active',
    description: 'Digital skills workshops for underserved youth and women re-entering the workforce.',
    problem: 'The digital divide disproportionately affects low-income youth and women returning to work.',
    objective: 'Provide free workshops in coding, AI basics, and cybersecurity. Partner with local organizations to reach underserved communities.',
    impact: 'Trained 800+ participants across 20 free workshops. 60% reported gaining new employment within six months.',
    impactAreas: ['Education', 'Technology', 'Economy', 'Youth'] },
  { title: 'Community Connect', category: 'Community', stat: '1,200+ active members', status: 'active',
    description: 'Monthly networking gatherings connecting young professionals and entrepreneurs in Jeddah.',
    problem: 'Young professionals in Jeddah often operate in silos. The absence of cross-sector infrastructure limits collaboration.',
    objective: 'Host monthly curated events bringing together 50-150 young professionals across industries.',
    impact: '24+ events hosted since 2022. Built a community of 1,200+ active members.',
    impactAreas: ['Community', 'Entrepreneurship', 'Youth', 'Economy'] },
  { title: 'Youth Voices', category: 'Community', stat: '500+ youth in civic dialogue', status: 'active',
    description: 'A platform for young people to engage with local policymakers and civic leaders on issues that matter.',
    problem: 'Youth perspectives are frequently absent from public discourse and policy decisions in Jeddah.',
    objective: 'Host quarterly town halls, policy simulation workshops, and a youth advisory panel.',
    impact: 'Engaged 500+ youth in civic dialogue. Two recommendations formally adopted by a municipal working group.',
    impactAreas: ['Community', 'Education', 'Youth'] },
  { title: 'Jeddah Reads', category: 'Education', stat: '8,500 books distributed', status: 'active',
    description: 'A city-wide reading initiative distributing books and building micro-libraries in underserved neighborhoods.',
    problem: 'Access to Arabic-language books for children remains unequal across Jeddah.',
    objective: 'Collect and distribute 10,000 books annually; install 20 micro-libraries in community centers.',
    impact: 'Distributed 8,500 books to date. 18 micro-libraries installed. Monthly reading clubs in 6 schools.',
    impactAreas: ['Education', 'Community', 'Youth'] },
  { title: 'Smart Jeddah Hackathon', category: 'Technology', stat: '220 participants, 42 teams', status: 'archived',
    description: 'A 48-hour hackathon where student teams built tech solutions for city challenges.',
    problem: 'Jeddah faces urban challenges that require creative technology solutions, yet local youth rarely get the opportunity.',
    objective: 'Bring together 200+ students, engineers, and designers to prototype solutions over a 48-hour sprint.',
    impact: "Three winning solutions were piloted by city partners. Winning team's app was adopted by a private mall operator.",
    impactAreas: ['Education', 'Technology', 'Economy'] },
  { title: 'Clean Coast Jeddah', category: 'Environment', stat: '12+ tonnes of waste removed', status: 'archived',
    description: "A two-year coastal preservation initiative mobilizing volunteers to protect Jeddah's Red Sea shoreline.",
    problem: "Jeddah's Red Sea coastline faces growing threats from plastic waste and insufficient environmental protections.",
    objective: 'Coordinate regular volunteer clean-ups and advocate for stronger coastal protection policies.',
    impact: 'Over 24 months, 1,200 volunteers collected 12+ tonnes of waste. Handed off to a local NGO partner.',
    impactAreas: ['Environment', 'Community'] },
  { title: 'WEF Youth Summit 2023', category: 'Community', stat: '180 delegates from 12 cities', status: 'archived',
    description: 'Jeddah Hub co-organized a regional youth summit bringing together Global Shapers from across the Arab world.',
    problem: 'Young change-makers in the Arab region lack a shared platform to exchange experiences and co-design solutions.',
    objective: 'Host a two-day regional summit in Jeddah featuring keynotes, workshops, and a community challenge.',
    impact: 'Welcomed 180 delegates from 12 cities. Seeded three ongoing cross-hub collaborations.',
    impactAreas: ['Community', 'Economy', 'Education'] },
  { title: 'Ramadan Relief Drive', category: 'Community', stat: '2,600+ individuals served', status: 'archived',
    description: 'Annual food and essential goods distribution to low-income families during Ramadan.',
    problem: 'Many families struggle to meet basic needs during Ramadan, falling through gaps in formal support systems.',
    objective: 'Raise funds and distribute 500 food baskets; coordinate iftar meals for workers in public spaces.',
    impact: 'Distributed 520 food baskets and hosted 10 community iftars. Reached 2,600+ individuals.',
    impactAreas: ['Community', 'Wellbeing'] },
];

export default function ManageInitiatives() {
  const { user } = useAuth();
  const t        = useTranslations('Dashboard');
  const locale   = useLocale();
  const titleId  = useId();
  const { run, isBusy } = useBusy();
  const saveFailed = useSaveFailed();
  const downloadReport = useReportDownload();

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [users, setUsers]             = useState<UserLite[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<MembershipRequest[]>([]);
  const [removalRequests, setRemovalRequests] = useState<LeadRequest[]>([]);
  const [addRequests, setAddRequests] = useState<LeadRequest[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  /** Some request queue didn't load, so the queues shown may be incomplete. */
  const [queuesFailed, setQueuesFailed] = useState(false);
  const [filter, setFilter]     = useState<'all' | 'active' | 'archived'>('all');
  const [search, setSearch]     = useState('');

  /* Modal state */
  const [modalMode, setModalMode]       = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [form, setForm]                 = useState<FormShape>(emptyForm);
  /** The form as it opened, to tell whether closing would lose anything. */
  const [formStart, setFormStart]       = useState(() => JSON.stringify(emptyForm));

  /* Team panel state */
  const [teamOpenId, setTeamOpenId] = useState<string | null>(null);
  const [assignUser, setAssignUser] = useState('');
  const [assignRole, setAssignRole] = useState<TeamRole>('Member');

  const role      = normalizeRole(user?.role);
  const canManage = role === 'curator' || role === 'vice_curator' || role === 'impact_officer';
  // Choosing what the homepage features is the curatorship's call
  // (firestore.rules enforces the same split).
  const canFeature = role === 'curator' || role === 'vice_curator';
  const isImpact   = role === 'impact_officer';

  /* Stable onChange for FormFields */
  const handleFormChange = useCallback((key: keyof FormShape, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  /** Loads the page. `quiet` (after a change, or retrying the queues) keeps
   *  what's on screen instead of going back to the spinner. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) { setLoading(true); setLoadFailed(false); }
    const pending = (name: string) =>
      orNull(name, getDocs(query(collection(db, name), where('status', '==', 'pending'))));
    try {
      const [initSnap, usersSnap, leaveSnap, removalSnap, addSnap, proposalSnap] = await Promise.all([
        getDocs(query(collection(db, 'initiatives'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users')),
        pending('leave_requests'), pending('removal_requests'), pending('member_add_requests'), pending('initiative_requests'),
      ]);
      // Hub Activities share the collection (they carry a `type`); very old
      // teams stored bare user ids.
      const inits = initSnap.docs
        .filter(d => !d.data().type)
        .map(d => {
          const data = d.data();
          const members = ((data.members || []) as MemberEntry[]).map(m => (typeof m === 'string' ? { userId: m } : m));
          return { id: d.id, ...data, members } as Initiative;
        });
      const titled = <R,>(snap: QuerySnapshot | null): R[] => (snap?.docs ?? []).map(d => {
        const data = d.data();
        const title = data.initiativeTitle || inits.find(i => i.id === data.initiativeId)?.title || data.initiativeId;
        return { id: d.id, ...data, initiativeTitle: title } as R;
      });
      setInitiatives(inits);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserLite)));
      setLeaveRequests(titled<MembershipRequest>(leaveSnap));
      setRemovalRequests(titled<LeadRequest>(removalSnap));
      setAddRequests(titled<LeadRequest>(addSnap));
      setProposals((proposalSnap?.docs ?? []).map(d => ({ id: d.id, ...d.data() } as Proposal)));
      setQueuesFailed(!leaveSnap || !removalSnap || !addSnap || !proposalSnap);
      setLoadFailed(false);
    } catch (err) {
      console.error('Failed to load initiatives:', errorCode(err));
      // After a change the list on screen is still right; only a first load
      // (or a retry) shows the failure instead of the list.
      if (!quiet) setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Only for those who may use this page; anyone else sees "restricted".
  // eslint-disable-next-line react-hooks/set-state-in-effect -- load data once the role is known
  useEffect(() => { if (canManage) load(); }, [load, canManage]);

  /** Changes one initiative in the list on screen, once the same change is saved. */
  const patch = (id: string, change: (i: Initiative) => Partial<Initiative>) =>
    setInitiatives(prev => prev.map(i => (i.id === id ? { ...i, ...change(i) } : i)));
  const dropMember = (initiativeId: string, userId: string) => patch(initiativeId, i => ({
    members: (i.members || []).filter(m => m.userId !== userId),
    leads: (i.leads || []).filter(id => id !== userId),
  }));

  /* ── Modal helpers ── */
  const openModal = (mode: 'create' | 'edit', start: FormShape, init?: Initiative) => {
    setForm(start);
    setFormStart(JSON.stringify(start));
    setEditingId(init?.id ?? null);
    setEditingTitle(init?.title ?? '');
    setModalMode(mode);
  };
  const openCreate = () => openModal('create', emptyForm);
  const openEdit = (init: Initiative) => openModal('edit', initiativeToForm(init), init);

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setEditingTitle('');
  };

  /** Escape and a click outside ask first, but only when something would be lost. */
  const requestClose = () => {
    if (JSON.stringify(form) !== formStart && !confirm(t('confirmDiscardChanges'))) return;
    closeModal();
  };
  const dialogRef = useDialog(modalMode !== null, requestClose);

  /* ── CRUD handlers ── */
  const saving = isBusy('save');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    void run('save', async () => {
      try {
        const fields = formToDoc(form);
        if (modalMode === 'create') {
          const slug = await uniqueInitiativeSlug(form.title);
          await addDoc(collection(db, 'initiatives'), {
            // leads starts empty (not omitted) so firestore.rules' lead-update
            // branch (which requires 'leads' in resource.data) has something
            // to check against from the moment the doc exists, rather than
            // failing outright on a brand-new initiative before anyone's
            // assigned as lead yet.
            ...fields, status: 'active', members: [], leads: [], createdAt: new Date().toISOString(), slug,
          });
          void load(true);
        } else if (editingId) {
          const slug = await uniqueInitiativeSlug(form.title, editingId);
          await updateDoc(doc(db, 'initiatives', editingId), { ...fields, slug });
          patch(editingId, () => ({ ...fields, slug, color: fields.color ?? undefined }));
        }
        closeModal();
      } catch (err) {
        console.error('Failed to save the initiative:', errorCode(err));
        alert(saveFailed(err));
      }
    });
  };

  const handleSeedDefaults = () => {
    if (!confirm(t('seedDefaultsConfirm'))) return;
    void run('seed', async () => {
      try {
        const now = Date.now();
        for (const [n, init] of DEFAULT_INITIATIVES.entries()) {
          await addDoc(collection(db, 'initiatives'), {
            ...init, members: [], leads: [], images: [], createdAt: new Date(now - n * 1000).toISOString(),
          });
        }
      } catch (err) {
        console.error('Failed to add the default initiatives:', errorCode(err));
        alert(saveFailed(err));
      }
      // After a partial failure too, so what was added shows (and the button goes).
      await load(true);
    });
  };

  /** Impact officers' archive and restore show on the curators' Overview: one
   *  notice for the whole curatorship (only curators can read notifications). */
  const notifyCurators = async (type: 'archive_request' | 'restore_request', init: Initiative) => {
    const name = user?.displayName || user?.email;
    if (!user || !name) return;
    const message = t(type === 'archive_request' ? 'notifyInitiativeArchived' : 'notifyInitiativeRestored', { name, title: init.title });
    try {
      await addDoc(collection(db, 'notifications'), {
        type, initiativeId: init.id, initiativeTitle: init.title.slice(0, 300),
        fromUserId: user.uid, fromUserName: name, message: message.slice(0, 1000),
        read: false, createdAt: new Date().toISOString(),
      });
    } catch (err) {
      // The change itself is saved; only the curators' heads-up is missing.
      console.error('Failed to notify the curators:', errorCode(err));
    }
  };

  const setArchived = (init: Initiative, archive: boolean) => {
    if (archive && !confirm(t('archiveInitiativeConfirm'))) return;
    void run(`status:${init.id}`, async () => {
      // An archived initiative can't stay on the homepage's Featured row
      // or in the Initiatives page's Spotlight.
      const change: Partial<Initiative> = archive
        ? { status: 'archived', spotlight: false, ...(canFeature ? { featured: false } : {}) }
        : { status: 'active' };
      try {
        await updateDoc(doc(db, 'initiatives', init.id), { ...change, archivedAt: archive ? new Date().toISOString() : null });
      } catch (err) {
        console.error('Failed to archive or restore the initiative:', errorCode(err));
        alert(saveFailed(err));
        return;
      }
      patch(init.id, () => change);
      if (isImpact) await notifyCurators(archive ? 'archive_request' : 'restore_request', init);
    });
  };

  const featuredCount = initiatives.filter(i => i.featured && i.status === 'active').length;

  const handleToggleFeatured = (init: Initiative) => {
    if (!init.featured && featuredCount >= MAX_FEATURED) {
      alert(t('featuredLimit', { n: MAX_FEATURED }));
      return;
    }
    void run(`feature:${init.id}`, async () => {
      try {
        await updateDoc(doc(db, 'initiatives', init.id), {
          featured: !init.featured,
          featuredAt: !init.featured ? new Date().toISOString() : null,
        });
        patch(init.id, () => ({ featured: !init.featured }));
      } catch (err) {
        console.error('Failed to change what the homepage features:', errorCode(err));
        alert(saveFailed(err));
      }
    });
  };

  // One key for every card: setting a spotlight also clears the previous one.
  const handleToggleSpotlight = (init: Initiative) => run('spotlight', async () => {
    try {
      await setSpotlight(init.spotlight ? null : init.id, initiatives);
      setInitiatives(prev => prev.map(i => ({ ...i, spotlight: !init.spotlight && i.id === init.id })));
    } catch (err) {
      console.error('Failed to change the spotlight:', errorCode(err));
      alert(saveFailed(err));
    }
  });

  /* ── Team helpers ── */
  const toggleTeam = (id: string) => {
    setTeamOpenId(prev => prev === id ? null : id);
    setAssignUser(''); setAssignRole('Member');
  };

  const handleAssign = (initiativeId: string) => {
    const userId = assignUser, teamRole = assignRole;
    if (!userId) return;
    void run(`assign:${initiativeId}`, async () => {
      const lead = isLeadRole(teamRole);
      try {
        await updateDoc(doc(db, 'initiatives', initiativeId), {
          members: arrayUnion({ userId, role: teamRole }),
          // Lead rights come from the `leads` array, not the role text.
          ...(lead ? { leads: arrayUnion(userId) } : {}),
        });
        patch(initiativeId, i => ({
          members: [...(i.members || []), { userId, role: teamRole }],
          leads: lead ? Array.from(new Set([...(i.leads || []), userId])) : i.leads,
        }));
        setAssignUser(''); setAssignRole('Member');
      } catch (err) {
        console.error('Failed to add the team member:', errorCode(err));
        alert(saveFailed(err));
      }
    });
  };

  const handleRemoveMember = (initiativeId: string, userId: string) => {
    if (!confirm(t('confirmRemoveMember'))) return;
    void run(`member:${initiativeId}:${userId}`, async () => {
      try {
        await removeFromTeam(initiativeId, userId);
        dropMember(initiativeId, userId);
      } catch (err) {
        console.error('Failed to remove the team member:', errorCode(err));
        alert(saveFailed(err));
      }
    });
  };

  /* ── Requests waiting for a decision ── */
  /** Approves or declines one request, one click at a time per row; the row
   *  leaves its queue once the decision is saved. */
  function decide<R extends { id: string }>(req: R, setQueue: Dispatch<SetStateAction<R[]>>, action: () => Promise<unknown>) {
    return run(`req:${req.id}`, async () => {
      try {
        await action();
        setQueue(prev => prev.filter(r => r.id !== req.id));
      } catch (err) {
        console.error('Failed to save the decision:', errorCode(err));
        alert(saveFailed(err));
      }
    });
  }
  const reqBusy = (req: { id: string }) => isBusy(`req:${req.id}`);
  const decline = (collectionName: string, id: string, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(db, collectionName, id), { status: 'declined', ...extra });

  const approveProposal = (proposal: Proposal) => decide(proposal, setProposals, async () => {
    const fields = omitKeys(proposal, ['id', 'proposedBy', 'proposedByName', 'status', 'requestedAt']);
    const slug = await uniqueInitiativeSlug(String(fields.title || ''));
    // Only while the proposal is still pending, so a retry can't create the
    // initiative twice. The proposer automatically becomes its lead: they're
    // the one who wants to run it, and `leads` (what firestore.rules checks,
    // not the members[].role text) is what lets them edit it.
    await approveOnce(doc(db, 'initiative_requests', proposal.id), { reviewedAt: new Date().toISOString() }, tx => {
      tx.set(doc(collection(db, 'initiatives')), {
        ...fields,
        status: 'active',
        members: [{ userId: proposal.proposedBy, role: 'Lead' }],
        leads: [proposal.proposedBy],
        createdAt: new Date().toISOString(),
        slug,
      });
    });
    void load(true);
  });
  const declineProposal = (p: Proposal) =>
    decide(p, setProposals, () => decline('initiative_requests', p.id, { reviewedAt: new Date().toISOString() }));

  // A departing member also leaves `leads`, or a former lead would keep
  // write access to the initiative.
  const approveLeave = (req: MembershipRequest) => decide(req, setLeaveRequests, async () => {
    await removeFromTeam(req.initiativeId, req.userId, {
      settle: tx => tx.update(doc(db, 'leave_requests', req.id), { status: 'approved' }),
    });
    dropMember(req.initiativeId, req.userId);
  });
  const approveRemoval = (req: LeadRequest) => decide(req, setRemovalRequests, async () => {
    await removeFromTeam(req.initiativeId, req.targetUserId, {
      settle: tx => tx.update(doc(db, 'removal_requests', req.id), { status: 'approved' }),
    });
    dropMember(req.initiativeId, req.targetUserId);
  });
  const approveAdd = (req: LeadRequest) => decide(req, setAddRequests, async () => {
    const added = await addToTeam(req.initiativeId, req.targetUserId,
      tx => tx.update(doc(db, 'member_add_requests', req.id), { status: 'approved' }));
    if (added) patch(req.initiativeId, i => ({ members: [...(i.members || []), { userId: req.targetUserId, role: 'Member' }] }));
  });

  const getUserLabel = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u?.displayName || u?.email || userId;
  };

  const getMemberNames = (init: Initiative) =>
    Object.fromEntries((init.members || []).map(m => [m.userId, getUserLabel(m.userId)]));

  const filtered      = initiatives.filter(i => (filter === 'all' || i.status === filter)
    && matchesQuery(search, i.title, i.description, i.category, i.stat));
  const activeCount   = initiatives.filter(i => i.status === 'active').length;
  const archivedCount = initiatives.filter(i => i.status === 'archived').length;

  if (!canManage) return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>
  );

  const isCreate = modalMode === 'create';
  // Impact officers' archive and restore also tell the curators.
  const archiveLabel = isImpact ? `${t('archiveLabel')} · ${t('notifyCurator')}` : t('archiveLabel');
  const restoreLabel = isImpact ? `${t('restoreLabel')} · ${t('notifyCurator')}` : t('restoreLabel');

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('manageInitiatives')}</h2>
          <p className={styles.pageSubtitle}>{activeCount} {t('filterActive').toLowerCase()} · {archivedCount} {t('filterArchived').toLowerCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Only after a load that worked: a failed one isn't an empty list. */}
          {!loading && !loadFailed && initiatives.length === 0 && (
            <button className={styles.seedBtn} onClick={handleSeedDefaults} disabled={isBusy('seed')}>
              {isBusy('seed') ? t('seeding') : t('loadDefaultInitiatives')}
            </button>
          )}
          <button className={styles.createBtn} onClick={openCreate}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t('newInitiativeBtn')}
          </button>
        </div>
      </div>

      {/* ── Modal (create & edit) ── */}
      {modalMode !== null && (
        <ModalPortal>
        <div
          className={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) requestClose(); }}
        >
          <form
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.modal}
            onSubmit={handleSubmit}
          >
            {/* Modal header */}
            <div className={styles.modalHeader}>
              <h3 id={titleId} className={styles.modalTitle}>
                {isCreate ? t('createInitiative') : `${t('editInitiativeTitle')}: ${editingTitle}`}
              </h3>
              <button type="button" className={styles.modalClose} onClick={closeModal} aria-label={t('close')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className={styles.modalBody}>
              <InitiativeFormFields form={form} onChange={handleFormChange} />
            </div>

            {/* Modal footer */}
            <div className={styles.modalFooter}>
              <button type="button" className={styles.cancelBtn} onClick={closeModal}>
                {t('cancel')}
              </button>
              <button type="submit" className={styles.submitBtn} disabled={saving || !form.title}>
                {saving
                  ? (isCreate ? t('creatingDots') : t('savingDots'))
                  : (isCreate ? t('createInitiativeBtn') : t('saveChangesBtn'))
                }
              </button>
            </div>
          </form>
        </div>
        </ModalPortal>
      )}

      {canFeature && (
        <p className={styles.featuredHint}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          {t('featuredHint', { count: featuredCount, max: MAX_FEATURED })}
        </p>
      )}

      {/* ── Filter tabs + search ── */}
      <div className={styles.filterRow}>
      <div className={styles.filterBar}>
        {([
          { key: 'all',      label: t('filterAll'),      count: initiatives.length },
          { key: 'active',   label: t('filterActive'),   count: activeCount },
          { key: 'archived', label: t('filterArchived'), count: archivedCount },
        ] as const).map(f => (
          <button
            key={f.key}
            className={styles.filterBtn + (filter === f.key ? ' ' + styles.filterBtnActive : '')}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className={styles.filterCount}>{f.count}</span>
          </button>
        ))}
      </div>
        <DashSearch
          value={search}
          onChange={setSearch}
          placeholder={t('searchInitiativesPh')}
          resultLabel={t('resultsCount', { count: filtered.length })}
        />
      </div>

      {/* ── Requests waiting for a curator ── */}
      {queuesFailed && !loadFailed && (
        <LoadFailed onRetry={() => void load(true)} message={t('requestsLoadFailed')} />
      )}
      <RequestQueue
        icon={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
        title={t('proposedInitiatives')}
        items={proposals}
        itemKey={p => p.id}
        name={p => p.title}
        meta={p => <>{t('proposedBy')} <strong>{p.proposedByName}</strong></>}
        approveLabel={t('approveProposal')} onApprove={approveProposal}
        declineLabel={t('declineProposal')} onDecline={declineProposal}
        isBusy={reqBusy}
      />
      <RequestQueue
        icon={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>}
        title={t('incomingLeaveRequests')}
        items={leaveRequests}
        itemKey={r => r.id}
        name={r => r.userName || r.userEmail}
        meta={r => <>{t('wantsToLeave')} <strong>{r.initiativeTitle}</strong></>}
        approveLabel={t('approveLeave')} onApprove={approveLeave}
        declineLabel={t('declineLeave')} onDecline={r => decide(r, setLeaveRequests, () => decline('leave_requests', r.id))}
        isBusy={reqBusy}
      />
      <RequestQueue
        tone="remove"
        icon={<><circle cx="12" cy="12" r="10"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></>}
        title={t('removalRequests')}
        items={removalRequests}
        itemKey={r => r.id}
        name={r => r.targetUserName || r.targetUserId}
        meta={r => <>{t('requestedToRemove')} <strong>{r.initiativeTitle}</strong>{r.requestedByName && <> · {t('by')} {r.requestedByName}</>}</>}
        approveLabel={t('approveRemoval')} onApprove={approveRemoval}
        declineLabel={t('declineRemoval')} onDecline={r => decide(r, setRemovalRequests, () => decline('removal_requests', r.id))}
        isBusy={reqBusy}
      />
      <RequestQueue
        icon={<><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/><path d="M2 21v-2a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4v2"/></>}
        title={t('addMemberRequests')}
        items={addRequests}
        itemKey={r => r.id}
        name={r => r.targetUserName || r.targetUserId}
        meta={r => <>{t('requestedToAdd')} <strong>{r.initiativeTitle}</strong>{r.requestedByName && <> · {t('by')} {r.requestedByName}</>}</>}
        approveLabel={t('approveAdd')} onApprove={approveAdd}
        declineLabel={t('declineAdd')} onDecline={r => decide(r, setAddRequests, () => decline('member_add_requests', r.id))}
        isBusy={reqBusy}
      />

      {/* ── Cards ── */}
      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : loadFailed ? (
        <LoadFailed onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <p>
            {t('noInitiativesYet')}
            {filter === 'active' && <> {t('createFirstInitiative')}</>}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map(init => {
            const fallbackColor = init.color || '#0f5a9f';
            const statusBusy = isBusy(`status:${init.id}`);
            return (
            <div
              key={init.id}
              className={styles.card + (init.status === 'archived' ? ' ' + styles.cardArchived : '')}
            >
              {init.color && (
                <div className={styles.colorBar} style={{ background: safeColor(init.color) }} />
              )}
              <div className={styles.cardImage}>
                <InitiativeCover src={init.imageUrl} title={init.title} accent={fallbackColor} />
              </div>

              <div className={styles.cardBody}>
                <div className={styles.cardTopRow}>
                  <span className={styles.statusPill + ' ' + (init.status === 'active' ? styles.statusActive : styles.statusArchived)}>
                    {init.status === 'active' ? t('statusActive') : t('statusArchived')}
                  </span>
                  {init.category && <span className={styles.categoryPill}><CategoryLabel category={init.category} /></span>}
                  {init.featured && init.status === 'active' && (
                    <span className={styles.featuredPill}>★ {t('featuredBadge')}</span>
                  )}
                  {init.spotlight && init.status === 'active' && (
                    <span className={styles.spotlightPill}>◎ {t('spotlightBadge')}</span>
                  )}
                </div>
                <h3 className={styles.cardTitle}>{init.title}</h3>
                <p className={styles.cardDesc}>{init.description}</p>
                {init.stat && <p className={styles.cardStat}>{init.stat}</p>}
                <div className={styles.cardMeta}>
                  {init.startDate && (
                    <span className={styles.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      {new Date(init.startDate).toLocaleDateString(intlLocale(locale), { month: 'short', year: 'numeric' })}
                      {init.endDate && ` → ${new Date(init.endDate).toLocaleDateString(intlLocale(locale), { month: 'short', year: 'numeric' })}`}
                    </span>
                  )}
                  <span className={styles.metaItem}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {(init.members || []).length} {t('membersLabel')}
                  </span>
                  {(init.images || []).length > 0 && (
                    <span className={styles.metaItem}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      {(init.images || []).length} {t('photosLabel')}
                    </span>
                  )}
                </div>
              </div>

              {/* Homepage feature + Initiatives-page spotlight (active only). */}
              {init.status === 'active' && (
                <div className={styles.cardToggles}>
                  {/* Once the limit is reached only the featured ones keep a
                      button (to remove them); the rest hide theirs. */}
                  {canFeature && (init.featured || featuredCount < MAX_FEATURED) && (
                    <button
                      type="button"
                      className={styles.featureBtn + (init.featured ? ' ' + styles.featureBtnOn : '')}
                      onClick={() => handleToggleFeatured(init)}
                      disabled={isBusy(`feature:${init.id}`)}
                      aria-pressed={!!init.featured}
                      title={init.featured ? t('unfeature') : t('featureOnHome')}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={init.featured ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      {init.featured ? t('unfeature') : t('featureOnHome')}
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.spotlightBtn + (init.spotlight ? ' ' + styles.spotlightBtnOn : '')}
                    onClick={() => void handleToggleSpotlight(init)}
                    disabled={isBusy('spotlight')}
                    aria-pressed={!!init.spotlight}
                    title={init.spotlight ? t('removeSpotlight') : t('setSpotlight')}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" fill={init.spotlight ? 'currentColor' : 'none'} />
                    </svg>
                    {init.spotlight ? t('removeSpotlight') : t('setSpotlight')}
                  </button>
                </div>
              )}

              <div className={styles.cardActions}>
                <button type="button" className={styles.editBtn} onClick={() => openEdit(init)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('editLabel')}
                </button>
                <button
                  type="button"
                  className={styles.teamBtn + (teamOpenId === init.id ? ' ' + styles.teamBtnOpen : '')}
                  onClick={() => toggleTeam(init.id)}
                  aria-expanded={teamOpenId === init.id}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  {t('teamLabel')} ({(init.members || []).length})
                </button>
                <button
                  type="button"
                  className={styles.downloadBtn + ' ' + styles.iconOnly}
                  onClick={() => void downloadReport(init as ReportInitiative, getMemberNames(init))}
                  title={t('downloadReport')}
                  aria-label={t('downloadReport')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                {init.status === 'active' ? (
                  <button type="button" className={styles.archiveBtn + ' ' + styles.iconOnly} onClick={() => setArchived(init, true)}
                    disabled={statusBusy} title={archiveLabel} aria-label={archiveLabel}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="21 8 21 21 3 21 3 8"/>
                      <rect x="1" y="3" width="22" height="5"/>
                      <line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                  </button>
                ) : (
                  <button type="button" className={styles.restoreBtn + ' ' + styles.iconOnly} onClick={() => setArchived(init, false)}
                    disabled={statusBusy} title={restoreLabel} aria-label={restoreLabel}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 .49-3.68"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* Team panel */}
              {teamOpenId === init.id && (
                <div className={styles.teamPanel}>
                  <p className={styles.teamPanelTitle}>{t('assignShapers')}</p>
                  <div className={styles.teamAssignRow}>
                    <SearchSelect
                      className={styles.teamSelectSearch}
                      options={users
                        .filter(u => !(init.members || []).some(m => m.userId === u.id))
                        .map(u => ({ value: u.id, label: u.displayName || u.email || u.id, hint: u.email, keywords: u.displayNameAr }))
                        .sort((a, b) => a.label.localeCompare(b.label))}
                      value={assignUser}
                      onChange={setAssignUser}
                      placeholder={t('searchMemberPh')}
                      noResults={t('noMatches')}
                      clearLabel={t('clearSelection')}
                    />
                    <TeamRoleSelect value={assignRole} onChange={setAssignRole} className={styles.teamRoleInput} />
                    <button className={styles.assignBtn} onClick={() => handleAssign(init.id)} disabled={!assignUser || isBusy(`assign:${init.id}`)}>
                      {isBusy(`assign:${init.id}`) ? '…' : t('addToTeam')}
                    </button>
                  </div>
                  {(init.members || []).length === 0 ? (
                    <p className={styles.noTeamMsg}>{t('noTeamMembers')}</p>
                  ) : (
                    <div className={styles.memberList}>
                      {(init.members || []).map((m, idx) => (
                        <div key={m.userId + idx} className={styles.memberRow}>
                          <span className={styles.memberName}>{getUserLabel(m.userId)}</span>
                          <span className={styles.memberRole}>{teamRoleLabel(t, m.role)}</span>
                          <button className={styles.removeBtn} onClick={() => handleRemoveMember(init.id, m.userId)}
                            disabled={isBusy(`member:${init.id}:${m.userId}`)}>
                            {t('removeMember')}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
