'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import styles from './Projects.module.css';

const CATEGORY_KEYS = ['all', 'education', 'sustainability', 'wellbeing', 'economy', 'community'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Education:      '#0f5a9f',
  Sustainability: '#10b981',
  Wellbeing:      '#7c3aed',
  Economy:        '#f59e0b',
  Community:      '#ef4444',
  Default:        '#0891b2',
};

const PLACEHOLDER_PROJECTS = [
  /* ── Active ── */
  {
    id: 'p1', title: 'Rise Up', category: 'Economy', status: 'active',
    stat: '60+ businesses mentored',
    description: 'Mentoring small businesses with limited resources to achieve sustainable growth through expert guidance.',
    problem: 'Many small business owners in Jeddah lack access to mentorship, networks, and strategic guidance needed to scale sustainably. Without support, promising ventures stall or fail within the first two years.',
    objective: 'Connect aspiring and early-stage entrepreneurs with experienced mentors across business, finance, and operations. Deliver structured mentorship cycles, workshops, and peer cohorts that build real business skills.',
    impact: 'Over three cohorts, Rise Up has mentored 60+ small businesses, with participants reporting an average 35% revenue increase within 12 months. Several ventures have gone on to secure formal investment or expand operations.',
    impactAreas: ['Economy', 'Entrepreneurship', 'Youth'],
  },
  {
    id: 'p2', title: 'Anti-Bullying Campaign', category: 'Wellbeing', status: 'active',
    stat: '4,000+ students reached',
    description: 'Creating spaces where youth feel heard, understood, and accepted. Encouraging empathy and kindness among young people.',
    problem: "Bullying — including cyberbullying — remains a significant issue in Jeddah schools. Many students suffer in silence due to stigma, lack of reporting channels, and limited awareness among educators and parents.",
    objective: 'Run awareness campaigns in schools, train student ambassadors, and provide resources for teachers and parents. Build peer-support structures that empower bystanders to act and normalize conversations about mental wellbeing.',
    impact: 'Reached over 4,000 students across 12 schools. Trained 200+ student ambassadors. Partner schools reported a measurable increase in students seeking support from counselors.',
    impactAreas: ['Wellbeing', 'Education', 'Youth', 'Community'],
  },
  {
    id: 'p3', title: 'Mindfulness for Peace', category: 'Wellbeing', status: 'active',
    stat: '85% stress reduction reported',
    description: 'Empowering youth with mindfulness tools to build resilience, reduce stress, and foster inner peace.',
    problem: 'Academic pressure, social media, and rapid social change are driving unprecedented levels of stress and anxiety among young people in Jeddah. Mental health resources remain under-utilized.',
    objective: 'Introduce evidence-based mindfulness practices through workshops, school programs, and a free digital resource toolkit available in Arabic and English.',
    impact: 'Delivered 30+ workshops reaching 1,500+ participants. 85% of attendees reported reduced stress after a four-week program. The Arabic mindfulness toolkit has been downloaded over 3,000 times.',
    impactAreas: ['Wellbeing', 'Mental Health', 'Youth'],
  },
  {
    id: 'p4', title: 'Green Jeddah', category: 'Sustainability', status: 'active',
    stat: '2,000+ trees planted',
    description: 'Environmental awareness campaigns and tree-planting drives across local schools and neighborhoods.',
    problem: "Rapid urban development and low environmental literacy are taking a toll on Jeddah's green spaces and coastline. Young people feel disconnected from environmental issues.",
    objective: 'Mobilize youth as environmental stewards through tree-planting events, beach clean-ups, school sustainability modules, and partnerships with local municipalities.',
    impact: 'Planted 2,000+ trees across six neighborhoods. Organized 15 beach clean-ups removing 4+ tonnes of waste. Sustainability modules adopted by three schools.',
    impactAreas: ['Sustainability', 'Environment', 'Community', 'Education'],
  },
  {
    id: 'p5', title: 'Tech Literacy', category: 'Education', status: 'active',
    stat: '800+ participants trained',
    description: 'Digital skills workshops for underserved youth and women re-entering the workforce.',
    problem: 'The digital divide in Jeddah disproportionately affects low-income youth and women returning to work. Basic digital literacy has become a prerequisite for employment, yet programs are scarce and costly.',
    objective: 'Provide free workshops in coding fundamentals, digital productivity tools, AI basics, and cybersecurity. Partner with local organizations to reach underserved communities.',
    impact: 'Trained 800+ participants across 20 free workshops. 60% reported gaining new employment or improving their professional standing within six months.',
    impactAreas: ['Education', 'Technology', 'Economy', 'Youth'],
  },
  {
    id: 'p6', title: 'Community Connect', category: 'Community', status: 'active',
    stat: '1,200+ active members',
    description: 'Monthly networking gatherings connecting young professionals and entrepreneurs in Jeddah.',
    problem: 'Young professionals in Jeddah often operate in silos by industry or background. The absence of cross-sector social infrastructure limits collaboration and the connections that fuel innovation.',
    objective: 'Host monthly curated events bringing together 50-150 young professionals across industries with informal talks, facilitated introductions, and a shared meal.',
    impact: '24+ events hosted since 2022. Built a community of 1,200+ active members. Several collaborations and co-founded startups trace directly back to Community Connect introductions.',
    impactAreas: ['Community', 'Entrepreneurship', 'Youth', 'Economy'],
  },
  {
    id: 'p7', title: 'Youth Voices', category: 'Community', status: 'active',
    stat: '500+ youth in civic dialogue',
    description: 'A platform for young people to engage with local policymakers and civic leaders on issues that matter to them.',
    problem: 'Youth perspectives are frequently absent from public discourse and policy decisions in Jeddah, leaving their most pressing concerns unaddressed by decision-makers.',
    objective: 'Host quarterly town halls, policy simulation workshops, and a youth advisory panel that feeds structured recommendations to city leadership.',
    impact: 'Engaged 500+ youth in civic dialogue. Two recommendations from the youth panel were formally adopted by a municipal working group on public spaces.',
    impactAreas: ['Community', 'Education', 'Youth'],
  },
  {
    id: 'p8', title: 'Jeddah Reads', category: 'Education', status: 'active',
    stat: '8,500 books distributed',
    description: 'A city-wide reading initiative distributing books and building micro-libraries in underserved neighborhoods.',
    problem: 'Access to Arabic-language books for children and teenagers remains unequal across Jeddah, particularly in neighborhoods with fewer resources.',
    objective: 'Collect and distribute 10,000 books annually; install 20 micro-libraries in community centers, barbershops, and waiting areas; run monthly author sessions for youth.',
    impact: 'Distributed 8,500 books to date. 18 micro-libraries installed. Monthly reading clubs running in 6 schools with 400+ active participants.',
    impactAreas: ['Education', 'Community', 'Youth'],
  },
  /* ── Completed ── */
  {
    id: 'p9', title: 'Smart Jeddah Hackathon', category: 'Education', status: 'completed',
    stat: '220 participants, 42 teams',
    description: 'A 48-hour hackathon where student teams built tech solutions for city challenges.',
    problem: 'Jeddah faces urban challenges — from traffic to waste management — that require creative technology solutions, yet local youth rarely get the opportunity to tackle real civic problems.',
    objective: 'Bring together 200+ students, engineers, and designers to prototype technology solutions for real Jeddah city challenges over a 48-hour sprint.',
    impact: 'Three winning solutions were piloted by city partners. 220 participants, 42 teams. Winning team\'s parking optimization app was adopted by a private mall operator.',
    impactAreas: ['Education', 'Technology', 'Economy'],
  },
  {
    id: 'p10', title: 'Clean Coast Jeddah', category: 'Sustainability', status: 'completed',
    stat: '12+ tonnes of waste removed',
    description: 'A two-year coastal preservation initiative mobilizing volunteers to protect Jeddah\'s Red Sea shoreline.',
    problem: 'Jeddah\'s Red Sea coastline faces growing threats from plastic waste, illegal dumping, and insufficient enforcement of environmental protections.',
    objective: 'Coordinate regular volunteer clean-ups, partner with local schools for ocean literacy programs, and advocate for stronger coastal protection policies.',
    impact: 'Over 24 months, 1,200 volunteers collected 12+ tonnes of waste. Ocean literacy curriculum adopted by 8 schools. Initiative formally concluded and handed off to a local NGO partner.',
    impactAreas: ['Sustainability', 'Environment', 'Community'],
  },
  {
    id: 'p11', title: 'WEF Youth Summit 2023', category: 'Community', status: 'completed',
    stat: '180 delegates from 12 cities',
    description: 'Jeddah Hub co-organized a regional youth summit bringing together Global Shapers from across the Arab world.',
    problem: 'Young change-makers in the Arab region lack a shared platform to exchange experiences, co-design solutions, and build the relationships that enable cross-border collaboration.',
    objective: 'Host a two-day regional summit in Jeddah featuring keynotes, workshops, and a community challenge with participants from 12 Arab Shapers hubs.',
    impact: 'Welcomed 180 delegates from 12 cities. Produced a joint regional impact report. Seeded three ongoing cross-hub collaborations on climate, education, and entrepreneurship.',
    impactAreas: ['Community', 'Economy', 'Education'],
  },
  {
    id: 'p12', title: 'Ramadan Relief Drive', category: 'Community', status: 'completed',
    stat: '2,600+ individuals served',
    description: 'Annual food and essential goods distribution to low-income families during the holy month of Ramadan.',
    problem: 'Many families in Jeddah struggle to meet basic needs during Ramadan despite the season\'s spirit of giving, often falling through gaps in formal support systems.',
    objective: 'Raise funds and donations, pack and distribute 500 food baskets, and coordinate iftar meals for workers in public spaces during Ramadan.',
    impact: 'Distributed 520 food baskets and hosted 10 community iftars. Reached 2,600+ individuals. Now runs as an annual tradition with 50+ volunteers each year.',
    impactAreas: ['Community', 'Wellbeing'],
  },
];

