import { readFileSync } from 'fs';
import path from 'path';

import PDFDocument from 'pdfkit';

import type { StatementData, StatementPeriod } from '@/lib/services/statement.service';

// A13: render a cleaner earnings statement as an official-looking PDF (pdfkit).
// Returns a Buffer so the API route can stream it as an attachment.
//
// DEPLOY-SAFETY: pdfkit's built-in fonts read metrics from `.afm` files on disk
// (fs.readFileSync(__dirname + '/data/Helvetica.afm')), which the bundled Next
// build strips — causing an ENOENT at PDFDocument construction in production.
// We avoid that entirely by shipping our own Roboto TTFs in `public/fonts` (a
// path Next always deploys, resolved from process.cwd() — NOT the bundled module
// dir) and passing the regular buffer as the constructor's `font` option, so NO
// standard font (and no .afm) is ever loaded.
const FONT_REGULAR = 'regular';
const FONT_BOLD = 'bold';

// Loaded once at module init from public/fonts (Roboto, Apache-2.0).
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts');
const ROBOTO_REGULAR = readFileSync(path.join(FONT_DIR, 'Roboto-Regular.ttf'));
const ROBOTO_BOLD = readFileSync(path.join(FONT_DIR, 'Roboto-Bold.ttf'));

interface RenderInput {
  cleanerName: string;
  period: StatementPeriod;
  data: StatementData;
  generatedOn: Date;
}

const INK = '#1b2a4a';
const MUTED = '#6b7280';
const LINE = '#d1d5db';

const money = (n: number) => `£${n.toFixed(2)}`;

// Column layout (A4, 50pt margins → content 50..545).
const COLS = {
  date: { x: 50, w: 70 },
  service: { x: 120, w: 150 },
  price: { x: 270, w: 88 },
  commission: { x: 358, w: 88 },
  net: { x: 446, w: 99 },
};
const RIGHT_EDGE = 545;

export function renderStatementPdf(input: RenderInput): Promise<Buffer> {
  const { cleanerName, period, data, generatedOn } = input;

  return new Promise<Buffer>((resolve, reject) => {
    // Pass the embedded regular font as the default so pdfkit never touches its
    // built-in Helvetica.afm (see DEPLOY-SAFETY note above). The types only allow
    // a string path for `font`, but pdfkit accepts a Buffer at runtime.
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      font: ROBOTO_REGULAR as unknown as string,
    });
    doc.registerFont(FONT_REGULAR, ROBOTO_REGULAR);
    doc.registerFont(FONT_BOLD, ROBOTO_BOLD);

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ─── Header ───────────────────────────────────────────────
    doc.fillColor(INK).fontSize(20).font(FONT_BOLD).text('RENA CLEANING NETWORK', 50, 50);
    doc
      .fillColor(MUTED)
      .fontSize(9)
      .font(FONT_REGULAR)
      .text('Rena Cleaning Network · support@renacleaning.co.uk · www.renacleaning.co.uk', 50, 74);

    doc.fillColor(INK).fontSize(15).font(FONT_BOLD).text('Earnings Statement', 50, 104);

    doc.fillColor(INK).fontSize(10).font(FONT_REGULAR);
    doc.text(`Cleaner: ${cleanerName || 'Cleaner'}`, 50, 128);
    doc.text(`Period: ${period.label}`, 50, 143);

    // ─── Table header ─────────────────────────────────────────
    let y = 178;
    const drawHeaderRow = (yy: number) => {
      doc.fillColor(INK).fontSize(9).font(FONT_BOLD);
      doc.text('Date', COLS.date.x, yy, { width: COLS.date.w });
      doc.text('Service', COLS.service.x, yy, { width: COLS.service.w });
      doc.text('Your service price', COLS.price.x, yy, { width: COLS.price.w, align: 'right' });
      doc.text('Rena commission', COLS.commission.x, yy, {
        width: COLS.commission.w,
        align: 'right',
      });
      doc.text('Your net earnings', COLS.net.x, yy, { width: COLS.net.w, align: 'right' });
      doc
        .strokeColor(LINE)
        .lineWidth(0.5)
        .moveTo(50, yy + 14)
        .lineTo(RIGHT_EDGE, yy + 14)
        .stroke();
    };
    drawHeaderRow(y);
    y += 22;

    // ─── Rows ─────────────────────────────────────────────────
    doc.font(FONT_REGULAR).fontSize(9).fillColor(INK);
    if (data.rows.length === 0) {
      doc
        .fillColor(MUTED)
        .text('No released earnings in this period.', 50, y, { width: RIGHT_EDGE - 50 });
      y += 18;
    }
    for (const row of data.rows) {
      // Page break.
      if (y > 760) {
        doc.addPage();
        y = 50;
        drawHeaderRow(y);
        y += 22;
        doc.font(FONT_REGULAR).fontSize(9).fillColor(INK);
      }
      const label = new Date(row.date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      doc.fillColor(INK);
      doc.text(label, COLS.date.x, y, { width: COLS.date.w });
      doc.text(prettyService(row.service), COLS.service.x, y, { width: COLS.service.w });
      doc.text(money(row.servicePrice), COLS.price.x, y, { width: COLS.price.w, align: 'right' });
      doc.text(money(row.commission), COLS.commission.x, y, {
        width: COLS.commission.w,
        align: 'right',
      });
      doc.text(money(row.net), COLS.net.x, y, { width: COLS.net.w, align: 'right' });
      y += 18;
    }

    // ─── Totals ───────────────────────────────────────────────
    doc
      .strokeColor(INK)
      .lineWidth(1)
      .moveTo(50, y + 2)
      .lineTo(RIGHT_EDGE, y + 2)
      .stroke();
    y += 10;
    doc.font(FONT_BOLD).fontSize(9).fillColor(INK);
    doc.text('Totals', COLS.date.x, y, { width: COLS.date.w + COLS.service.w });
    doc.text(money(data.totals.servicePrice), COLS.price.x, y, {
      width: COLS.price.w,
      align: 'right',
    });
    doc.text(money(data.totals.commission), COLS.commission.x, y, {
      width: COLS.commission.w,
      align: 'right',
    });
    doc.text(money(data.totals.net), COLS.net.x, y, { width: COLS.net.w, align: 'right' });
    y += 26;

    doc
      .font(FONT_BOLD)
      .fontSize(10)
      .fillColor(INK)
      .text(`Total net earnings received: ${money(data.totals.net)}`, 50, y, {
        width: RIGHT_EDGE - 50,
      });
    y += 30;

    // ─── Footer notes ─────────────────────────────────────────
    doc.font(FONT_REGULAR).fontSize(8).fillColor(MUTED);
    const notes = [
      'This statement is provided for your own records and self-assessment. You are self-employed; Rena is not your employer and does not deduct tax or National Insurance on your behalf.',
      'Figures cover jobs whose funds were released to you within the period, based on the job completion date.',
      `Generated on ${generatedOn.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
    ];
    for (const n of notes) {
      doc.text(n, 50, y, { width: RIGHT_EDGE - 50 });
      y += doc.heightOfString(n, { width: RIGHT_EDGE - 50 }) + 6;
    }

    doc.end();
  });
}

function prettyService(s: string): string {
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
