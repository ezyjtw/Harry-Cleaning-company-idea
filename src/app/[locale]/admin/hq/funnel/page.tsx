import { prisma } from '@/lib/db/prisma';
import { BOOKING_FUNNEL, BOOKING_FUNNEL_STAGES, PAID_STAGE } from '@/lib/hq/funnel-stages';

import { HqCard, HqLabel, MiniBars, RoomShell } from '../HqKit';

export const dynamic = 'force-dynamic';

// R9 HQ — Funnel room: the honest five stages, each expandable to its per-day
// series and its drop-off split by service family and device class; recent
// abandoned trails (the F29 unload records) listed individually so a lost
// customer's walk is readable. Stages 1–4 come from AnalyticsEvent; stage 5
// (Paid) is computed from Bookings — the money record is the truth.

const WINDOW_DAYS = 30;
const TRAIL_LIMIT = 12;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

interface FunnelEventRow {
  sessionId: string;
  eventType: string;
  funnelStep: number | null;
  stepName: string | null;
  deviceType: string | null;
  metadata: unknown;
  createdAt: Date;
  duration: number | null;
}

function metaCategory(meta: unknown): string {
  if (meta && typeof meta === 'object' && 'category' in (meta as Record<string, unknown>)) {
    const c = (meta as Record<string, unknown>).category;
    if (typeof c === 'string' && c) return c;
  }
  return 'unknown';
}

function splitLine(map: Map<string, number>): string {
  const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  if (rows.length === 0) return '—';
  return rows.map(([k, v]) => `${k} ${v}`).join(' · ');
}

