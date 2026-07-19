import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/rate-limit';
import { AdminOperationsService } from '@/lib/services/admin-operations.service';

// H24: thin exposure of the EXISTING moderation machinery
// (AdminOperationsService.moderateReview — visibility flip + stored-rating
// recompute + audit). The service existed with no route; the cleaner-first
// reviews dossier needed hide/unhide/flag actions on native reviews.
const ACTIONS = ['VISIBLE', 'HIDDEN', 'FLAGGED'] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const rl = checkRateLimit(`admin-review-moderate:${admin.id}`, 60, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many moderation actions.' }, { status: 429 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as Action;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `action must be one of: ${ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    await AdminOperationsService.moderateReview(id, action, admin.id);
    return NextResponse.json({ id, visibility: action });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminReviewModerate] Failed:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
