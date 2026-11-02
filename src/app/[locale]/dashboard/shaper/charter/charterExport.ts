/* The Charter sign-off register a curator downloads: one row per member, in
 * Excel for reading or CSV for moving the data into another system. Every cell
 * is spreadsheet-safe, because names are typed by members. */
import { csvBlob, downloadBlob } from '@/lib/download';
import { SIGNING_ROLES, type CharterSignature } from '@/lib/charterSignature';
import { spreadsheetSafe } from '@/lib/sanitize';

export interface RegisterMember {
  uid: string;
  name: string;
  email: string;
  role: string;
}

const HEADER = ['Name', 'Email', 'Role', 'Status', 'Name signed', 'Signed at (UTC)', 'Member ID'];

function signedAtUtc(sig: CharterSignature) {
  return sig.signedAtServer?.toDate?.().toISOString() ?? sig.signedAt;
}

/** Everyone asked to sign, plus anyone else with a signature on record (for
 *  example a Shaper who has since become an alumnus), so no record is lost. */
function registerRows(members: RegisterMember[], signatures: Record<string, CharterSignature>): string[][] {
  const known = new Set(members.map(m => m.uid));
  const orphans = Object.values(signatures)
    .filter(s => !known.has(s.uid))
    .map(s => ({ uid: s.uid, name: s.name, email: '', role: '' }));
  return [...members.filter(m => SIGNING_ROLES.includes(m.role) || signatures[m.uid]), ...orphans]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(m => {
      const sig = signatures[m.uid];
      return [m.name, m.email, m.role, sig ? 'Signed' : 'Not signed', sig?.name ?? '', sig ? signedAtUtc(sig) : '', m.uid];
    });
}

const fileName = (extension: string) =>
  `jeddah-hub-charter-signoffs-${new Date().toISOString().slice(0, 10)}.${extension}`;

export function downloadSignOffsCsv(members: RegisterMember[], signatures: Record<string, CharterSignature>) {
  downloadBlob(csvBlob([HEADER, ...registerRows(members, signatures)]), fileName('csv'));
}

export async function downloadSignOffsExcel(members: RegisterMember[], signatures: Record<string, CharterSignature>) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Charter sign-offs');
  ws.columns = [{ width: 28 }, { width: 32 }, { width: 16 }, { width: 12 }, { width: 28 }, { width: 26 }, { width: 32 }];
  ws.addRow(HEADER);
  ws.getRow(1).font = { bold: true };
  registerRows(members, signatures).forEach(row => ws.addRow(row.map(spreadsheetSafe)));
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    fileName('xlsx'),
  );
}
