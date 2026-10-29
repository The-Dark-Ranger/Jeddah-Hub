/* "Download report" on the initiative dashboards. The spreadsheet code
 * (ExcelJS, about 900 KB) is fetched only when a report is downloaded,
 * instead of with every visit to the page. */
import type { downloadInitiativeReport as Download } from './exportInitiative';

/** The initiative fields a report is built from. */
export type ReportInitiative = Parameters<typeof Download>[0];

export async function downloadReport(...args: Parameters<typeof Download>) {
  const { downloadInitiativeReport } = await import('./exportInitiative');
  return downloadInitiativeReport(...args);
}
