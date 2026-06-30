import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { GdprService } from '@/lib/services/gdpr.service';

// ─── GET /api/gdpr/export?userId=xxx ─── Export user data ──

export async function GET(request: NextRequest) {
  try {
    // SECURITY: a user may only export their OWN data; admins may export anyone's.
    const requester = await getSessionUser();
    if (!requester) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const userId = requestedUserId ?? requester.id;

    if (userId !== requester.id && requester.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const data = await GdprService.exportUserData(userId);

    return NextResponse.json({
      success: true,
      data,
      notice:
        'This export contains all personal data we hold about you, in compliance with GDPR Article 20.',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GDPR] Data export error:', error);
    return NextResponse.json({ error: 'Failed to export user data' }, { status: 500 });
  }
}
