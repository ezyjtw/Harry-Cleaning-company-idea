import Link from 'next/link';

import { prisma } from '@/lib/db/prisma';

import { HqCard, RoomShell, StatusDot } from '../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — Cleaners room: the roster at a glance (status, rating, services,
// net-first earnings summary, visibility flag). One tap deeper goes to the
// EXISTING admin dossier (/admin/cleaners/[id], F28) — linked, not rebuilt.

export default async function CleanersRoom() {
  const profiles = await prisma.cleanerProfile.findMany({
    where: { user: { isDeleted: false } },
    select: {
      userId: true,
      rating: true,
      serviceTypes: true,
      verified: true,
      visibleInDirectory: true,
      completedJobs: true,
      liveNotifiedAt: true,
      catchmentPolygon: true,
      user: { select: { name: true, email: true, accountStatus: true, isSuspended: true } },
    },
    orderBy: { rating: 'desc' },
  });

  // Net-first (settled ruling): the earnings figure shown is the cleaner's
  // NET (Booking.cleanerEarnings), summed over completed work.
  const earnings = await prisma.booking.groupBy({
    by: ['cleanerId'],
    where: { status: 'COMPLETED' },
    _sum: { cleanerEarnings: true },
    _count: { _all: true },
  });
  const earningsBy = new Map(
    earnings.map((e) => [
      e.cleanerId,
      { net: Number(e._sum.cleanerEarnings ?? 0), jobs: e._count._all },
    ])
  );

  return (
    <RoomShell
      title="Cleaners"
      subtitle="The roster. Tap a row for her full dossier (the existing admin pages)."
    >
      <HqCard className="overflow-x-auto p-2 sm:p-4">
        {profiles.length === 0 ? (
          <p className="p-4 text-sm font-light text-[#8A97AB]">No cleaner profiles yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E4E9F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                <th className="px-2 py-2">Cleaner</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Rating</th>
                <th className="px-2 py-2">Services</th>
                <th className="px-2 py-2">Net earned</th>
                <th className="px-2 py-2">Jobs</th>
                <th className="px-2 py-2">Visible</th>
                <th className="px-2 py-2">Map</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const e = earningsBy.get(p.userId);
                const status = p.user.isSuspended
                  ? { label: 'suspended', tone: 'red' as const }
                  : p.liveNotifiedAt
                    ? { label: 'live', tone: 'ok' as const }
                    : p.verified
                      ? { label: 'verified', tone: 'ok' as const }
                      : { label: 'onboarding', tone: 'amber' as const };
                return (
                  <tr key={p.userId} className="border-b border-[#F1F4F8] hover:bg-[#FAFBFC]">
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/admin/cleaners/${p.userId}`}
                        className="font-medium text-[#16296b] hover:underline"
                      >
                        {p.user.name ?? p.user.email}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-light text-[#3D5170]">
                        <StatusDot tone={status.tone} />
                        {status.label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-light text-[#3D5170]">
                      {p.rating ? `★ ${Number(p.rating).toFixed(2)}` : '—'}
                    </td>
                    <td className="max-w-[220px] truncate px-2 py-2.5 font-light text-[#3D5170]">
                      {p.serviceTypes.join(', ') || '—'}
                    </td>
                    <td className="px-2 py-2.5 font-light text-[#3D5170]">
                      {e ? `£${e.net.toFixed(2)}` : '£0.00'}
                    </td>
                    <td className="px-2 py-2.5 font-light text-[#3D5170]">{e?.jobs ?? 0}</td>
                    <td className="px-2 py-2.5 font-light text-[#3D5170]">
                      {p.visibleInDirectory ? 'yes' : 'hidden'}
                    </td>
                    <td className="px-2 py-2.5 font-light text-[#3D5170]">
                      {p.catchmentPolygon ? 'polygon' : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </HqCard>
    </RoomShell>
  );
}
