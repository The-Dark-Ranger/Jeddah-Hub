/* Builds the Community Charter as a PDF in the browser, from the same text the
 * page shows (charterContent.ts). With a signature, the file ends with the
 * member's sign-off, so they can keep their own record. The PDF code (about
 * 500 KB) is fetched only when someone downloads. */
import type { PDFFont } from 'pdf-lib';
import { downloadBlob } from '@/lib/download';
import { CHARTER_INTRO, CHARTER_SECTIONS, type CharterBlock, type CharterSection } from './charterContent';

interface SignedBy {
  name: string;
  email: string | null;
  signedAt: string;
}

const PAGE = { width: 595.28, height: 841.89, margin: 56 };
const BLUE = [0.059, 0.353, 0.624] as const;
const INK = [0.13, 0.16, 0.2] as const;
const MUTED = [0.42, 0.46, 0.52] as const;

export async function downloadCharterPdf(signedBy?: SignedBy) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  type Colour = readonly [number, number, number];

  const pdf = await PDFDocument.create();
  pdf.setTitle('Global Shapers Community Charter');
  pdf.setSubject('Community Charter');
  pdf.setCreator('Jeddah Hub');
  pdf.setProducer('Jeddah Hub');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const right = PAGE.width - PAGE.margin;
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;

  const startPageIfNeeded = (needed: number) => {
    if (y - needed >= PAGE.margin + 18) return;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };

  /** Characters the built-in fonts can't draw (a name in Arabic, say) would
   *  stop the whole file, so they're left out here. */
  const printable = (text: string, font: PDFFont) => {
    const known = new Set(font.getCharacterSet());
    return [...text].filter(c => known.has(c.codePointAt(0)!)).join('');
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    let line = '';
    for (const word of printable(text, font).split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawText = (text: string, opts: { font?: PDFFont; size?: number; color?: Colour; indent?: number; gap?: number } = {}) => {
    const { font = regular, size = 10.5, color = INK, indent = 0, gap = 6 } = opts;
    const lineHeight = size * 1.45;
    for (const line of wrap(text, font, size, right - PAGE.margin - indent)) {
      startPageIfNeeded(lineHeight);
      y -= lineHeight;
      page.drawText(line, { x: PAGE.margin + indent, y, size, font, color: rgb(...color) });
    }
    y -= gap;
  };

  const drawBlock = (block: CharterBlock) => {
    block.paragraphs?.forEach(p => drawText(p));
    block.items?.forEach(item => {
      const marker = item.marker ?? '-';
      const indent = item.marker ? 30 : 14;
      startPageIfNeeded(16);
      page.drawText(printable(marker, bold), { x: PAGE.margin, y: y - 15, size: 10.5, font: bold, color: rgb(...BLUE) });
      drawText(item.text, { indent, gap: 4 });
      item.subItems?.forEach(sub => {
        startPageIfNeeded(16);
        page.drawText('-', { x: PAGE.margin + indent, y: y - 15, size: 10.5, font: regular, color: rgb(...MUTED) });
        drawText(sub, { indent: indent + 12, gap: 3 });
      });
    });
    if (block.footnote) drawText(block.footnote, { size: 9, color: MUTED });
  };

  const drawSection = (section: CharterSection, num?: number) => {
    y -= 10;
    startPageIfNeeded(50);
    drawText(num === undefined ? section.title : `${num}. ${section.title}`, { font: bold, size: 13, color: BLUE, gap: 6 });
    section.blocks.forEach(drawBlock);
  };

  drawText('GLOBAL SHAPERS COMMUNITY', { font: bold, size: 9.5, color: MUTED, gap: 2 });
  drawText('Community Charter', { font: bold, size: 24, color: BLUE, gap: 10 });
  drawSection(CHARTER_INTRO);
  CHARTER_SECTIONS.forEach((s, i) => drawSection(s, i + 1));

  if (signedBy) {
    y -= 14;
    startPageIfNeeded(90);
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: right, y }, thickness: 0.75, color: rgb(...MUTED) });
    y -= 8;
    drawText('Member sign-off', { font: bold, size: 13, color: BLUE });
    drawText('I have read the Community Charter and I will adhere to it.');
    // Fall back to the email when the name is written in a script the fonts lack.
    const name = printable(signedBy.name, regular).trim() || signedBy.email || '';
    drawText(`Signed by: ${name}`, { gap: 2 });
    drawText(`Signed on: ${new Date(signedBy.signedAt).toISOString().slice(0, 10)}`);
  }

  pdf.getPages().forEach((p, i, all) => {
    const label = `Page ${i + 1} of ${all.length}`;
    p.drawText(label, {
      x: right - regular.widthOfTextAtSize(label, 8.5), y: PAGE.margin - 24,
      size: 8.5, font: regular, color: rgb(...MUTED),
    });
  });

  const bytes = await pdf.save();
  downloadBlob(
    new Blob([bytes as BlobPart], { type: 'application/pdf' }),
    signedBy ? 'Community-Charter-signed.pdf' : 'Community-Charter.pdf',
  );
}
