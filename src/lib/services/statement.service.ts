import { prisma } from '@/lib/db/prisma';
import { cleanerEarningsBreakdown } from '@/lib/services/pricing.service';

// A13 + LR-2 (James-ruled): cleaner self-serve earnings statements. Figures
// are the cleaner's OWN business only — "Your rate £X · Rena commission (N%)
// −£Y · You received £Z" (+ supplies £4.50 when the products add-on rode).
// Rows ride cleanerEarningsBreakdown: the reconcile-or-withhold law stands —
// a row whose stored numbers don't reconcile to the penny (promo-adjusted
// commission, admin price adjustment, legacy shape) shows the labelled net
// ONLY, never arithmetic that doesn't add up. No customer-paid figure exists
// anywhere in this pipeline.

export interface StatementRow {
  date: string; // completedAt (income date), YYYY-MM-DD
  service: string;
  /** null = breakdown withheld (non-reconciling row) — render the net only. */
  rate: number | null;
  feePct: number | null;
  fee: number | null;
  /** +£4.50 when the products add-on rode; 0 otherwise. */
  suppliesNet: number;
  net: number; // cleanerPayoutAmount ?? cleanerEarnings (actually received)
}

export interface StatementData {
  rows: StatementRow[];
  totals: { rate: number; fee: number; net: number };
  /** True when any row withheld its breakdown — the PDF footnotes it. */
  hasWithheldRows: boolean;
}

export interface StatementPeriod {
  from: Date;
  to: Date;
  label: string; // e.g. "6 Apr 2025 – 5 Apr 2026 (Tax year 2025/26)"
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── UK tax year (6 Apr – 5 Apr) ────────────────────────────────────────────

/** The tax-year START year that `date` falls in (e.g. 2 May 2026 → 2026; 1 Mar 2026 → 2025). */
export function currentTaxYearStartYear(date: Date): number {
  const year = date.getFullYear();
  // Tax year starts 6 April. Before 6 April → previous start year.
  const sixthApril = new Date(year, 3, 6); // month 3 = April
  return date < sixthApril ? year - 1 : year;
}

export function taxYearBounds(startYear: number): { from: Date; to: Date } {
  const from = new Date(startYear, 3, 6, 0, 0, 0, 0); // 6 Apr startYear
  const to = new Date(startYear + 1, 3, 5, 23, 59, 59, 999); // 5 Apr startYear+1
  return { from, to };
}

export function taxYearLabel(startYear: number): string {
  const end = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${end}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function taxYearPeriod(startYear: number): StatementPeriod {
  const { from, to } = taxYearBounds(startYear);
  return {
    from,
    to,
    label: `${fmtDate(from)} – ${fmtDate(to)} (Tax year ${taxYearLabel(startYear)})`,
  };
}

export function customPeriod(from: Date, to: Date): StatementPeriod {
  return { from, to, label: `${fmtDate(from)} – ${fmtDate(to)}` };
}

// ─── Statement data ─────────────────────────────────────────────────────────

/**
 * Build a statement for ONE cleaner over a period. Counts only RELEASED jobs
 * (money actually transferred to the cleaner), by completion date. `cleanerId`
 * MUST come from the authenticated session — never a request param.
 */
export async function getStatementData(
  cleanerId: string,
  from: Date,
  to: Date
): Promise<StatementData> {
  const bookings = await prisma.booking.findMany({
    where: {
      cleanerId,
      transferStatus: 'RELEASED', // paid out to the cleaner (escrow released)
      completedAt: { gte: from, lte: to },
    },
    select: {
      serviceType: true,
      completedAt: true,
      customerSubtotal: true,
      cleanerPayoutAmount: true,
      cleanerEarnings: true,
      extras: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const rows: StatementRow[] = bookings.map((b) => {
    // Net actually received — always shown, always the stored payout figure.
    const net = round2(
      b.cleanerPayoutAmount !== null ? Number(b.cleanerPayoutAmount) : Number(b.cleanerEarnings)
    );
    // LR-2: the same helper every surface trusts — identity checked to the
    // penny, withheld (nulls) when the stored numbers don't reconcile.
    const bd = cleanerEarningsBreakdown({
      serviceType: b.serviceType,
      customerSubtotal: b.customerSubtotal,
      cleanerEarnings: net,
      extras: b.extras,
    });
    return {
      date: (b.completedAt ?? new Date(0)).toISOString().split('T')[0],
      service: b.serviceType,
      rate: bd ? bd.rate : null,
      feePct: bd ? bd.feePct : null,
      fee: bd ? bd.fee : null,
      suppliesNet: bd ? bd.productsNet : 0,
      net,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      rate: round2(acc.rate + (r.rate ?? 0)),
      fee: round2(acc.fee + (r.fee ?? 0)),
      net: round2(acc.net + r.net),
    }),
    { rate: 0, fee: 0, net: 0 }
  );

  return { rows, totals, hasWithheldRows: rows.some((r) => r.rate === null) };
}
