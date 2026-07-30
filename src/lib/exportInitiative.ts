import * as XLSX from 'xlsx';

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

export function downloadInitiativeReport(init: Initiative, memberNames: Record<string, string> = {}) {
  const wb = XLSX.utils.book_new();

  /* ── Overview sheet ── */
  const overview = [
    ['Initiative Impact Report'],
    [],
    ['Title',         init.title],
    ['Category',      init.category      || '—'],
    ['Status',        init.status        || '—'],
    ['Start Date',    init.startDate     || '—'],
    ['End Date',      init.endDate       || '—'],
    ['Key Stat',      init.stat          || '—'],
    [],
    ['Description',   init.description   || '—'],
    [],
    ['Problem Statement', init.problem   || '—'],
    [],
    ['Objective',     init.objective     || '—'],
    [],
    ['Impact',        init.impact        || '—'],
    [],
    ['Impact Areas',  (init.impactAreas || []).join(', ') || '—'],
    [],
    ['Total Members', (init.members || []).length],
    ['Report Generated', new Date().toLocaleString()],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overview);

  /* Style the title row (bold + wide column) */
  wsOverview['!cols'] = [{ wch: 22 }, { wch: 70 }];
  if (wsOverview['A1']) wsOverview['A1'].s = { font: { bold: true, sz: 14 } };

  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  /* ── Team sheet ── */
  const members = init.members || [];
  const teamRows: string[][] = [['#', 'Name', 'Role']];
  members.forEach((m, i) => {
    teamRows.push([String(i + 1), memberNames[m.userId] || m.userId, m.role || 'Member']);
  });
  if (members.length === 0) teamRows.push(['', 'No members assigned', '']);

  const wsTeam = XLSX.utils.aoa_to_sheet(teamRows);
  wsTeam['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsTeam, 'Team');

  /* Download */
  const safeName = init.title.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
  XLSX.writeFile(wb, `${safeName}_Impact_Report.xlsx`);
}
