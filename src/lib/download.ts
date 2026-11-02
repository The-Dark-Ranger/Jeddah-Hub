/* Saves a file the page built itself (spreadsheet, CSV, PDF) to the device. */
import { spreadsheetSafe } from '@/lib/sanitize';

/** The address is released a moment later: Safari and Firefox can cancel the
 *  download if it goes away while the click is still being handled. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** A CSV file: every value quoted, formula-looking values neutralised, and a
 *  byte-order mark so Excel reads Arabic correctly. */
export function csvBlob(rows: string[][]): Blob {
  const csv = rows.map(row => row.map(v => `"${String(spreadsheetSafe(v)).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  return new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
}
