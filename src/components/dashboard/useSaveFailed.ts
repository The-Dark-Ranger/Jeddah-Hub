'use client';

/* The sentence shown when a change couldn't be saved: "Could not save." and a
 * plain reason (no permission, no connection…), never a raw Firebase code.
 * Callers log errorCode(err) to the console for the details. */
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { errorReason } from '@/lib/types';

export function useSaveFailed() {
  const t = useTranslations('Dashboard');
  const tc = useTranslations('Common');
  return useCallback((err: unknown) => `${t('saveFailed')} ${tc(errorReason(err))}`, [t, tc]);
}
