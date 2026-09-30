import Link from 'next/link';

import { prisma } from '@/lib/db/prisma';
import { API_PROVIDERS, AMBER_PCT_CONFIG_KEY, AMBER_PCT_DEFAULT } from '@/lib/hq/api-providers';

import { HqCard, MiniBars, RoomShell, StatusDot, UsageMeter } from '../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — API room (the corridor): one card per provider, each a door to its
// per-provider page. Glance: today's calls, 7-day series, limit-vs-usage with
// the amber threshold where a documented daily limit exists.

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

export default async function ApiRoom() {
  const [amberRow, rows] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { key: AMBER_PCT_CONFIG_KEY } }),
    prisma.apiCallLog.findMany({
      where: { createdAt: { gte: daysAgo(6) } },
      select: { provider: true, status: true, createdAt: true },
    }),
  ]);
  const amberPct = amberRow ? parseInt(amberRow.value, 10) || AMBER_PCT_DEFAULT : AMBER_PCT_DEFAULT;

  // Bucket the 7 days per provider in one pass.
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) dayKeys.push(daysAgo(i).toISOString().slice(0, 10));
  const byProvider = new Map<
    string,
    { days: Map<string, number>; today: number; errors: number }
  >();
  const todayKey = dayKeys[dayKeys.length - 1];
  for (const r of rows) {
    const key = r.createdAt.toISOString().slice(0, 10);
    let p = byProvider.get(r.provider);
    if (!p) {
      p = { days: new Map(), today: 0, errors: 0 };
      byProvider.set(r.provider, p);
    }
    p.days.set(key, (p.days.get(key) ?? 0) + 1);
    if (key === todayKey) p.today += 1;
    if (r.status === 'error') p.errors += 1;
  }

  return (
    <RoomShell
      title="API"
      subtitle={`Outbound calls, counted at each provider's single choke point. Amber at ${amberPct}% of a documented limit (edit via PlatformConfig hq_api_amber_pct).`}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {API_PROVIDERS.map((p) => {
          const d = byProvider.get(p.key);
          const series = dayKeys.map((k) => d?.days.get(k) ?? 0);
          const today = d?.today ?? 0;
          return (
            <Link key={p.key} href={`/admin/hq/api/${p.key}`} className="group block">
              <HqCard className="p-5 transition-colors group-hover:border-[#16296b]/40">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#16296b]">{p.label}</p>
                  <div className="flex items-center gap-2">
                    {p.dormant && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                        dormant
                      </span>
                    )}
                    <StatusDot
                      tone={
                        p.limitPerDay && (today / p.limitPerDay) * 100 >= amberPct
                          ? 'amber'
                          : d
                            ? 'ok'
                            : 'idle'
                      }
                    />
                  </div>
                </div>
                <p className="mt-2 text-2xl font-semibold text-[#16296b]">
                  {today.toLocaleString()}
                  <span className="ml-1 text-xs font-light text-[#8A97AB]">calls today</span>
                </p>
                <div className="mt-3">
                  <MiniBars values={series} labels={{ first: '7 days ago', last: 'today' }} />
                </div>
                {p.limitPerDay && (
                  <div className="mt-3">
                    <UsageMeter used={today} limit={p.limitPerDay} amberPct={amberPct} />
                  </div>
                )}
                {(d?.errors ?? 0) > 0 && (
                  <p className="mt-2 text-[11px] font-light text-red-600">
                    {d?.errors} error{d?.errors === 1 ? '' : 's'} in 7 days
                  </p>
                )}
                {p.caveat && (
                  <p className="mt-2 text-[11px] font-light italic text-[#8A97AB]">{p.caveat}</p>
                )}
              </HqCard>
            </Link>
          );
        })}
      </div>
    </RoomShell>
  );
}
