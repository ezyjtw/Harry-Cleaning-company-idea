import { prisma } from '@/lib/db/prisma';

// A13: cleaner self-serve earnings statements (remittance for self-assessment).
// Figures are the cleaner's OWN business only — service price, Rena commission,
// net — and reconcile: servicePrice - commission = net. No customer-paid total.

export interface StatementRow {
  date: string; // completedAt (income date), YYYY-MM-DD
  service: string;
  servicePrice: number; // customerSubtotal (the cleaner's listed price)
  commission: number; // platformCommissionAmount (Rena's cut)
  net: number; // cleanerPayoutAmount ?? cleanerEarnings (actually received)
}

export interface StatementData {
  rows: StatementRow[];
  totals: { servicePrice: number; commission: number; net: number };
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
      platformCommissionAmount: true,
      cleanerPayoutAmount: true,
      // Legacy fallbacks (older bookings pre-date the A3/A4 fee fields).
      cleanerEarnings: true,
      platformFee: true,
    },
    orderBy: { completedAt: 'asc' },
  });

  const rows: StatementRow[] = bookings.map((b) => {
    // Net actually received.
    const net = round2(
      b.cleanerPayoutAmount !== null ? Number(b.cleanerPayoutAmount) : Number(b.cleanerEarnings)
    );
    // Rena commission.
    const commission = round2(
      b.platformCommissionAmount !== null
        ? Number(b.platformCommissionAmount)
        : Number(b.platformFee)
    );
    // Service price = the cleaner's listed price. Falls back to net + commission
    // so the row always reconciles (servicePrice - commission = net).
    const servicePrice = round2(
      b.customerSubtotal !== null ? Number(b.customerSubtotal) : net + commission
    );
    return {
      date: (b.completedAt ?? new Date(0)).toISOString().split('T')[0],
      service: b.serviceType,
      servicePrice,
      commission,
      net,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      servicePrice: round2(acc.servicePrice + r.servicePrice),
      commission: round2(acc.commission + r.commission),
      net: round2(acc.net + r.net),
    }),
    { servicePrice: 0, commission: 0, net: 0 }
  );

  return { rows, totals };
}
