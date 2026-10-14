import styles from './Legal.module.css';

interface Section { heading: string; body: string; }

/** Body of the Privacy Policy and Terms pages: a numbered table of contents
 *  (sticky beside the text on desktop, a collapsible list on phones) and the
 *  sections it links to. */
export default function LegalDocument({ intro, sections, tocLabel }: { intro: string; sections: Section[]; tocLabel: string }) {
  return (
    <div className={styles.layout}>
      <nav className={styles.toc} aria-label={tocLabel}>
        <details className={styles.tocDetails} open>
          <summary className={styles.tocTitle}>{tocLabel}</summary>
          <ol className={styles.tocList}>
            {sections.map((s, i) => (
              <li key={i}>
                <a href={`#section-${i + 1}`} className={styles.tocLink}>
                  <span className={styles.tocNum}>{String(i + 1).padStart(2, '0')}</span>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </details>
      </nav>

      <div className={styles.content}>
        <p className={styles.intro}>{intro}</p>
        <div className={styles.sections}>
          {sections.map((s, i) => (
            <section key={i} id={`section-${i + 1}`} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNum} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                {s.heading}
              </h2>
              <div className={styles.sectionBody}>
                {s.body.split('\n\n').map((para, j) => <p key={j}>{para}</p>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
