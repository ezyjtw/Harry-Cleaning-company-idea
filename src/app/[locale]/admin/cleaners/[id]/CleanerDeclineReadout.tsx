import { SERVICE_AREAS } from '@/lib/areas';
import { prisma } from '@/lib/db/prisma';

// R10 Lane 3 (James-ordered): her decline pattern on the dossier — reason
// totals + recent declines with dates and areas. HQ grammar, INTELLIGENCE
// ONLY: nothing automatic ever acts on these (ruled), and the customer never
// sees them anywhere. Server-rendered section appended below the dossier.

const REASON_LABELS: Record<string, string> = {
  too_far: 'Too far',
  bad_time: 'Bad time',
  pay_too_low: 'Pay too low',
  other: 'Other',
  no_reason: 'No reason given',
};

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

export default async function CleanerDeclineReadout({ userId }: { userId: string }) {
  const bookings = await prisma.booking.findMany({
    where: { declineReasons: { not: { equals: null } } },
    select: { id: true, addressPostcode: true, declineReasons: true },
  });

  const outcodeToArea = new Map(SERVICE_AREAS.map((a) => [a.outcode.toUpperCase(), a.name]));
  const totals = new Map<string, number>();
  const recent: Array<{ at: Date | null; reason: string; area: string }> = [];

  for (const b of bookings) {
    const entries = Array.isArray(b.declineReasons) ? (b.declineReasons as DeclineEntry[]) : [];
    for (const e of entries) {
      if (e?.cleanerId !== userId) continue;
      const key =
        typeof e.reason === 'string' && e.reason && REASON_LABELS[e.reason]
          ? e.reason
          : 'no_reason';
      totals.set(key, (totals.get(key) ?? 0) + 1);
      const oc = outwardCode(b.addressPostcode);
      recent.push({
        at: e.at ? new Date(e.at) : null,
        reason: key,
        area: oc ? (outcodeToArea.get(oc) ?? `Outside served areas (${oc})`) : 'Unknown area',
      });
    }
  }
  recent.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  const total = recent.length;

  return (
    <div className="mx-auto max-w-5xl p-4 pt-0 sm:p-6 sm:pt-0 lg:p-8 lg:pt-0">
      <section className="rounded-2xl border border-[#E4E9F0] bg-white p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#8A97AB]">
          Decline pattern — intelligence only, never customer-visible
        </p>
        {total === 0 ? (
          <p className="mt-2 text-sm font-light text-[#3D5170]">
            No declines on record for this cleaner.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(REASON_LABELS).map(([key, label]) => {
                const n = totals.get(key) ?? 0;
                if (n === 0) return null;
                return (
                  <span
                    key={key}
                    className="rounded-full border border-[#E4E9F0] px-3 py-1 text-xs font-light text-[#3D5170]"
                  >
                    {label} <span className="font-semibold text-[#16296b]">{n}</span>
                  </span>
                );
              })}
              <span className="rounded-full bg-[#16296b] px-3 py-1 text-xs font-semibold text-white">
                {total} total
              </span>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E4E9F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2">Area</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-[#F1F4F8] font-light text-[#3D5170]">
                      <td className="py-2 pr-4">
                        {r.at
                          ? r.at.toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'undated'}
                      </td>
                      <td className="py-2 pr-4">{REASON_LABELS[r.reason]}</td>
                      <td className="py-2">{r.area}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > 10 && (
                <p className="mt-2 text-[11px] font-light text-[#8A97AB]">
                  Showing the 10 most recent of {total}.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
