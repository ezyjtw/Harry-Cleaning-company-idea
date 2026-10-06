import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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

  // RENA-014: one effective run per tick. A second caller inside the lease
  // window (today: the second of the two external triggers) is answered 200
  // with "skipped" so it never doubles the money sweeps.
  const lease = await claimSchedulerLease(callerLabel(request.headers.get('user-agent')));
  if (!lease.claimed) {
    // eslint-disable-next-line no-console
    console.log(
      '[Scheduler] skipped: lease held',
      JSON.stringify({ lockedAt: lease.lockedAt, lastStartedAt: lease.lastStartedAt })
    );
    return NextResponse.json({
      skipped: 'lease held',
      lockedAt: lease.lockedAt,
      lastStartedAt: lease.lastStartedAt,
    });
  }

  try {
    const summary = await runScheduledJobs();

    // eslint-disable-next-line no-console
    console.log('[Scheduler]', JSON.stringify(summary));

    await releaseSchedulerLease({ summary });
    return NextResponse.json(summary);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Scheduler] Fatal error:', error);
    const message = error instanceof Error ? error.message : 'Scheduler failed';
    await releaseSchedulerLease({ error: message }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
