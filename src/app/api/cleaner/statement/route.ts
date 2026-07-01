import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { renderStatementPdf } from '@/lib/pdf/statement-pdf';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  currentTaxYearStartYear,
  customPeriod,
  getStatementData,
  taxYearPeriod,
  type StatementPeriod,
} from '@/lib/services/statement.service';

// pdfkit reads font metrics from the filesystem — must run on the Node runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/cleaner/statement?taxYear=2025   (UK tax year 6 Apr 2025 – 5 Apr 2026)
// GET /api/cleaner/statement?from=2025-04-06&to=2026-04-05
// Returns a PDF earnings statement for the AUTHENTICATED cleaner only.

function parseYMD(s: string | null, endOfDay = false): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const date = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  // A13: cleaner id ALWAYS from the session — never a request param (A15-class rule).
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // PDF generation is comparatively heavy — rate-limit per cleaner.
  const rl = checkRateLimit(`cleaner-statement:${user.id}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many statement downloads. Please try again later.' },
      {
        status: 429,
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();

  let period: StatementPeriod;
  const taxYearParam = searchParams.get('taxYear');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  if (taxYearParam) {
    const year = Number(taxYearParam);
    if (!Number.isInteger(year) || year < 2015 || year > now.getFullYear() + 1) {
      return NextResponse.json({ error: 'Invalid tax year.' }, { status: 400 });
    }
    period = taxYearPeriod(year);
  } else if (fromParam || toParam) {
    const from = parseYMD(fromParam);
    const to = parseYMD(toParam, true);
    if (!from || !to) {
      return NextResponse.json({ error: 'Invalid date range (use YYYY-MM-DD).' }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: 'Start date must be before end date.' }, { status: 400 });
    }
    period = customPeriod(from, to);
  } else {
    // Default: current UK tax year.
    period = taxYearPeriod(currentTaxYearStartYear(now));
  }

  const data = await getStatementData(user.id, period.from, period.to);

  let pdf: Buffer;
  try {
    pdf = await renderStatementPdf({
      cleanerName: user.name,
      period,
      data,
      generatedOn: now,
    });
  } catch {
    return NextResponse.json({ error: 'Could not generate the statement.' }, { status: 500 });
  }

  const fileLabel = (taxYearParam || `${fromParam ?? ''}_${toParam ?? ''}` || 'current').replace(
    /[^0-9A-Za-z_-]/g,
    ''
  );
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="rena-earnings-statement-${fileLabel}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
