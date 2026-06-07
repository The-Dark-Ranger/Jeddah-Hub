'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import styles from './Initiative.module.css';

interface Initiative {
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
  images?: string[];
  members?: unknown[];
  createdAt?: string;
  startDate?: string;
  endDate?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Education:      '#0f5a9f',
  Sustainability: '#10b981',
  Wellbeing:      '#7c3aed',
  Economy:        '#f59e0b',
  Community:      '#ef4444',
  Environment:    '#059669',
  Health:         '#7c3aed',
  Technology:     '#0891b2',
  Default:        '#0891b2',
};

/* Mirror of the placeholder list in projects/page.tsx — used as fallback
   when the Firebase document doesn't exist (demo / offline mode). */
const PLACEHOLDER_PROJECTS: Initiative[] = [
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
  {
    id: 'p9', title: 'Smart Jeddah Hackathon', category: 'Education', status: 'completed',
    stat: '220 participants, 42 teams',
    description: 'A 48-hour hackathon where student teams built tech solutions for city challenges.',
    problem: 'Jeddah faces urban challenges — from traffic to waste management — that require creative technology solutions, yet local youth rarely get the opportunity to tackle real civic problems.',
    objective: 'Bring together 200+ students, engineers, and designers to prototype technology solutions for real Jeddah city challenges over a 48-hour sprint.',
    impact: "Three winning solutions were piloted by city partners. 220 participants, 42 teams. Winning team's parking optimization app was adopted by a private mall operator.",
    impactAreas: ['Education', 'Technology', 'Economy'],
  },
  {
    id: 'p10', title: 'Clean Coast Jeddah', category: 'Sustainability', status: 'completed',
    stat: '12+ tonnes of waste removed',
    description: "A two-year coastal preservation initiative mobilizing volunteers to protect Jeddah's Red Sea shoreline.",
    problem: "Jeddah's Red Sea coastline faces growing threats from plastic waste, illegal dumping, and insufficient enforcement of environmental protections.",
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
    problem: "Many families in Jeddah struggle to meet basic needs during Ramadan despite the season's spirit of giving, often falling through gaps in formal support systems.",
    objective: 'Raise funds and donations, pack and distribute 500 food baskets, and coordinate iftar meals for workers in public spaces during Ramadan.',
    impact: 'Distributed 520 food baskets and hosted 10 community iftars. Reached 2,600+ individuals. Now runs as an annual tradition with 50+ volunteers each year.',
    impactAreas: ['Community', 'Wellbeing'],
  },
];

export default function InitiativePage() {
  const { id } = useParams() as { id: string };
  const t = useTranslations('ProjectsPage');
  const [initiative, setInitiative] = useState<Initiative | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'initiatives', id));
        if (snap.exists()) {
          setInitiative({ id: snap.id, ...snap.data() } as Initiative);
        } else {
          const placeholder = PLACEHOLDER_PROJECTS.find(p => p.id === id) ?? null;
          setInitiative(placeholder);
        }
      } catch {
        const placeholder = PLACEHOLDER_PROJECTS.find(p => p.id === id) ?? null;
        setInitiative(placeholder);
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner} /></div>;

  if (!initiative) return (
    <div className={styles.notFound}>
      <h2>{t('notFound')}</h2>
      <Link href="/projects" className={styles.backLink}>{t('backToProjects')}</Link>
    </div>
  );

  const isActive = !initiative.status || initiative.status === 'active';
  const isCompleted = initiative.status === 'completed';
  const categoryColor = CATEGORY_COLORS[initiative.category ?? ''] ?? CATEGORY_COLORS.Default;
  const photos = (initiative.images || []).filter(Boolean);

  return (
    <main className={styles.page}>
      {/* Hero banner */}
      <div
        className={styles.hero}
        style={{ '--hero-color': categoryColor } as React.CSSProperties}
      >
        <div className={styles.heroOrb} />
        <div className={styles.heroInner}>
          <div className={styles.heroBadges}>
            {initiative.category && (
              <span className={styles.heroCategoryTag} style={{ color: categoryColor, background: categoryColor + '22' }}>
                {initiative.category.toUpperCase()}
              </span>
            )}
            {initiative.status && (
              <span className={styles.statusBadge + ' ' + (isActive ? styles.statusActive : isCompleted ? styles.statusCompleted : styles.statusArchived)}>
                {isActive ? t('activeStatus') : isCompleted ? 'Past Initiative' : t('archiveStatus')}
              </span>
            )}
          </div>
          <h1 className={styles.heroTitle}>{initiative.title}</h1>
          <p className={styles.heroDescription}>{initiative.description}</p>

          <div className={styles.heroMeta}>
            {initiative.stat && (
              <div className={styles.statCallout} style={{ borderColor: categoryColor + '55' }}>
                <span className={styles.statValue} style={{ color: categoryColor }}>{initiative.stat}</span>
                <span className={styles.statLabel}>{t('keyResult')}</span>
              </div>
            )}
            {(initiative.startDate || initiative.endDate) && (
              <div className={styles.datePill}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {initiative.startDate && new Date(initiative.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {initiative.startDate && initiative.endDate && ' — '}
                {initiative.endDate && new Date(initiative.endDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            )}
            {Array.isArray(initiative.members) && initiative.members.length > 0 && (
              <div className={styles.memberCount}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                {initiative.members.length} {t('shapers')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo marquee */}
      {photos.length > 0 && (
        <div className={styles.marqueeSection}>
          <div className={styles.marqueeTrack}>
            {[...photos, ...photos].map((src, i) => (
              <div key={i} className={styles.marqueeItem}>
                <img src={src} alt="" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.container}>
        {/* Back navigation */}
        <Link href="/projects" className={styles.back}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('backToProjects')}
        </Link>

        <div className={styles.divider} />

        {/* Content sections */}
        <div className={styles.sections}>
          {initiative.problem && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                {t('problem')}
              </h2>
              <p className={styles.sectionBody}>{initiative.problem}</p>
            </section>
          )}
          {initiative.objective && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="6"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                </span>
                {t('objective')}
              </h2>
              <p className={styles.sectionBody}>{initiative.objective}</p>
            </section>
          )}
          {initiative.impact && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionIcon} style={{ color: categoryColor }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </span>
                {t('impactTitle')}
              </h2>
              <p className={styles.sectionBody}>{initiative.impact}</p>
            </section>
          )}
          {!initiative.problem && !initiative.objective && !initiative.impact && (
            <section className={styles.contentSection}>
              <h2 className={styles.sectionTitle}>{t('objective')}</h2>
              <p className={styles.sectionBody}>{initiative.description}</p>
            </section>
          )}
        </div>

        {/* Impact Areas */}
        {initiative.impactAreas && initiative.impactAreas.length > 0 && (
          <>
            <div className={styles.divider} />
            <section className={styles.impactAreas}>
              <h3 className={styles.impactAreasTitle}>{t('impactAreas')}</h3>
              <div className={styles.impactAreaTags}>
                {initiative.impactAreas.map((area, i) => (
                  <span
                    key={area}
                    className={styles.impactAreaTag}
                    style={i === 0 ? { color: categoryColor, background: categoryColor + '18', borderColor: categoryColor + '44' } : undefined}
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
