import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';

// LR-1 (James-ruled): account holders withdraw their own PENDING arrangement
// request. Strictly the owning customer; the atomic claim in the service
// resolves a race with the cleaner's accept to whichever lands first.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { withdrawArrangement } = await import('@/lib/services/arrangement.service');
  const result = await withdrawArrangement(id, user.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ success: true });
}
