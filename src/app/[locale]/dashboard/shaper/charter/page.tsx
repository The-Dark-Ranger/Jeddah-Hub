'use client';

import { useTranslations } from 'next-intl';
import { CHARTER_INTRO, CHARTER_SECTIONS, type CharterSection, type CharterBlock } from './charterContent';
import WefLogo from '@/components/WefLogo';
import { useAuth } from '@/context/AuthContext';
import { normalizeRole } from '@/lib/role';
import CharterAdmin from './CharterAdmin';
import CharterSignOff from './CharterSignOff';
import styles from './Charter.module.css';

/** ~200 words a minute over the whole document. */
const READ_MINUTES = Math.max(1, Math.round(
  [CHARTER_INTRO, ...CHARTER_SECTIONS]
    .flatMap(s => s.blocks)
    .flatMap(b => [...(b.paragraphs ?? []), ...(b.items ?? []).flatMap(i => [i.text, ...(i.subItems ?? [])]), b.footnote ?? ''])
    .join(' ').split(/\s+/).length / 200,
));

function Block({ block }: { block: CharterBlock }) {
  return (
    <>
      {block.paragraphs?.map((p, i) => (
        <p key={i} className={styles.paragraph}>{p}</p>
      ))}
      {block.items && (
        <ol className={styles.itemList}>
          {block.items.map((item, i) => (
            <li key={i} className={styles.item}>
              {item.marker
                ? <span className={styles.itemMarker}>{item.marker}</span>
                : <span className={styles.itemBullet}>–</span>}
              <span className={styles.itemBody}>
                {item.text}
                {item.subItems && (
                  <ul className={styles.subItemList}>
                    {item.subItems.map((sub, j) => (
                      <li key={j} className={styles.subItem}>{sub}</li>
                    ))}
                  </ul>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {block.footnote && <p className={styles.footnote}>{block.footnote}</p>}
    </>
  );
}

function Section({ section, isIntro, num }: { section: CharterSection; isIntro?: boolean; num?: number }) {
  return (
    <section id={section.id} className={isIntro ? styles.introSection : styles.section}>
      <h2 className={styles.sectionTitle}>
        {num !== undefined && <span className={styles.sectionNum} aria-hidden="true">{String(num).padStart(2, '0')}</span>}
        {section.title}
      </h2>
      {section.blocks.map((block, i) => <Block key={i} block={block} />)}
    </section>
  );
}

export default function CommunityCharterPage() {
  const t = useTranslations('CharterPage');
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const isCurator = role === 'curator' || role === 'vice_curator';

  return (
    <div className={styles.page}>
      {isCurator && <CharterAdmin />}
      <header className={styles.header}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>{t('eyebrow')}</p>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.subtitle}>{t('subtitle')}</p>
          <p className={styles.headerMeta}>
            {t('sectionsCount', { count: CHARTER_SECTIONS.length })}
            <span aria-hidden="true">·</span>
            {t('readMinutes', { n: READ_MINUTES })}
          </p>
        </div>
        <WefLogo alt="World Economic Forum" variant="white" height={52} className={styles.headerLogo} />
      </header>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label={t('tableOfContents')}>
          <details open className={styles.tocDetails}>
            <summary className={styles.tocTitle}>{t('tableOfContents')}</summary>
            <ol className={styles.tocList}>
              {CHARTER_SECTIONS.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={styles.tocLink}>
                    <span className={styles.tocNum}>{String(i + 1).padStart(2, '0')}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        </nav>

        <article className={styles.document}>
          <Section section={CHARTER_INTRO} isIntro />
          {CHARTER_SECTIONS.map((s, i) => <Section key={s.id} section={s} num={i + 1} />)}
          <CharterSignOff />
        </article>
      </div>
    </div>
  );
}
