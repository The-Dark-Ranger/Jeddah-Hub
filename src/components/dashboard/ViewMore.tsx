'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import styles from './ViewMore.module.css';

/** How many rows a long dashboard list shows before "View more". */
export const PAGE_SIZE = 10;

/** Shows the first `PAGE_SIZE` items of a list, then PAGE_SIZE more per
 *  "View more" tap. `resetKey` (e.g. the search text and filter) starts it
 *  over at the first page whenever it changes. */
export function useViewMore<T>(items: T[], resetKey: string) {
  const [state, setState] = useState({ key: resetKey, limit: PAGE_SIZE });
  // Reset during render when the key changes (no extra effect pass).
  if (state.key !== resetKey) setState({ key: resetKey, limit: PAGE_SIZE });
  const limit = state.key === resetKey ? state.limit : PAGE_SIZE;
  return {
    shown: items.slice(0, limit),
    hiddenCount: Math.max(0, items.length - limit),
    expanded: limit > PAGE_SIZE,
    more: () => setState(s => ({ ...s, limit: s.limit + PAGE_SIZE })),
    less: () => setState(s => ({ ...s, limit: PAGE_SIZE })),
  };
}

/** "View more (N more)" / "View less" under a list. Renders nothing when
 *  the whole list fits in one page. */
export default function ViewMoreButton({ hiddenCount, expanded, onMore, onLess }: {
  hiddenCount: number; expanded: boolean; onMore: () => void; onLess: () => void;
}) {
  const t = useTranslations('Dashboard');
  if (hiddenCount === 0 && !expanded) return null;
  return (
    <div className={styles.row}>
      {hiddenCount > 0 && (
        <button type="button" className={styles.more} onClick={onMore}>
          {t('viewMoreCount', { count: Math.min(hiddenCount, PAGE_SIZE), total: hiddenCount })}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      )}
      {expanded && (
        <button type="button" className={styles.less} onClick={onLess}>
          {t('viewLess')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
        </button>
      )}
    </div>
  );
}
