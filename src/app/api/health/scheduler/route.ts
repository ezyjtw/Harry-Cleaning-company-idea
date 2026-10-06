import { NextResponse } from 'next/server';

import { getSchedulerHeartbeat } from '@/lib/services/scheduler-lease.service';

// RENA-014 (remediation register, B0): scheduler heartbeat for the external
// uptime monitor. 200 while the last completed run is within STALE_AFTER_MS
// (fifteen minutes, three missed ticks), 503 once it is older or has never
// happened. Separate from /api/health's database probe so a dead scheduler
// cannot fail a deploy cutover and a database blip cannot mask a dead
// scheduler. force-dynamic for the same reason as /api/health: a static
// route handler would be prerendered and answer a frozen body forever.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const heartbeat = await getSchedulerHeartbeat();
    return NextResponse.json(heartbeat, {
      status: heartbeat.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      { status: 'stale', error: 'heartbeat unreadable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
