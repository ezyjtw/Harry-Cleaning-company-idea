import { SERVICE_AREAS } from '@/lib/areas';
import { prisma } from '@/lib/db/prisma';
import { API_PROVIDERS, AMBER_PCT_CONFIG_KEY, AMBER_PCT_DEFAULT } from '@/lib/hq/api-providers';
import { BOOKING_FUNNEL } from '@/lib/hq/funnel-stages';
import { COMPETITOR_BRANDS, placesConfigured } from '@/lib/hq/places.service';

import { DoorCard, StatusDot } from './HqKit';

export const dynamic = 'force-dynamic';

// R9 RENA HQ — the command screen. THE DRILL-DOWN LAW: every card is a door;
// the card is the glance, the tap is that section's full room. Seven rooms,
// no priority order. Dress: the approved grammar (navy on #FAFBFC, flat white
// hairline cards) via HqKit.

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getGlances() {
  const today = startOfToday();
  const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    apiToday,
    amberRow,
    polygonCount,
    rosterCount,
    avgRating,
    prospectsOpen,
    prospectsOverdue,
    funnelSessions7d,
    paid7d,
    competitorPlaceCount,
    lastObservation,
    declineRows,
    openContentReports,
    openMessageReports,
  ] = await Promise.all([
    prisma.apiCallLog.groupBy({
      by: ['provider'],
      where: { createdAt: { gte: today } },
      _count: { _all: true },
    }),
    prisma.platformConfig.findUnique({ where: { key: AMBER_PCT_CONFIG_KEY } }),
    prisma.cleanerProfile.count({ where: { catchmentPolygon: { not: { equals: null } } } }),
    prisma.cleanerProfile.count({ where: { user: { accountStatus: 'ACTIVE', isDeleted: false } } }),
    prisma.cleanerProfile.aggregate({ _avg: { rating: true } }),
    prisma.prospect.count({ where: { status: { not: 'joined' } } }),
    prisma.prospect.count({
      where: { status: { notIn: ['joined'] }, nextActionAt: { lt: new Date() } },
    }),
    prisma.analyticsEvent
      .findMany({
        where: { funnel: BOOKING_FUNNEL, createdAt: { gte: sevenDays } },
        select: { sessionId: true },
        distinct: ['sessionId'],
      })
      .then((r) => r.length),
    prisma.booking.count({
      where: { paymentStatus: 'SUCCEEDED', createdAt: { gte: sevenDays } },
    }),
    prisma.competitorPlace.count(),
    prisma.competitorObservation.findFirst({ orderBy: { observedAt: 'desc' } }),
    prisma.booking.findMany({
      where: { declineReasons: { not: { equals: null } } },
      select: { declineReasons: true },
    }),
    prisma.contentReport.count({ where: { status: 'OPEN' } }),
    prisma.messageReport.count({ where: { status: 'OPEN' } }),
  ]);

  // R9c glance: decline events in the window + the loudest reason.
  const reasonCounts = new Map<string, number>();
  let declines30d = 0;
  const declineSince = sevenDays.getTime() - 23 * 24 * 60 * 60 * 1000; // 30 days
  for (const b of declineRows) {
    const entries = Array.isArray(b.declineReasons)
      ? (b.declineReasons as Array<{ reason?: string; at?: string }>)
      : [];
    for (const e of entries) {
      const at = e?.at ? Date.parse(e.at) : NaN;
      if (Number.isNaN(at) || at < declineSince) continue;
      declines30d++;
      const r = typeof e?.reason === 'string' && e.reason ? e.reason : 'no reason';
      reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
    }
  }
  const topDeclineReason =
    Array.from(reasonCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0]
      ?.replace(/_/g, ' ') ?? null;

  const amberPct = amberRow ? parseInt(amberRow.value, 10) || AMBER_PCT_DEFAULT : AMBER_PCT_DEFAULT;
  const todayByProvider = new Map(apiToday.map((r) => [r.provider, r._count._all]));
  const apiCallsToday = apiToday.reduce((s, r) => s + r._count._all, 0);
  const ambersLit = API_PROVIDERS.filter((p) => {
    if (!p.limitPerDay) return false;
    const used = todayByProvider.get(p.key) ?? 0;
    return (used / p.limitPerDay) * 100 >= amberPct;
  }).length;

  return {
    apiCallsToday,
    ambersLit,
    amberPct,
    polygonCount,
    rosterCount,
    avgRating: avgRating._avg.rating ? Number(avgRating._avg.rating).toFixed(2) : '—',
    prospectsOpen,
    prospectsOverdue,
    funnelSessions7d,
    paid7d,
    competitorPlaceCount,
    lastObservedAt: lastObservation?.observedAt ?? null,
    placesLive: placesConfigured(),
    declines30d,
    topDeclineReason,
    openReports: openContentReports + openMessageReports,
  };
}

