import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getCleanerSession } from '@/lib/auth/session';
import { handleDecline } from '@/lib/services/cascade.service';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getCleanerSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await handleDecline(id, user.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 });
  }

  return NextResponse.json({ message: result.message });
}
