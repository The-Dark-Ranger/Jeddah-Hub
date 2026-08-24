'use client';

import { useState } from 'react';
import styles from './BecomeShaper.module.css';

export default function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [openFaqs, setOpenFaqs] = useState<Set<number>>(new Set());

  const toggle = (i: number) => setOpenFaqs(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div className={styles.faqList}>
      {faqs.map((faq, i) => {
        const isOpen = openFaqs.has(i);
        return (
          <div key={i} className={styles.faqItem + (isOpen ? ' ' + styles.faqItemOpen : '')}>
            <button
              type="button"
              className={styles.faqQuestion}
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${i}`}
            >
              {faq.q}
              <svg className={styles.faqChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <div className={styles.faqAnswerWrap} id={`faq-answer-${i}`} role="region">
              <div className={styles.faqAnswerInner}>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
