import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { API_PROVIDERS, AMBER_PCT_CONFIG_KEY, AMBER_PCT_DEFAULT } from '@/lib/hq/api-providers';

import { HqCard, HqLabel, MiniBars, RoomShell, UsageMeter } from '../../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — API room, per-provider page: 30-day daily series, per-endpoint
// breakdown, limit-vs-usage over time, the amber threshold, the next-tier
// pricing note, and the raw recent-calls tail.

const TAIL_LIMIT = 50;
const SERIES_DAYS = 30;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export default async function ApiProviderPage({ params }: { params: { provider: string } }) {
  const { provider } = params;
  const info = API_PROVIDERS.find((p) => p.key === provider);
  if (!info) notFound();

  const since = daysAgo(SERIES_DAYS - 1);
  const [amberRow, calls, tail] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { key: AMBER_PCT_CONFIG_KEY } }),
    prisma.apiCallLog.findMany({
      where: { provider, createdAt: { gte: since } },
      select: { endpoint: true, status: true, httpStatus: true, durationMs: true, createdAt: true },
    }),
    prisma.apiCallLog.findMany({
      where: { provider },
      orderBy: { createdAt: 'desc' },
      take: TAIL_LIMIT,
    }),
  ]);
  const amberPct = amberRow ? parseInt(amberRow.value, 10) || AMBER_PCT_DEFAULT : AMBER_PCT_DEFAULT;

  // Daily series + endpoint rollup in one pass.
  const dayKeys: string[] = [];
  for (let i = SERIES_DAYS - 1; i >= 0; i--) dayKeys.push(daysAgo(i).toISOString().slice(0, 10));
  const dayCounts = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  const endpoints = new Map<
    string,
    { calls: number; errors: number; totalMs: number; ms: number }
  >();
  for (const c of calls) {
    const k = c.createdAt.toISOString().slice(0, 10);
    if (dayCounts.has(k)) dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
    let e = endpoints.get(c.endpoint);
    if (!e) {
      e = { calls: 0, errors: 0, totalMs: 0, ms: 0 };
      endpoints.set(c.endpoint, e);
    }
    e.calls += 1;
    if (c.status === 'error') e.errors += 1;
    if (typeof c.durationMs === 'number') {
      e.totalMs += c.durationMs;
      e.ms += 1;
    }
  }
  const series = dayKeys.map((k) => dayCounts.get(k) ?? 0);
  const todayCount = series[series.length - 1];
  const maxDay = Math.max(...series);
  const endpointRows = Array.from(endpoints.entries()).sort((a, b) => b[1].calls - a[1].calls);

  return (
    <RoomShell title={info.label} backHref="/admin/hq/api" backLabel="API">
      <div className="space-y-4">
        <HqCard className="p-5">
          <HqLabel>Daily calls — last {SERIES_DAYS} days</HqLabel>
          <div className="mt-3">
            <MiniBars
              values={series}
              height={64}
              labels={{ first: `${SERIES_DAYS} days ago`, last: 'today' }}
            />
          </div>
          <p className="mt-2 text-sm font-light text-[#3D5170]">
            {todayCount.toLocaleString()} today · busiest day {maxDay.toLocaleString()} · total{' '}
            {calls.length.toLocaleString()} in {SERIES_DAYS} days
          </p>
        </HqCard>

        <HqCard className="p-5">
          <HqLabel>Limit vs usage</HqLabel>
          {info.limitPerDay ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1 text-xs font-light text-[#3D5170]">Today</p>
                <UsageMeter used={todayCount} limit={info.limitPerDay} amberPct={amberPct} />
              </div>
              <div>
                <p className="mb-1 text-xs font-light text-[#3D5170]">
                  Busiest day of the last {SERIES_DAYS}
                </p>
                <UsageMeter used={maxDay} limit={info.limitPerDay} amberPct={amberPct} />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm font-light text-[#3D5170]">{info.limitNote}</p>
          )}
          {info.limitPerDay && (
            <p className="mt-3 text-[11px] font-light text-[#8A97AB]">{info.limitNote}</p>
          )}
          <p className="mt-2 text-[11px] font-light text-[#3D5170]">
            <span className="font-semibold">Next tier:</span> {info.nextTierNote}
          </p>
          {info.caveat && (
            <p className="mt-2 text-[11px] font-light italic text-[#8A97AB]">{info.caveat}</p>
          )}
        </HqCard>

        <HqCard className="p-5">
          <HqLabel>Per-endpoint breakdown — last {SERIES_DAYS} days</HqLabel>
          {endpointRows.length === 0 ? (
            <p className="mt-2 text-sm font-light text-[#8A97AB]">No calls recorded yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#E4E9F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    <th className="py-2 pr-4">Endpoint</th>
                    <th className="py-2 pr-4">Calls</th>
                    <th className="py-2 pr-4">Errors</th>
                    <th className="py-2">Avg ms</th>
                  </tr>
                </thead>
                <tbody>
                  {endpointRows.map(([ep, e]) => (
                    <tr key={ep} className="border-b border-[#F1F4F8] font-light text-[#3D5170]">
                      <td className="py-2 pr-4 font-mono text-xs">{ep}</td>
                      <td className="py-2 pr-4">{e.calls.toLocaleString()}</td>
                      <td className={`py-2 pr-4 ${e.errors > 0 ? 'text-red-600' : ''}`}>
                        {e.errors}
                      </td>
                      <td className="py-2">{e.ms > 0 ? Math.round(e.totalMs / e.ms) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HqCard>

        <HqCard className="p-5">
          <HqLabel>Recent calls — raw tail (last {TAIL_LIMIT})</HqLabel>
          {tail.length === 0 ? (
            <p className="mt-2 text-sm font-light text-[#8A97AB]">Nothing yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E9F0] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    <th className="py-1.5 pr-3">When</th>
                    <th className="py-1.5 pr-3">Endpoint</th>
                    <th className="py-1.5 pr-3">Status</th>
                    <th className="py-1.5 pr-3">HTTP</th>
                    <th className="py-1.5">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {tail.map((c) => (
                    <tr key={c.id} className="border-b border-[#F1F4F8] font-light text-[#3D5170]">
                      <td className="whitespace-nowrap py-1.5 pr-3">
                        {c.createdAt.toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-1.5 pr-3 font-mono">{c.endpoint}</td>
                      <td
                        className={`py-1.5 pr-3 ${c.status === 'error' ? 'font-semibold text-red-600' : ''}`}
                      >
                        {c.status}
                      </td>
                      <td className="py-1.5 pr-3">{c.httpStatus ?? '—'}</td>
                      <td className="py-1.5">{c.durationMs ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </HqCard>
      </div>
    </RoomShell>
  );
}
