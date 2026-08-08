import ExcelJS from 'exceljs';

interface Question {
  id: string;
  label: string;
}

interface Response {
  id: string;
  answers: Record<string, string>;
  submittedAt: string;
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
    ...questions.map(() => ({ width: 28 })),
  ];

  const header = ['Submitted At', ...questions.map(q => q.label)];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };

  if (responses.length === 0) {
    ws.addRow(['No responses yet']);
  } else {
    responses.forEach(r => {
      ws.addRow([
        new Date(r.submittedAt).toLocaleString(),
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
