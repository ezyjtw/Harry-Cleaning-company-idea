import { SERVICE_AREAS } from '@/lib/areas';
import { prisma } from '@/lib/db/prisma';

import { HqCard, HqLabel, RoomShell } from '../HqKit';

export const dynamic = 'force-dynamic';

// R9c (James-ordered HQ follow-on lane): decline-reason readouts — totals per
// reason per area, in the HQ's grammar. Source of truth per the W5 spec:
// Booking.declineReasons ([{cleanerId, reason, at}]), stable vocabulary
// too_far | bad_time | pay_too_low | other; reasons are optional and the
// customer never sees them. INTELLIGENCE ONLY — no automatic behaviour is
// ever built on these (ruled). The other two specced W5 readouts (per-cleaner
// dossier breakdown, coverage-heatmap weighting) stay specced, not built.

const REASONS = ['too_far', 'bad_time', 'pay_too_low', 'other'] as const;
const REASON_LABELS: Record<string, string> = {
  too_far: 'Too far',
  bad_time: 'Bad time',
  pay_too_low: 'Pay too low',
  other: 'Other',
  no_reason: 'No reason given',
};
const ALL_KEYS = [...REASONS, 'no_reason'];
const WINDOW_DAYS = 30;

interface DeclineEntry {
  cleanerId?: string;
  reason?: string;
  at?: string;
}

function outwardCode(postcode: string | null | undefined): string | null {
  if (!postcode) return null;
  const m = postcode
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2}\d[A-Z\d]?)\s*\d[A-Z]{2}$/);
  return m ? m[1] : postcode.trim().toUpperCase().replace(/\s.*$/, '') || null;
}

export default async function DeclinesRoom() {
  const bookings = await prisma.booking.findMany({
    where: { declineReasons: { not: { equals: null } } },
    select: { declineReasons: true, addressPostcode: true },
  });

  const outcodeToArea = new Map(SERVICE_AREAS.map((a) => [a.outcode.toUpperCase(), a.name]));
  const areaNames = [...SERVICE_AREAS.map((a) => a.name), 'Outside served areas', 'Unknown'];

  // counts[area][reasonKey], twice: all-time and the 30-day window.
  const mk = () =>
    new Map<string, Map<string, number>>(areaNames.map((n) => [n, new Map<string, number>()]));
  const allTime = mk();
  const windowed = mk();
  const since = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let total = 0;

  for (const b of bookings) {
    const entries = Array.isArray(b.declineReasons) ? (b.declineReasons as DeclineEntry[]) : [];
    const oc = outwardCode(b.addressPostcode);
    const area = oc ? (outcodeToArea.get(oc) ?? 'Outside served areas') : 'Unknown';
    for (const e of entries) {
      const key =
        typeof e?.reason === 'string' && (REASONS as readonly string[]).includes(e.reason)
          ? e.reason
          : 'no_reason';
      total++;
      const bump = (m: Map<string, Map<string, number>>) => {
        const row = m.get(area) as Map<string, number>;
        row.set(key, (row.get(key) ?? 0) + 1);
      };
      bump(allTime);
      const at = e?.at ? Date.parse(e.at) : NaN;
      if (!Number.isNaN(at) && at >= since) bump(windowed);
    }
  }

  const rowTotal = (m: Map<string, Map<string, number>>, area: string) =>
    ALL_KEYS.reduce((s, k) => s + ((m.get(area) as Map<string, number>).get(k) ?? 0), 0);
  const colTotal = (m: Map<string, Map<string, number>>, key: string) =>
    areaNames.reduce((s, a) => s + ((m.get(a) as Map<string, number>).get(key) ?? 0), 0);

  const matrix = (m: Map<string, Map<string, number>>, label: string) => {
    const grand = areaNames.reduce((s, a) => s + rowTotal(m, a), 0);
    return (
      <HqCard className="p-5">
        <HqLabel>{label}</HqLabel>
        {grand === 0 ? (
          <p className="mt-2 text-sm font-light text-[#8A97AB]">No decline reasons recorded.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E4E9F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                  <th className="py-2 pr-3">Area</th>
                  {ALL_KEYS.map((k) => (
                    <th key={k} className="py-2 pr-3">
                      {REASON_LABELS[k]}
                    </th>
                  ))}
                  <th className="py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {areaNames
                  .filter((a) => rowTotal(m, a) > 0)
                  .map((a) => (
                    <tr key={a} className="border-b border-[#F1F4F8] font-light text-[#3D5170]">
                      <td className="py-2 pr-3 font-medium text-[#16296b]">{a}</td>
                      {ALL_KEYS.map((k) => {
                        const v = (m.get(a) as Map<string, number>).get(k) ?? 0;
                        return (
                          <td key={k} className={`py-2 pr-3 ${v === 0 ? 'text-[#C6CFDB]' : ''}`}>
                            {v}
                          </td>
                        );
                      })}
                      <td className="py-2 font-semibold text-[#16296b]">{rowTotal(m, a)}</td>
                    </tr>
                  ))}
                <tr className="font-light text-[#3D5170]">
                  <td className="py-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    Total
                  </td>
                  {ALL_KEYS.map((k) => (
                    <td key={k} className="py-2 pr-3 font-semibold text-[#16296b]">
                      {colTotal(m, k)}
                    </td>
                  ))}
                  <td className="py-2 font-semibold text-[#16296b]">{grand}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </HqCard>
    );
  };

  return (
    <RoomShell
      title="Declines"
      subtitle={`Why offers die, by area. ${total} decline${total === 1 ? '' : 's'} on record. Intelligence only — nothing automatic ever acts on these (ruled).`}
    >
      <div className="space-y-4">
        {matrix(windowed, `Last ${WINDOW_DAYS} days — per reason per area`)}
        {matrix(allTime, 'All time — per reason per area')}
        <p className="text-[11px] font-light italic text-[#8A97AB]">
          A decline without a reason still counts (the sheet makes reasons optional). Areas map from
          the booking address&apos;s outward code; the customer never sees any of this.
        </p>
      </div>
    </RoomShell>
  );
}
