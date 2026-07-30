import ExcelJS from 'exceljs';

interface Initiative {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  stat?: string;
  problem?: string;
  objective?: string;
  impact?: string;
  impactAreas?: string[];
  members?: { userId: string; role: string }[];
  createdAt?: string;
}

export async function downloadInitiativeReport(
  init: Initiative,
  memberNames: Record<string, string> = {},
) {
  const wb = new ExcelJS.Workbook();

  /* ── Overview sheet ── */
  const wsOverview = wb.addWorksheet('Overview');
  wsOverview.columns = [{ width: 24 }, { width: 70 }];

  const rows: (string | number | undefined)[][] = [
    ['Initiative Impact Report'],
    [],
    ['Title',            init.title],
    ['Category',         init.category   || '—'],
    ['Status',           init.status     || '—'],
    ['Start Date',       init.startDate  || '—'],
    ['End Date',         init.endDate    || '—'],
    ['Key Stat',         init.stat       || '—'],
    [],
    ['Description',      init.description   || '—'],
    [],
    ['Problem Statement',init.problem       || '—'],
    [],
    ['Objective',        init.objective     || '—'],
    [],
    ['Impact',           init.impact        || '—'],
    [],
    ['Impact Areas',     (init.impactAreas || []).join(', ') || '—'],
    [],
    ['Total Members',    (init.members || []).length],
    ['Report Generated', new Date().toLocaleString()],
  ];

  rows.forEach(r => wsOverview.addRow(r));

  const titleCell = wsOverview.getCell('A1');
  titleCell.font = { bold: true, size: 14 };

  /* ── Team sheet ── */
  const wsTeam = wb.addWorksheet('Team');
  wsTeam.columns = [{ width: 6 }, { width: 32 }, { width: 22 }];
  wsTeam.addRow(['#', 'Name', 'Role']);
  wsTeam.getRow(1).font = { bold: true };

  const members = init.members || [];
  if (members.length === 0) {
    wsTeam.addRow(['', 'No members assigned', '']);
  } else {
    members.forEach((m, i) => {
      wsTeam.addRow([i + 1, memberNames[m.userId] || m.userId, m.role || 'Member']);
    });
  }

  /* Download via Blob */
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = init.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
  a.href = url;
  a.download = `${safeName}_Impact_Report.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
