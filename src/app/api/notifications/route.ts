import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';

// F10: the single read API for every notification surface — the web bell, the
// /notifications history page, and the future native /app/inbox (same envelope,
// same read semantics).
//   GET /api/notifications?limit=20&unreadOnly=1&countOnly=1
//   → { notifications: [...], unreadCount }
// countOnly skips the list query — the bell's badge poll uses it (cheap).
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 100);
    const unreadOnly = searchParams.get('unreadOnly') === '1';
    const countOnly = searchParams.get('countOnly') === '1';

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, read: false },
    });

    if (countOnly) {
      return NextResponse.json({ notifications: [], unreadCount });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
