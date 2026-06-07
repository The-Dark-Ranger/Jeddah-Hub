import { useTranslations } from 'next-intl';
import styles from './BecomeShaper.module.css';

export default function BecomeAShaperPage() {
  const t = useTranslations('BecomeShaperPage');

  const criteriaBlocks = [
    { title: t('applyTitle'),  items: (t.raw('criteria1') as string[]) },
    { title: t('lookTitle'),   items: (t.raw('criteria2') as string[]) },
    { title: t('expectTitle'), items: (t.raw('criteria3') as string[]) },
  ];

  const steps = t.raw('steps') as Array<{ num: string; title: string; body: string }>;

  // "Life as a Shaper" value cards — edit icon SVGs or add/remove cards here.
  // Corresponding text keys live in messages/[locale].json → BecomeShaperPage.
  const values = [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      title: t('value1Title'),
      body:  t('value1Body'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
      title: t('value2Title'),
      body:  t('value2Body'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      title: t('value3Title'),
      body:  t('value3Body'),
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
      title: t('value4Title'),
      body:  t('value4Body'),
    },
  ];

  // Testimonial quotes — add/remove entries here. Text is pulled from i18n keys.
  // To add a quote: add quoteN / quoteNAuthor / quoteNRole keys to both message files,
  // then push a new object to this array.
  const quotes = [
    { text: t('quote1'), author: t('quote1Author'), role: t('quote1Role') },
    { text: t('quote2'), author: t('quote2Author'), role: t('quote2Role') },
    { text: t('quote3'), author: t('quote3Author'), role: t('quote3Role') },
  ];

  return (
    <main className={styles.page}>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>{t('heroEyebrow')}</p>
          <h1 className={styles.heroTitle}>{t('title')}</h1>
          <p className={styles.heroSubtitle}>{t('subtitle')}</p>
          <a
            href="https://www.weforum.org/communities/global-shapers-community"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.heroBtn}
          >
            {t('applyNow')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
        <div className={styles.heroChips}>
          <div className={styles.heroChip}><strong>37</strong><span>{t('statShapers')}</span></div>
          <div className={styles.heroChip}><strong>44</strong><span>{t('statInitiatives')}</span></div>
          <div className={styles.heroChip}><strong>100K+</strong><span>{t('statBenefited')}</span></div>
        </div>
      </section>

      {/* Who Are Global Shapers */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.splitRow}>
            <div className={styles.splitText}>
              <p className={styles.eyebrow}>{t('whoTitle')}</p>
              <h2 className={styles.sectionTitle}>{t('drivenSubtitle')}</h2>
              <p className={styles.sectionBody}>{t('whoBody')}</p>
            </div>
            <div className={styles.splitStats}>
              <div className={styles.statBox}><span className={styles.statNum}>37</span><p className={styles.statLabel}>{t('statShapers')}</p></div>
              <div className={styles.statBox}><span className={styles.statNum}>44</span><p className={styles.statLabel}>{t('statInitiatives')}</p></div>
              <div className={styles.statBox}><span className={styles.statNum}>100K+</span><p className={styles.statLabel}>{t('statBenefited')}</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Criteria grid */}
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <div className={styles.criteriaGrid}>
            {criteriaBlocks.map((block, idx) => (
              <div key={block.title} className={styles.criteriaCard}>
                <div className={styles.criteriaNum}>0{idx + 1}</div>
                <h3 className={styles.criteriaTitle}>{block.title}</h3>
                <ul className={styles.criteriaList}>
                  {block.items.map((item, i) => (
                    <li key={i} className={styles.criteriaItem}>
                      <svg className={styles.checkIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.section}>
        <div className={styles.container}>
          <p className={styles.eyebrow}>{t('processLabel')}</p>
          <h2 className={styles.sectionTitle} style={{ marginBottom: '3rem' }}>{t('howTitle')}</h2>
          <div className={styles.stepsGrid}>
            {steps.map(step => (
              <div key={step.num} className={styles.stepCard}>
                <div className={styles.stepNum}>{step.num}</div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Life as a Shaper — Values */}
      <section className={styles.sectionAlt}>
        <div className={styles.container}>
          <div className={styles.valuesHeader}>
            <p className={styles.eyebrow}>{t('valuesTitle')}</p>
            <h2 className={styles.sectionTitle}>{t('valuesSubtitle')}</h2>
          </div>
          <div className={styles.valuesGrid}>
            {values.map(v => (
              <div key={v.title} className={styles.valueCard}>
                <div className={styles.valueIcon}>{v.icon}</div>
                <h3 className={styles.valueTitle}>{v.title}</h3>
                <p className={styles.valueBody}>{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voices from Our Shapers */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.voicesHeader}>
            <p className={styles.eyebrow}>{t('voicesTitle')}</p>
            <h2 className={styles.sectionTitle}>{t('voicesSubtitle')}</h2>
          </div>
          <div className={styles.quotesGrid}>
            {quotes.map(q => (
              <div key={q.author} className={styles.quoteCard}>
                <div className={styles.quoteMark}>&ldquo;</div>
                <p className={styles.quoteText}>{q.text}</p>
                <div className={styles.quoteAuthor}>
                  <div className={styles.quoteAvatar}>{q.author.charAt(0)}</div>
                  <div>
                    <p className={styles.quoteName}>{q.author}</p>
                    <p className={styles.quoteRole}>{q.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.cta}>
            <h2>{t('ctaTitle')}</h2>
            <p>{t('ctaBody')}</p>
            <a
              href="https://www.weforum.org/communities/global-shapers-community"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaBtn}
            >
              {t('applyNow')}
            </a>
            <p className={styles.ctaNote}>{t('ctaNote')}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
