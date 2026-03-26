import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { RightToWorkService } from '@/lib/services/right-to-work.service';

/**
 * GET /api/admin/rtw — Get RTW expiry alerts and status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'expiring';
  const days = parseInt(searchParams.get('days') || '30', 10);

  try {
    if (action === 'expired') {
      const expired = await RightToWorkService.getExpiredDocuments();
      return NextResponse.json({
        expired: expired.map((p) => ({
          profileId: p.id,
          userId: p.userId,
          cleanerName: p.user.name,
          email: p.user.email,
          docType: p.rightToWorkDocType,
          expiresAt: p.rightToWorkExpiresAt,
        })),
        count: expired.length,
      });
    }

    const expiring = await RightToWorkService.getExpiringDocuments(days);
    return NextResponse.json({ expiring, count: expiring.length, withinDays: days });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminRTW] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch RTW data' }, { status: 500 });
  }
}

/**
 * POST /api/admin/rtw — Verify a share code or send expiry alerts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'verify_share_code') {
      const { shareCode, dateOfBirth, adminId } = body;

      if (!shareCode || !dateOfBirth || !adminId) {
        return NextResponse.json(
          { error: 'shareCode, dateOfBirth, and adminId are required' },
          { status: 400 }
        );
      }

      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

      const result = await RightToWorkService.verifyShareCode(
        shareCode,
        dateOfBirth,
        adminId,
        ipAddress || undefined
      );

      return NextResponse.json({ result });
    }

    if (action === 'send_expiry_alerts') {
      const { adminId, days } = body;

      if (!adminId) {
        return NextResponse.json({ error: 'adminId is required' }, { status: 400 });
      }

      const alerts = await RightToWorkService.getExpiringDocuments(days || 30);
      const sent = await RightToWorkService.sendExpiryAlerts(alerts, adminId);

      return NextResponse.json({ message: `Sent ${sent} expiry alerts`, alertsSent: sent });
    }

    if (action === 'suspend_expired') {
      const { profileId, adminId } = body;

      if (!profileId || !adminId) {
        return NextResponse.json({ error: 'profileId and adminId are required' }, { status: 400 });
      }

      await RightToWorkService.suspendExpiredRtw(profileId, adminId);
      return NextResponse.json({ message: 'Cleaner suspended due to expired RTW' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[AdminRTW] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process RTW action' },
      { status: 500 }
    );
  }
}