interface Project {
  id: string;
  title: string;
  description: string;
  category?: string;
  status?: string;
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  members?: unknown[];
}

function ProjectCard({ project, archived, t, index = 0 }: { project: Project; archived?: boolean; t: ReturnType<typeof useTranslations>; index?: number }) {
  const color = CATEGORY_COLORS[project.category ?? ''] ?? CATEGORY_COLORS.Default;
  const isActive = !archived;

  return (
    <Link
      href={'/projects/' + project.id}
      className={styles.card + (archived ? ' ' + styles.cardArchived : '')}
      style={{ '--card-index': index } as React.CSSProperties}
    >
      <div className={styles.cardAccent} style={{ background: color }} />
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}>
          {project.category && (
            <span className={styles.cardCategory} style={{ color, background: color + '22' }}>
              {project.category.toUpperCase()}
            </span>
          )}
          <span className={styles.cardStatus + ' ' + (isActive ? styles.cardStatusActive : styles.cardStatusArchived)}>
            <span className={styles.statusDot} />
            {isActive ? t('active') : t('completed')}
          </span>
        </div>
        <h3 className={styles.cardTitle}>{project.title}</h3>
        <p className={styles.cardDesc}>{project.description}</p>
        {project.stat && (
          <div className={styles.cardStat}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
              <polyline points="16 7 22 7 22 13"/>
            </svg>
            {project.stat}
          </div>
        )}
        <div className={styles.cardLink}>
          {t('exploreProject')}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const t  = useTranslations('ProjectsPage');
  const tc = useTranslations('Categories');
  const [projects, setProjects]           = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeCategoryKey, setActiveCategoryKey] = useState<typeof CATEGORY_KEYS[number]>('all');
  const [search, setSearch]               = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'initiatives'));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Project));
        setProjects(all.length > 0 ? all : PLACEHOLDER_PROJECTS);
      } catch {
        setProjects(PLACEHOLDER_PROJECTS);
      }
      setLoading(false);
    };
    fetchProjects();
  }, []);

  const filtered = projects.filter(p => {
    const matchCat = activeCategoryKey === 'all' || p.category?.toLowerCase() === activeCategoryKey;
    const matchSearch = !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const active   = filtered.filter(p => p.status === 'active' || !p.status);
  const archived = filtered.filter(p => p.status && p.status !== 'active');

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div className={styles.headerOrb} />
        <div className={styles.headerContent}>
          <h1 className={styles.headerTitle}>{t('title')}</h1>
          <p className={styles.headerSubtitle}>{t('subtitle')}</p>
        </div>
      </section>

      <div className={styles.container}>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.searchInput}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.categoryTabs}>
            {CATEGORY_KEYS.map(key => (
              <button
                key={key}
                className={styles.catBtn + (activeCategoryKey === key ? ' ' + styles.catBtnActive : '')}
                onClick={() => setActiveCategoryKey(key)}
              >
                {tc(key)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <h3>{t('noResults')}</h3>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <span className={styles.dot} style={{ background: '#10b981' }} />
                  {t('activeSection')}
                  <span className={styles.sectionCount}>{active.length}</span>
                </div>
                <div className={styles.grid}>
                  {active.map((p, i) => <ProjectCard key={p.id} project={p} t={t} index={i} />)}
                </div>
              </div>
            )}
            {archived.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>
                  <span className={styles.dot} style={{ background: '#94a3b8' }} />
                  {t('pastSection')}
                  <span className={styles.sectionCount}>{archived.length}</span>
                </div>
                <div className={styles.grid}>
                  {archived.map((p, i) => <ProjectCard key={p.id} project={p} archived t={t} index={i} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
