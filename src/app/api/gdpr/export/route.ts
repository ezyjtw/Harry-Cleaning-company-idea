import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { GdprService } from '@/lib/services/gdpr.service';

// ─── GET /api/gdpr/export?userId=xxx ─── Export user data ──

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
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
