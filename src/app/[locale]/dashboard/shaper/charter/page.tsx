'use client';

import { useTranslations } from 'next-intl';
import { CHARTER_INTRO, CHARTER_SECTIONS, type CharterSection, type CharterBlock } from './charterContent';
import styles from './Charter.module.css';

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
                : <span className={styles.itemBullet}>&bull;</span>}
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

function Section({ section, isIntro }: { section: CharterSection; isIntro?: boolean }) {
  return (
    <section id={section.id} className={isIntro ? styles.introSection : styles.section}>
      <h2 className={styles.sectionTitle}>{section.title}</h2>
      {section.blocks.map((block, i) => <Block key={i} block={block} />)}
    </section>
  );
}

export default function CommunityCharterPage() {
  const t = useTranslations('CharterPage');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{t('eyebrow')}</p>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>
      </div>

      <nav className={styles.toc} aria-label={t('tableOfContents')}>
        <p className={styles.tocTitle}>{t('tableOfContents')}</p>
        <ul className={styles.tocList}>
          {CHARTER_SECTIONS.map(s => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={styles.tocLink}>{s.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <article className={styles.document}>
        <Section section={CHARTER_INTRO} isIntro />
        {CHARTER_SECTIONS.map(s => <Section key={s.id} section={s} />)}
      </article>
    </div>
  );
}
