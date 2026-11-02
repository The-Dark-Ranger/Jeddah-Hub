/* The list of members who signed the Charter, downloaded by the Curator and
 * Vice Curator: Excel for reading, CSV for moving the data elsewhere. Every
 * cell is spreadsheet-safe, because names are typed by members. */
import type { CharterSignature } from '@/lib/charterSignature';
import { csvBlob, downloadBlob } from '@/lib/download';
import { spreadsheetSafe } from '@/lib/sanitize';

export interface SignOffMember {
  uid: string;
  name: string;
  email: string;
  role: string;
}

const HEADER = ['Name', 'Email', 'Role', 'Name signed', 'Signed at (UTC)', 'Member ID'];

/** One row per signature, including anyone who has since left or become an
 *  alumnus, so no record is lost. */
function signerRows(everyone: SignOffMember[], signatures: Record<string, CharterSignature>): string[][] {
  return Object.values(signatures)
    .map(sig => {
      const member = everyone.find(m => m.uid === sig.uid);
      return [
        member?.name ?? sig.name, member?.email ?? '', member?.role ?? '', sig.name,
        sig.signedAtServer?.toDate?.().toISOString() ?? sig.signedAt, sig.uid,
      ];
    })
    .sort((a, b) => a[0].localeCompare(b[0]));
}

const fileName = (extension: string) =>
  `jeddah-hub-charter-sign-offs-${new Date().toISOString().slice(0, 10)}.${extension}`;

export function downloadSignOffsCsv(everyone: SignOffMember[], signatures: Record<string, CharterSignature>) {
  downloadBlob(csvBlob([HEADER, ...signerRows(everyone, signatures)]), fileName('csv'));
}

export async function downloadSignOffsExcel(everyone: SignOffMember[], signatures: Record<string, CharterSignature>) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Charter sign-offs');
  ws.columns = [{ width: 28 }, { width: 32 }, { width: 16 }, { width: 28 }, { width: 26 }, { width: 32 }];
  ws.addRow(HEADER);
  ws.getRow(1).font = { bold: true };
  signerRows(everyone, signatures).forEach(row => ws.addRow(row.map(spreadsheetSafe)));
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName('xlsx'),
  );
}