export default async function HqCommandScreen() {
  const g = await getGlances();
  const dateLine = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen bg-[#FAFBFC] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#16296b]">RENA HQ</p>
        <p className="mt-1 text-sm font-light text-[#3D5170]">{dateLine}</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DoorCard href="/admin/hq/api" title="API" glance={g.apiCallsToday.toLocaleString()}>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={g.ambersLit > 0 ? 'amber' : 'ok'} />
              {g.ambersLit > 0
                ? `${g.ambersLit} provider${g.ambersLit === 1 ? '' : 's'} past ${g.amberPct}% amber`
                : `calls today · all under ${g.amberPct}% amber`}
            </span>
          </DoorCard>

          <DoorCard href="/admin/hq/coverage" title="Coverage" glance={g.polygonCount}>
            live catchment polygon{g.polygonCount === 1 ? '' : 's'} on the map ·{' '}
            {SERVICE_AREAS.length} served areas
          </DoorCard>

          <DoorCard href="/admin/hq/cleaners" title="Cleaners" glance={g.rosterCount}>
            on the roster · average rating {g.avgRating}
          </DoorCard>

          <DoorCard href="/admin/hq/reachout" title="Reachout" glance={g.prospectsOpen}>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={g.prospectsOverdue > 0 ? 'red' : 'ok'} />
              open prospect{g.prospectsOpen === 1 ? '' : 's'}
              {g.prospectsOverdue > 0 && ` · ${g.prospectsOverdue} overdue`}
            </span>
          </DoorCard>

          <DoorCard href="/admin/hq/funnel" title="Funnel" glance={g.funnelSessions7d}>
            sessions entered (7 days) · {g.paid7d} paid
          </DoorCard>

          <DoorCard
            href="/admin/hq/areas"
            title="Area intel"
            glance={g.placesLive ? g.competitorPlaceCount : '—'}
          >
            {g.placesLive ? (
              <>competitor places tracked across {SERVICE_AREAS.length} areas</>
            ) : (
              <span className="inline-flex items-center gap-2">
                <StatusDot tone="idle" />
                dormant — set GOOGLE_PLACES_API_KEY to wake
              </span>
            )}
          </DoorCard>

          <DoorCard href="/admin/hq/declines" title="Declines" glance={g.declines30d}>
            {g.declines30d > 0 && g.topDeclineReason
              ? `declines (30 days) · mostly ${g.topDeclineReason}`
              : 'declines (30 days) · none recorded'}
          </DoorCard>

          <DoorCard href="/admin/hq/reports" title="Reports" glance={g.openReports}>
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={g.openReports > 0 ? 'red' : 'ok'} />
              {g.openReports > 0
                ? `open report${g.openReports === 1 ? '' : 's'} on reviews, chats and messages`
                : 'open reports · none waiting'}
            </span>
          </DoorCard>

          <DoorCard
            href="/admin/hq/competitors"
            title="Competitors"
            glance={COMPETITOR_BRANDS.length}
          >
            {g.placesLive && g.lastObservedAt ? (
              <>
                named competitors · last refresh{' '}
                {g.lastObservedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                <StatusDot tone="idle" />
                named competitors · refresh dormant until the key lands
              </span>
            )}
          </DoorCard>
        </div>
      </div>
    </div>
  );
}
