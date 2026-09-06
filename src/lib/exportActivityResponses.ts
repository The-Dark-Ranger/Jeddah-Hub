import ExcelJS from 'exceljs';

interface Question {
  id: string;
  label: string;
}

interface Response {
  id: string;
  answers: Record<string, string>;
  submittedAt: string;
  submitterName?: string;
  submitterEmail?: string;
}

export async function downloadActivityResponses(
  activityTitle: string,
  questions: Question[],
  responses: Response[],
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Responses');

  ws.columns = [
    { width: 22 },
    { width: 22 },
    { width: 26 },
    ...questions.map(() => ({ width: 28 })),
  ];

  // Name/email are surfaced even though the submission form never requires
  // them (registrations are open to the public, no account needed) — a
  // curator following up on a response needs a way to reach the
  // respondent, not just read their answers.
  const header = ['Submitted At', 'Name', 'Email', ...questions.map(q => q.label)];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };

  if (responses.length === 0) {
    ws.addRow(['No responses yet']);
  } else {
    responses.forEach(r => {
      ws.addRow([
        new Date(r.submittedAt).toLocaleString(),
        r.submitterName || '',
        r.submitterEmail || '',
        ...questions.map(q => r.answers?.[q.id] ?? ''),
      ]);
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = activityTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
  a.href = url;
  a.download = `${safeName}_Responses.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
