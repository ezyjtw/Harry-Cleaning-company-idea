import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { log } from '@/lib/log';
import {
  callerLabel,
  claimSchedulerLease,
  releaseSchedulerLease,
} from '@/lib/services/scheduler-lease.service';
import { runScheduledJobs } from '@/lib/services/scheduler.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // SECURITY (A6): before this triggers money, require CRON_SECRET to be set
  // in production — fail closed if missing. For now, skip check when unset
  // so local dev can invoke without configuring a secret.
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured — refusing to run in production.' },
        { status: 500 }
      );
    }
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RENA-014: one effective run per tick. A second caller is refused while a
  // run is in progress (running lock) or within four minutes of the previous
  // start (cadence), and answered 200 with "skipped" so the second of the two
  // external triggers never doubles the money sweeps.
  const lease = await claimSchedulerLease(callerLabel(request.headers.get('user-agent')));
  if (!lease.claimed) {
    log.summary(
      'Scheduler',
      {
        reason: lease.reason,
        lockedUntil: lease.lockedUntil,
        lastStartedAt: lease.lastStartedAt,
      },
      'skipped: lease held'
    );
    return NextResponse.json({
      skipped: 'lease held',
      reason: lease.reason,
      lockedUntil: lease.lockedUntil,
      lastStartedAt: lease.lastStartedAt,
    });
  }

  try {
    const summary = await runScheduledJobs();

    log.summary('Scheduler', summary);

    // B7.3 gate fix: a compliance job that failed on the day's last attempt
    // is a failed run for the heartbeat, every tick until a clean run.
    const failedJobs = summary.compliance?.failed ?? [];
    if (failedJobs.length > 0) {
      await releaseSchedulerLease({
        summary,
        error: new Error(`compliance jobs failed: ${failedJobs.join(', ')}`),
      });
    } else {
      await releaseSchedulerLease({ summary });
    }
    return NextResponse.json(summary);
  } catch (error) {
    log.error('scheduler', 'fatal_error', {}, error);
    const message = error instanceof Error ? error.message : 'Scheduler failed';
    await releaseSchedulerLease({ error }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
