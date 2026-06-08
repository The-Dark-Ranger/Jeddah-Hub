'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useTranslations, useLocale } from 'next-intl';
import styles from './Initiatives.module.css';

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
  createdAt: string;
  members?: unknown[];
}

const CATEGORIES = [
  'Environment', 'Education', 'Health', 'Technology',
  'Arts & Culture', 'Economic Empowerment', 'Community', 'Wellbeing', 'Economy', 'Other',
];

const emptyForm = {
  title: '', description: '', category: '', startDate: '', endDate: '',
  imageUrl: '', images: '', stat: '', problem: '', objective: '', impact: '',
  impactAreas: '',
};

type FormShape = typeof emptyForm;

/* ── Form fields component (defined outside to avoid re-mount on parent render) ── */
interface FormFieldsProps {
  form: FormShape;
  onChange: (key: keyof FormShape, value: string) => void;
}

function FormFields({ form, onChange }: FormFieldsProps) {
  const t = useTranslations('Dashboard');
  const mk = (k: keyof FormShape) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(k, e.target.value);

  return (
    <>
      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldTitle')} *</label>
        <input className={styles.input} value={form.title} onChange={mk('title')} placeholder={t('phInitiativeName')} required />
      </div>

      <div className={styles.editRow3}>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldCategory')}</label>
          <select className={styles.input} value={form.category} onChange={mk('category')}>
            <option value="">{t('categorySelectPrompt')}</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldStartDate')}</label>
          <input className={styles.input} type="date" value={form.startDate} onChange={mk('startDate')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldEndDate')}</label>
          <input className={styles.input} type="date" value={form.endDate} onChange={mk('endDate')} />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldKeyStat')}</label>
        <input className={styles.input} value={form.stat} onChange={mk('stat')} placeholder={t('phStat')} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldDescription')} *</label>
        <textarea className={styles.textarea} value={form.description} onChange={mk('description')} placeholder={t('phDescription')} required rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldProblem')}</label>
        <textarea className={styles.textarea} value={form.problem} onChange={mk('problem')} placeholder={t('phProblem')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldObjective')}</label>
        <textarea className={styles.textarea} value={form.objective} onChange={mk('objective')} placeholder={t('phObjective')} rows={2} />
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>{t('fieldImpact')}</label>
        <textarea className={styles.textarea} value={form.impact} onChange={mk('impact')} placeholder={t('phImpact')} rows={2} />
      </div>

      <div className={styles.editRow}>
        <div className={styles.formField}>
          <label className={styles.label}>
            {t('fieldImpactAreas')}
            <span className={styles.fieldHint}>{t('fieldImpactAreasHint')}</span>
          </label>
          <input className={styles.input} value={form.impactAreas} onChange={mk('impactAreas')} placeholder={t('phImpactAreas')} />
        </div>
        <div className={styles.formField}>
          <label className={styles.label}>{t('fieldCoverImage')}</label>
          <input className={styles.input} value={form.imageUrl} onChange={mk('imageUrl')} placeholder={t('phCoverImageUrl')} />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>
          {t('fieldPhotos')}
          <span className={styles.fieldHint}>{t('fieldPhotosHint')}</span>
        </label>
        <textarea className={styles.textarea} value={form.images} onChange={mk('images')} placeholder={t('phPhotoUrls')} rows={3} />
      </div>
    </>
  );
}

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
    description: 'Empowering youth with mindfulness tools to build resilience, reduce stress, and foster inner peace.',
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

  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [seeding, setSeeding]   = useState(false);
  const [filter, setFilter]     = useState<'all' | 'active' | 'archived'>('all');

  /* Modal state */
  const [modalMode, setModalMode]       = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [form, setForm]                 = useState<FormShape>(emptyForm);

  const role      = user?.role?.toLowerCase();
  const canManage = role === 'curator' || role === 'vice_curator' || role === 'impact_officer';

  /* Stable onChange for FormFields */
  const handleFormChange = useCallback((key: keyof FormShape, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'initiatives'), orderBy('createdAt', 'desc')));
      setInitiatives(snap.docs.map(d => ({ id: d.id, ...d.data() } as Initiative)));
    } catch { /* Firestore not configured */ }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── Modal helpers ── */
  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setEditingTitle('');
    setModalMode('create');
  };

  const openEdit = (init: Initiative) => {
    setEditingId(init.id);
    setEditingTitle(init.title);
    setForm({
      title:       init.title,
      description: init.description,
      category:    init.category    || '',
      startDate:   init.startDate   || '',
      endDate:     init.endDate     || '',
      imageUrl:    init.imageUrl    || '',
      images:      (init.images     || []).join('\n'),
      stat:        init.stat        || '',
      problem:     init.problem     || '',
      objective:   init.objective   || '',
      impact:      init.impact      || '',
      impactAreas: (init.impactAreas || []).join(', '),
    });
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setEditingTitle('');
  };

  /* Close on Escape key */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    if (modalMode) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalMode]);

  /* Prevent body scroll when modal is open */
  useEffect(() => {
    document.body.style.overflow = modalMode ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modalMode]);

  /* ── Form helpers ── */
  const formToDoc = (f: FormShape) => ({
    title: f.title, description: f.description, category: f.category,
    startDate: f.startDate, endDate: f.endDate, imageUrl: f.imageUrl,
    images:      f.images      ? f.images.split('\n').map(s => s.trim()).filter(Boolean) : [],
    stat:        f.stat,
    problem:     f.problem,
    objective:   f.objective,
    impact:      f.impact,
    impactAreas: f.impactAreas ? f.impactAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
  });

  /* ── CRUD handlers ── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(true);
    await addDoc(collection(db, 'initiatives'), {
      ...formToDoc(form), status: 'active', members: [], createdAt: new Date().toISOString(),
    });
    closeModal();
    setSaving(false);
    fetchAll();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.title) return;
    setSaving(true);
    await updateDoc(doc(db, 'initiatives', editingId), formToDoc(form));
    closeModal();
    setSaving(false);
    fetchAll();
  };

  const handleSeedDefaults = async () => {
    if (!confirm(t('seedDefaultsConfirm'))) return;
    setSeeding(true);
    const now = new Date();
    for (const init of DEFAULT_INITIATIVES) {
      const d = new Date(now);
      d.setSeconds(d.getSeconds() - DEFAULT_INITIATIVES.indexOf(init));
      await addDoc(collection(db, 'initiatives'), {
        ...init, members: [], images: [], createdAt: d.toISOString(),
      });
    }
    setSeeding(false);
    fetchAll();
  };

  const handleArchive = async (id: string) => {
    if (!confirm(t('archiveInitiativeConfirm'))) return;
    await updateDoc(doc(db, 'initiatives', id), { status: 'archived', archivedAt: new Date().toISOString() });
    fetchAll();
  };

  const handleRestore = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), { status: 'active', archivedAt: null });
    fetchAll();
  };

  const filtered      = initiatives.filter(i => filter === 'all' || i.status === filter);
  const activeCount   = initiatives.filter(i => i.status === 'active').length;
  const archivedCount = initiatives.filter(i => i.status === 'archived').length;

  if (!canManage) return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>{t('accessRestricted')}</div>
  );

  const isCreate = modalMode === 'create';

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('manageInitiatives')}</h2>
          <p className={styles.pageSubtitle}>{activeCount} {t('filterActive').toLowerCase()} · {archivedCount} {t('filterArchived').toLowerCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {initiatives.length === 0 && !loading && (
            <button className={styles.seedBtn} onClick={handleSeedDefaults} disabled={seeding}>
              {seeding ? t('seeding') : t('loadDefaultInitiatives')}
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
        <div
          className={styles.modalOverlay}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <form
            className={styles.modal}
            onSubmit={isCreate ? handleCreate : handleSaveEdit}
          >
            {/* Modal header */}
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {isCreate ? t('createInitiative') : `${t('editInitiativeTitle')}: ${editingTitle}`}
              </h3>
              <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className={styles.modalBody}>
              <FormFields form={form} onChange={handleFormChange} />
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
      )}

      {/* ── Filter tabs ── */}
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

      {/* ── Cards ── */}
      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
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
          {filtered.map(init => (
            <div
              key={init.id}
              className={styles.card + (init.status === 'archived' ? ' ' + styles.cardArchived : '')}
            >
              {init.imageUrl && (
                <div className={styles.cardImage}>
                  <img
                    src={init.imageUrl}
                    alt={init.title}
                    onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <div className={styles.cardBody}>
                <div className={styles.cardTopRow}>
                  <span className={styles.statusPill + ' ' + (init.status === 'active' ? styles.statusActive : styles.statusArchived)}>
                    {init.status === 'active' ? t('statusActive') : t('statusArchived')}
                  </span>
                  {init.category && <span className={styles.categoryPill}>{init.category}</span>}
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
                      {new Date(init.startDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', year: 'numeric' })}
                      {init.endDate && ` → ${new Date(init.endDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', year: 'numeric' })}`}
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

              <div className={styles.cardActions}>
                <button className={styles.editBtn} onClick={() => openEdit(init)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('editLabel')}
                </button>
                {init.status === 'active' ? (
                  <button className={styles.archiveBtn} onClick={() => handleArchive(init.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="21 8 21 21 3 21 3 8"/>
                      <rect x="1" y="3" width="22" height="5"/>
                      <line x1="10" y1="12" x2="14" y2="12"/>
                    </svg>
                    {t('archiveLabel')}
                  </button>
                ) : (
                  <button className={styles.restoreBtn} onClick={() => handleRestore(init.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 .49-3.68"/>
                    </svg>
                    {t('restoreLabel')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
