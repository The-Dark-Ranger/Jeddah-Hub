'use client';

/* Calendar: true on laptop-sized screens, where the calendar shows the large
 * month grid and the seven-column week (made for showing in meetings). */
import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 900px)';

export function useWide(): boolean {
  return useSyncExternalStore(
    cb => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