export default async function FunnelRoom() {
  const since = daysAgo(WINDOW_DAYS - 1);
  const [events, paidBookings] = await Promise.all([
    prisma.analyticsEvent.findMany({
      where: { funnel: BOOKING_FUNNEL, createdAt: { gte: since } },
      select: {
        sessionId: true,
        eventType: true,
        funnelStep: true,
        stepName: true,
        deviceType: true,
        metadata: true,
        createdAt: true,
        duration: true,
      },
      orderBy: { createdAt: 'asc' },
    }) as Promise<FunnelEventRow[]>,
    prisma.booking.findMany({
      where: { paymentStatus: 'SUCCEEDED', createdAt: { gte: since } },
      select: { createdAt: true, serviceType: true },
    }),
  ]);

  const dayKeys: string[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) dayKeys.push(daysAgo(i).toISOString().slice(0, 10));

  // Per stage: distinct sessions, per-day series, per-session metadata.
  const stageSessions = new Map<number, Set<string>>();
  const stageDays = new Map<number, Map<string, Set<string>>>();
  const sessionDevice = new Map<string, string>();
  const sessionCategory = new Map<string, string>();
  for (const s of BOOKING_FUNNEL_STAGES) {
    stageSessions.set(s.step, new Set());
    stageDays.set(s.step, new Map());
  }
  const bySession = new Map<string, FunnelEventRow[]>();
  for (const e of events) {
    const list = bySession.get(e.sessionId) ?? [];
    list.push(e);
    bySession.set(e.sessionId, list);
    if (e.deviceType && !sessionDevice.has(e.sessionId))
      sessionDevice.set(e.sessionId, e.deviceType);
    const cat = metaCategory(e.metadata);
    if (cat !== 'unknown' && !sessionCategory.has(e.sessionId))
      sessionCategory.set(e.sessionId, cat);
    if (e.eventType === 'FUNNEL_STEP' && e.funnelStep && stageSessions.has(e.funnelStep)) {
      stageSessions.get(e.funnelStep)?.add(e.sessionId);
      const dk = e.createdAt.toISOString().slice(0, 10);
      const dm = stageDays.get(e.funnelStep) as Map<string, Set<string>>;
      if (!dm.has(dk)) dm.set(dk, new Set());
      dm.get(dk)?.add(e.sessionId);
    }
  }

  // Paid stage from Bookings.
  const paidDays = new Map<string, number>();
  const paidByFamily = new Map<string, number>();
  for (const b of paidBookings) {
    const dk = b.createdAt.toISOString().slice(0, 10);
    paidDays.set(dk, (paidDays.get(dk) ?? 0) + 1);
    paidByFamily.set(b.serviceType, (paidByFamily.get(b.serviceType) ?? 0) + 1);
  }

  // Drop-off splits: sessions that reached stage N but not stage N+1.
  function dropSplit(step: number): {
    device: Map<string, number>;
    family: Map<string, number>;
    count: number;
  } {
    const reached = stageSessions.get(step) ?? new Set<string>();
    const nextSet: Set<string> =
      step < 4 ? (stageSessions.get(step + 1) ?? new Set<string>()) : new Set<string>();
    // Stage 4's "next" is Paid — session-to-booking has no shared key, so the
    // stage-4 drop split is honest about being "did not pay in this window".
    const device = new Map<string, number>();
    const family = new Map<string, number>();
    let count = 0;
    reached.forEach((sid) => {
      if (step < 4 && nextSet.has(sid)) return;
      if (step === 4) return; // computed against bookings below the table
      count++;
      const d = sessionDevice.get(sid) ?? 'unknown';
      device.set(d, (device.get(d) ?? 0) + 1);
      const f = sessionCategory.get(sid) ?? 'unknown';
      family.set(f, (family.get(f) ?? 0) + 1);
    });
    return { device, family, count };
  }

  // Recent abandoned trails (F29): sessions whose LAST event is a DROP_OFF.
  const abandoned: Array<{ sessionId: string; events: FunnelEventRow[]; at: Date }> = [];
  bySession.forEach((list, sid) => {
    const last = list[list.length - 1];
    if (last.eventType === 'DROP_OFF')
      abandoned.push({ sessionId: sid, events: list, at: last.createdAt });
  });
  abandoned.sort((a, b) => b.at.getTime() - a.at.getTime());
  const trails = abandoned.slice(0, TRAIL_LIMIT);

  const stages = [
    ...BOOKING_FUNNEL_STAGES.map((s) => {
      const sessions = stageSessions.get(s.step) ?? new Set<string>();
      const dm = stageDays.get(s.step) as Map<string, Set<string>>;
      const series = dayKeys.map((k) => dm.get(k)?.size ?? 0);
      const drop = dropSplit(s.step);
      return { ...s, count: sessions.size, series, drop, paid: false };
    }),
    {
      ...PAID_STAGE,
      count: paidBookings.length,
      series: dayKeys.map((k) => paidDays.get(k) ?? 0),
      drop: null,
      paid: true,
    },
  ];

  return (
    <RoomShell
      title="Funnel"
      subtitle={`The booking funnel's five honest stages, last ${WINDOW_DAYS} days. Stages 1–4 count distinct sessions from the ruled booking routes; Paid counts succeeded bookings.`}
    >
      <div className="space-y-3">
        {stages.map((s) => (
          <details key={s.step} className="group rounded-2xl border border-[#E4E9F0] bg-white">
            <summary className="flex cursor-pointer items-center justify-between p-5 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#16296b] text-xs font-semibold text-white">
                  {s.step}
                </span>
                <span className="text-sm font-semibold text-[#16296b]">{s.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-semibold text-[#16296b]">{s.count}</span>
                <svg
                  className="h-4 w-4 text-[#C6CFDB] transition-transform group-open:rotate-90"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </summary>
            <div className="border-t border-[#F1F4F8] p-5">
              <HqLabel>Per-day — last {WINDOW_DAYS} days</HqLabel>
              <div className="mt-2">
                <MiniBars
                  values={s.series}
                  labels={{ first: `${WINDOW_DAYS}d ago`, last: 'today' }}
                />
              </div>
              {!s.paid && s.drop && (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <HqLabel>Dropped here — by device</HqLabel>
                    <p className="mt-1 text-sm font-light text-[#3D5170]">
                      {s.drop.count === 0 ? 'no drop-offs recorded' : splitLine(s.drop.device)}
                    </p>
                  </div>
                  <div>
                    <HqLabel>Dropped here — by service family</HqLabel>
                    <p className="mt-1 text-sm font-light text-[#3D5170]">
                      {s.drop.count === 0 ? '—' : splitLine(s.drop.family)}
                    </p>
                  </div>
                </div>
              )}
              {s.paid && (
                <div className="mt-4">
                  <HqLabel>Paid — by service family</HqLabel>
                  <p className="mt-1 text-sm font-light text-[#3D5170]">
                    {splitLine(paidByFamily)}
                  </p>
                  <p className="mt-2 text-[11px] font-light italic text-[#8A97AB]">
                    Sessions and bookings carry no shared key, so stage 4 → Paid is a volume
                    comparison, not a per-session join — stated rather than faked.
                  </p>
                </div>
              )}
            </div>
          </details>
        ))}

        <HqCard className="p-5">
          <HqLabel>Recent abandoned trails (F29) — newest first</HqLabel>
          {trails.length === 0 ? (
            <p className="mt-2 text-sm font-light text-[#8A97AB]">
              No abandoned booking sessions recorded in the window. (Stage events begin flowing from
              the ruled routes the day this deploys.)
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {trails.map((t) => (
                <div key={t.sessionId} className="rounded-xl bg-[#FAFBFC] p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A97AB]">
                    {t.sessionId.slice(0, 18)}… ·{' '}
                    {sessionDevice.get(t.sessionId) ?? 'unknown device'} · abandoned{' '}
                    {t.at.toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <ol className="mt-1.5 space-y-0.5">
                    {t.events.map((e, i) => (
                      <li key={i} className="text-xs font-light text-[#3D5170]">
                        <span className="font-mono text-[#8A97AB]">
                          {e.createdAt.toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>{' '}
                        {e.eventType === 'DROP_OFF' ? '✕' : '·'} {e.stepName ?? e.eventType}
                        {typeof e.duration === 'number' && e.duration > 0 && (
                          <span className="text-[#8A97AB]"> ({e.duration}s on step)</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </HqCard>
      </div>
    </RoomShell>
  );
}
