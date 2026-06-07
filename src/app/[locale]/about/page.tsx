import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import styles from './About.module.css';

/* ── Types ── */
interface Shaper {
  name: string;
  role: string;
  bio: string;
  linkedin?: string;
  email?: string;
  gradient: string;
}

/* ── Curatorship ──────────────────────────────────────────────────────────
   The three leadership roles displayed prominently at the top of the team
   section. Update name/bio/linkedin here; gradient sets the avatar colour.
   Roles are translated via the 'Role' namespace in messages/[locale].json.
   ──────────────────────────────────────────────────────────────────────── */
const CURATORSHIP: Shaper[] = [
  {
    name: 'Mohammed Alshawi',
    role: 'curator',
    bio: 'Passionate about leveraging technology and community-driven initiatives to shape a more inclusive Jeddah. Leads the hub with a focus on collaboration and sustainable impact.',
    linkedin: 'https://linkedin.com/in/mohammed-alshawi',
    gradient: 'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  },
  {
    name: 'Dana Sayyadah',
    role: 'vice_curator',
    bio: "Creative strategist committed to youth empowerment and social innovation. Drives the hub's community partnerships and engagement programs across Jeddah.",
    linkedin: 'https://linkedin.com/in/dana-sayyadah',
    gradient: 'linear-gradient(135deg,#10b981,#34d399)',
  },
  {
    name: 'Jana Jambi',
    role: 'impact_officer',
    bio: "Dedicated to measuring and amplifying the hub's social impact. Coordinates initiatives that bridge local needs with global frameworks for meaningful, lasting change.",
    linkedin: 'https://linkedin.com/in/jana-jambi',
    gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
  },
];

/* ── Shapers ──────────────────────────────────────────────────────────────
   Full list of active shapers shown in a 3-column grid.
   To add a shaper: push a new object with name, role:'shaper', bio, linkedin,
   and one of the AVATAR_GRADIENTS (or a custom gradient string).
   To remove: delete the object. No other code needs to change.
   ──────────────────────────────────────────────────────────────────────── */
const SHAPERS: Shaper[] = [
  { name: 'Abdulaziz Alahmadi', role: 'shaper', bio: 'Entrepreneur and community advocate focused on economic empowerment and youth development across Jeddah.', linkedin: '#', gradient: 'linear-gradient(135deg,#0f5a9f,#1a7fd4)' },
  { name: 'Hanin Aljifri',      role: 'shaper', bio: 'Creative professional dedicated to storytelling and using media to amplify social impact initiatives in the region.', linkedin: '#', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
  { name: 'Ammar Koshak',       role: 'shaper', bio: 'Technology innovator working at the intersection of civic tech and grassroots community engagement in Saudi Arabia.', linkedin: '#', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { name: 'Aseel Basnawi',      role: 'shaper', bio: 'Passionate about education reform and creating accessible learning pathways for underserved youth in Jeddah.', linkedin: '#', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
  { name: 'Hashem Hashem',      role: 'shaper', bio: 'Social entrepreneur driving sustainable business models that create measurable impact in local communities.', linkedin: '#', gradient: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
  { name: 'Haya Haddad',        role: 'shaper', bio: 'Mental health advocate and mindfulness practitioner committed to normalizing wellbeing conversations among youth.', linkedin: '#', gradient: 'linear-gradient(135deg,#e11d48,#fb7185)' },
  { name: 'Masarah Hussain',    role: 'shaper', bio: 'Sustainability champion working on environmental literacy programs and green initiatives across Jeddah schools.', linkedin: '#', gradient: 'linear-gradient(135deg,#0f5a9f,#1a7fd4)' },
  { name: 'Riyadh Alshehri',    role: 'shaper', bio: 'Policy researcher and civic leader connecting youth voices to local governance and urban planning conversations.', linkedin: '#', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
  { name: 'Suhaib Darweesh',    role: 'shaper', bio: 'Design thinker applying human-centered approaches to solve complex social challenges in the Jeddah ecosystem.', linkedin: '#', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { name: 'Dana Sayyadah',      role: 'shaper', bio: 'Creative strategist committed to youth empowerment and social innovation across Jeddah and the wider region.', linkedin: '#', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
  { name: 'Jana Jambi',         role: 'shaper', bio: "Impact-driven professional dedicated to measuring and amplifying the hub's community contributions city-wide.", linkedin: '#', gradient: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
  { name: 'Toleen Attar',       role: 'shaper', bio: 'Arts and culture advocate using creative expression to drive social dialogue and community cohesion in Jeddah.', linkedin: '#', gradient: 'linear-gradient(135deg,#e11d48,#fb7185)' },
  { name: 'Nagy ElSokkary',     role: 'shaper', bio: 'Engineer and social innovator exploring how technology can accelerate sustainable development in Saudi cities.', linkedin: '#', gradient: 'linear-gradient(135deg,#0f5a9f,#1a7fd4)' },
  { name: 'Toulin Tabbash',     role: 'shaper', bio: 'Educator and curriculum designer committed to building critical thinking and civic engagement among young learners.', linkedin: '#', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
  { name: 'Faisal Aldaheri',    role: 'shaper', bio: 'Business development professional fostering partnerships between the private sector and community-led initiatives.', linkedin: '#', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
  { name: 'Jodie Alsasi',       role: 'shaper', bio: 'Communications specialist amplifying the voices of Jeddah youth on local, regional, and global platforms.', linkedin: '#', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
  { name: 'Musaad Aljafari',    role: 'shaper', bio: 'Researcher and writer exploring urban identity, belonging, and the role of youth in shaping Saudi cities.', linkedin: '#', gradient: 'linear-gradient(135deg,#0891b2,#22d3ee)' },
  { name: 'Shahad Alattas',     role: 'shaper', bio: 'Wellbeing advocate and sports professional promoting active lifestyles and mental resilience among youth.', linkedin: '#', gradient: 'linear-gradient(135deg,#e11d48,#fb7185)' },
  { name: 'Mohammed Al Nahari', role: 'shaper', bio: "Social entrepreneur and community organizer connecting talent and opportunity across Jeddah's diverse neighborhoods.", linkedin: '#', gradient: 'linear-gradient(135deg,#0f5a9f,#1a7fd4)' },
  { name: 'Samar Alzanbaqi',    role: 'shaper', bio: 'Healthcare professional and public health advocate working to improve community wellbeing outcomes in Jeddah.', linkedin: '#', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
  { name: 'Mohammed Alshawi',   role: 'shaper', bio: 'Curator and technology leader passionate about building collaborative ecosystems that drive positive change in Jeddah.', linkedin: '#', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)' },
];

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0f5a9f,#1a7fd4)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#e11d48,#fb7185)',
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('');
}

const LinkedInIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const EmailIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

function ShaperCard({ shaper, index, tc }: { shaper: Shaper; index: number; tc: ReturnType<typeof useTranslations> }) {
  const gradient = shaper.gradient ?? AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
  const hasLink = shaper.linkedin && shaper.linkedin !== '#';
  const hasEmail = !!shaper.email;
  return (
    <div className={styles.shaperCard}>
      <div className={styles.shaperTop}>
        <div className={styles.shaperAvatarWrap}>
          <div className={styles.shaperAvatar} style={{ background: gradient }}>
            {initials(shaper.name)}
          </div>
        </div>
        <div className={styles.shaperMeta}>
          <h3 className={styles.shaperName}>{shaper.name}</h3>
          <div className={styles.shaperActions}>
            {hasLink && (
              <a href={shaper.linkedin} target="_blank" rel="noopener noreferrer"
                className={styles.shaperIconLink} aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            )}
            {hasEmail && (
              <a href={'mailto:' + shaper.email}
                className={styles.shaperIconLink} aria-label={tc('email')}>
                <EmailIcon />
              </a>
            )}
          </div>
        </div>
      </div>
      <p className={styles.shaperBio}>{shaper.bio}</p>
    </div>
  );
}

export default function AboutPage() {
  const t  = useTranslations('AboutPage');
  const tr = useTranslations('Role');
  const tc = useTranslations('Common');

  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroOrb} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{t('eyebrow')}</p>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.description}>{t('description')}</p>
        </div>
      </section>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}><span className={styles.statNum}>37</span><span className={styles.statLabel}>{t('shapers')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>44</span><span className={styles.statLabel}>{t('statsInitiatives')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>100K+</span><span className={styles.statLabel}>{t('statsBenefited')}</span></div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}><span className={styles.statNum}>30+</span><span className={styles.statLabel}>{t('statsPartners')}</span></div>
      </div>

      {/* Mission */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('mission')}</h2>
          <div className={styles.divider} />
          <div className={styles.missionGrid}>
            {[
              { titleKey: 'missionGlobalTitle',   bodyKey: 'missionGlobalBody' },
              { titleKey: 'missionLocalTitle',    bodyKey: 'missionLocalBody' },
              { titleKey: 'missionYouthTitle',    bodyKey: 'missionYouthBody' },
              { titleKey: 'missionDialogueTitle', bodyKey: 'missionDialogueBody' },
            ].map(m => (
              <div key={m.titleKey} className={styles.missionCard}>
                <h3>{t(m.titleKey as Parameters<typeof t>[0])}</h3>
                <p>{t(m.bodyKey as Parameters<typeof t>[0])}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Current Curatorship */}
      <section className={styles.section}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('curatorship')}</h2>
          <div className={styles.divider} />
          <div className={styles.curatorshipGrid}>
            {CURATORSHIP.map((c) => (
              <div key={c.name} className={styles.curatorCard}>
                <div className={styles.curatorAvatarWrap}>
                  <div className={styles.curatorAvatar} style={{ background: c.gradient }}>
                    {initials(c.name)}
                  </div>
                </div>
                <div className={styles.curatorBody}>
                  <div className={styles.curatorName}>{c.name}</div>
                  <div className={styles.curatorRole}>{tr(c.role as Parameters<typeof tr>[0])}</div>
                  <p className={styles.curatorBio}>{c.bio}</p>
                  {c.linkedin && (
                    <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className={styles.curatorLinkedIn}>
                      <LinkedInIcon />
                      {tc('linkedIn')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shapers list */}
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>{t('shapers')}</h2>
          <p className={styles.sectionSubtitle}>{t('shapersSubtitle')}</p>
          <div className={styles.divider} />
          <div className={styles.shapersList}>
            {SHAPERS.map((s, i) => (
              <ShaperCard key={s.name + i} shaper={s} index={i} tc={tc} />
            ))}
          </div>
        </div>
      </section>

      {/* WEF Context */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.wefSection}>
            <div className={styles.wefText}>
              <h2 className={styles.sectionTitle}>{t('wefTitle')}</h2>
              <div className={styles.divider} style={{ margin: '1rem 0 1.5rem' }} />
              <p className={styles.wefBody}>{t('wefDesc')}</p>
            </div>
            <div className={styles.wefStats}>
              <div className={styles.wefStat}><span>500+</span><p>{t('wefCities')}</p></div>
              <div className={styles.wefStat}><span>10K+</span><p>{t('wefShapers')}</p></div>
              <div className={styles.wefStat}><span>10+</span><p>{t('wefYears')}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.cta}>
            <h2>{t('ctaTitle')}</h2>
            <p>{t('ctaDesc')}</p>
            <div className={styles.ctaButtons}>
              <Link href="/become-a-shaper" className={styles.ctaBtn}>{t('ctaApply')}</Link>
              <Link href="/projects" className={styles.ctaSecondary}>{t('ctaProjects')} &rarr;</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
