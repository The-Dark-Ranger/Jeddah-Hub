'use client';

/* "Download report" on the initiative dashboards, with its failure handled:
 * the spreadsheet code is fetched only when asked for, so a dropped
 * connection or a failed build says so instead of the button doing nothing. */
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { downloadReport } from '@/lib/initiativeReport';
import { errorCode } from '@/lib/types';

export function useReportDownload() {
  const t = useTranslations('Common');
  return useCallback(async (...args: Parameters<typeof downloadReport>) => {
    try {
      await downloadReport(...args);
    } catch (err) {
      console.error('Failed to build the report:', errorCode(err));
      alert(t('downloadFailed'));
    }
  }, [t]);
}
