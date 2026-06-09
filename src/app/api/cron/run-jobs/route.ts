import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { runScheduledJobs } from '@/lib/services/scheduler.service';

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

  try {
    const summary = await runScheduledJobs();

    // eslint-disable-next-line no-console
    console.log('[Scheduler]', JSON.stringify(summary));

    return NextResponse.json(summary);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Scheduler] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scheduler failed' },
      { status: 500 }
    );
  }
}
