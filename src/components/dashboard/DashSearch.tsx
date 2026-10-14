'use client';

import { useTranslations } from 'next-intl';
import styles from './DashSearch.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Shown at the end of the field, e.g. "12 results". */
  resultLabel?: string;
}

/** The search field shared by the dashboard's list pages. */
export default function DashSearch({ value, onChange, placeholder, resultLabel }: Props) {
  const t = useTranslations('Dashboard');
  return (
    <div className={styles.wrap} role="search">
      <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Escape') onChange(''); }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      {value && resultLabel && <span className={styles.count} aria-live="polite">{resultLabel}</span>}
      {value && (
        <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label={t('clearSearch')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** Case- and accent-insensitive match of a query against any of the fields. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const q = normalize(query.trim());
  if (!q) return true;
  return fields.some(f => f && normalize(f).includes(q));
}

function normalize(s: string) {
  return s.toLocaleLowerCase().normalize('NFKD').replace(/[̀-ًͯ-ْ]/g, '');
}
