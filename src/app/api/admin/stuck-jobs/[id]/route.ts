import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  askCustomer,
  cancelRefund,
  forceComplete,
  resolveNoRefund,
} from '@/lib/services/stuck-jobs.service';

// Stuck-money reaper — the admin action door. `ask` moves no money;
// `force-complete` and `cancel-refund` are THE two money buttons, both
// service-guarded (5-day arming, customer-NO block, state compare-and-swap)
// so the guard never lives only in the UI.
const ACTIONS = ['ask', 'force-complete', 'cancel-refund', 'resolve-no-refund'] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const rl = checkRateLimit(`admin-stuck-jobs:${admin.id}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many actions.' }, { status: 429 });
  }

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const action = body?.action as Action;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    const result =
      action === 'ask'
        ? await askCustomer(id, admin.id)
        : action === 'force-complete'
          ? await forceComplete(id, admin.id)
          : action === 'cancel-refund'
            ? await cancelRefund(id, admin.id)
            : await resolveNoRefund(id, admin.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminStuckJobs] Action failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
