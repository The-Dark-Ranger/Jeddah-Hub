'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './SearchSelect.module.css';

export interface SearchOption {
  value: string;
  label: string;
  /** Second line, e.g. an email or role. Also searched. */
  hint?: string;
  /** Extra text that matches a search without being shown (e.g. an Arabic name). */
  keywords?: string;
  /** Shown but not selectable, with this note (e.g. "Already a member"). */
  disabledNote?: string;
}

interface Props {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  noResults: string;
  /** Accessible label for the "clear selection" button. */
  clearLabel: string;
  className?: string;
  ariaLabel?: string;
}

/** Arabic-insensitive, case-insensitive match: alef/yaa/taa-marbuta forms
 *  and diacritics are folded so "احمد" finds "أحمد". */
function fold(s: string) {
  return s.toLowerCase()
    // NFKD splits أ/إ/آ into ا plus a separate hamza/madda mark, so the
    // Arabic mark range (harakat, hamza, madda, dagger alef) is dropped too.
    .normalize('NFKD').replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

/** A dropdown you can type into to filter, for long lists of people or
 *  initiatives. Keyboard: ↑/↓ to move, Enter to pick, Esc to close. */
export default function SearchSelect({ options, value, onChange, placeholder, noResults, clearLabel, className, ariaLabel }: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = options.find(o => o.value === value);

  const matches = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter(o => {
      const hay = fold(`${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`);
      return words.every(w => hay.includes(w));
    });
  }, [options, query]);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o: SearchOption) => {
    if (o.disabledNote) return;
    onChange(o.value);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (open && matches[active]) { e.preventDefault(); pick(matches[active]); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className={styles.wrap + (className ? ' ' + className : '')}>
      <div className={styles.field + (open ? ' ' + styles.fieldOpen : '')}>
        <svg className={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          className={styles.input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel ?? placeholder}
          aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
          value={open ? query : (selected?.label ?? '')}
          placeholder={selected ? selected.label : placeholder}
          onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
          onClick={() => { if (!open) { setOpen(true); setQuery(''); setActive(0); } }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
        />
        {value && !open && (
          <button type="button" className={styles.clear} onClick={() => onChange('')} aria-label={clearLabel} title={clearLabel}>×</button>
        )}
      </div>

      {open && (
        <ul ref={listRef} id={listId} role="listbox" className={styles.list}>
          {matches.length === 0 ? (
            <li className={styles.empty}>{noResults}</li>
          ) : matches.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              aria-disabled={!!o.disabledNote}
              className={styles.option
                + (i === active ? ' ' + styles.optionActive : '')
                + (o.value === value ? ' ' + styles.optionSelected : '')
                + (o.disabledNote ? ' ' + styles.optionDisabled : '')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={e => { e.preventDefault(); pick(o); }}
            >
              <span className={styles.optionLabel}>{o.label}</span>
              {(o.hint || o.disabledNote) && <span className={styles.optionHint}>{o.disabledNote ?? o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
