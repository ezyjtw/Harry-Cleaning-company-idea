import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { acceptOfferAsCleaner } from '@/lib/booking/accept-offer';
import { mapBusy } from '@/lib/http/busy';

type RouteContext = { params: Promise<{ id: string }> };

// B3 gate: a cleaner-lock wait past the transaction budget answers 503 BUSY.
export const POST = mapBusy(async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const result = await acceptOfferAsCleaner(id, user.id);
  return NextResponse.json(result.body, { status: result.status });
});
