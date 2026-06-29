import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAdminSession, getSessionUser } from '@/lib/auth/session';
import { GdprService } from '@/lib/services/gdpr.service';

// ─── POST /api/gdpr/deletion ─── Request data deletion ──

export async function POST(request: NextRequest) {
  try {
    // SECURITY: a user may only request deletion of their OWN account; admins any.
    const requester = await getSessionUser();
    if (!requester) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, email, reason } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 });
    }

    if (userId !== requester.id && requester.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const deletionRequest = await GdprService.requestDataDeletion({
      userId,
      email: email.trim().toLowerCase(),
      reason,
    });

    return NextResponse.json({
      success: true,
      requestId: deletionRequest.id,
      status: deletionRequest.status,
      message:
        'Your data deletion request has been submitted. We will process it within 30 days as required by GDPR.',
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GDPR] Deletion request error:', error);
    return NextResponse.json({ error: 'Failed to submit deletion request' }, { status: 500 });
  }
}

// ─── GET /api/gdpr/deletion ─── Get pending requests (admin) ──

export async function GET() {
  try {
    // SECURITY: the pending-deletion queue exposes other users' emails/reasons —
    // admin only.
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const requests = await GdprService.getPendingDeletionRequests();
    return NextResponse.json({ requests });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[GDPR] Fetch deletion requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch deletion requests' }, { status: 500 });
  }
}
