import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { RightToWorkService } from '@/lib/services/right-to-work.service';

/**
 * GET /api/cron/rtw-expiry — Background job to check RTW expiry and take action
 *
 * Should be called periodically (e.g. daily via Railway cron, Vercel cron, or external scheduler).
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * Actions:
 * 1. Send alerts to cleaners with RTW expiring within 30 days
 * 2. Suspend cleaners with expired RTW documents
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access.
  // SECURITY: fail CLOSED — in production a missing CRON_SECRET must deny all
  // callers, never skip the check (an unset secret previously left this open).
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = {
      alertsSent: 0,
      cleanersSuspended: 0,
      errors: [] as string[],
    };

    // 1. Send expiry alerts for documents expiring within 30 days
    try {
      const expiring = await RightToWorkService.getExpiringDocuments(30);
      if (expiring.length > 0) {
        results.alertsSent = await RightToWorkService.sendExpiryAlerts(expiring, 'system-cron');
      }
    } catch (error) {
      results.errors.push(
        `Alert sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // 2. Suspend cleaners with expired RTW
    try {
      const expired = await RightToWorkService.getExpiredDocuments();
      for (const profile of expired) {
        try {
          await RightToWorkService.suspendExpiredRtw(profile.id, 'system-cron');
          results.cleanersSuspended++;
        } catch (error) {
          results.errors.push(
            `Suspend failed for ${profile.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      results.errors.push(
        `Expired check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // eslint-disable-next-line no-console
    console.log('[RTW Cron]', JSON.stringify(results));

    return NextResponse.json({
      message: 'RTW expiry check completed',
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[RTW Cron] Fatal error:', error);
    return NextResponse.json({ error: 'RTW expiry check failed' }, { status: 500 });
  }
}
