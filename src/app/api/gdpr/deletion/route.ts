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
    const { userId, email, reason, password } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 });
    }

    if (userId !== requester.id && requester.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const { prisma: db } = await import('@/lib/db/prisma');

    // H103: self-serve deletion requires the PASSWORD re-entered alongside the
    // type-to-confirm — a stolen session alone must not be able to file it.
    // (Admin-filed requests skip this; accounts without a password can't
    // re-enter one, so the session + type-to-confirm stand alone there.)
    if (userId === requester.id) {
      const account = await db.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });
      if (account?.passwordHash) {
        const bcrypt = (await import('bcryptjs')).default;
        const okPw =
          typeof password === 'string' && (await bcrypt.compare(password, account.passwordHash));
        if (!okPw) {
          return NextResponse.json(
            { error: 'Please re-enter your password correctly to confirm.' },
            { status: 403 }
          );
        }
      }
    }

    // H103: one open request at a time — a duplicate would double-deactivate
    // and clutter the admin queue.
    const open = await db.dataDeletionRequest.findFirst({
      where: { userId, status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    if (open) {
      return NextResponse.json(
        { error: 'A deletion request for this account is already in progress.' },
        { status: 409 }
      );
    }

    // H103: role-appropriate blockers — structural, named, checked BEFORE
    // anything is deactivated (a cleaner with live jobs strands customers; a
    // client mid-booking strands a cleaner's committed slot the same way).
    // Each names the action that clears it.
    if (userId === requester.id && (requester.role === 'CLEANER' || requester.role === 'CLIENT')) {
      const blockers =
        requester.role === 'CLEANER'
          ? await GdprService.getCleanerDeletionBlockers(userId)
          : await GdprService.getClientDeletionBlockers(userId);
      if (blockers.length > 0) {
        return NextResponse.json(
          {
            error: `Your account can't be deleted yet: ${blockers.join('; ')}.`,
            blockers,
          },
          { status: 409 }
        );
      }
    }

    const deletionRequest = await GdprService.requestDataDeletion({
      userId,
      email: email.trim().toLowerCase(),
      reason,
    });

    // F1: the account is DEACTIVATED the moment deletion is requested — login
    // refuses non-ACTIVE accounts and getSessionUser's per-request DB check
    // kills any live sessions immediately. Erasure itself stays behind the
    // admin-approved workflow (irreversible, never unattended).
    const { prisma } = await import('@/lib/db/prisma');
    await prisma.user.update({
      where: { id: userId },
      data: { accountStatus: 'DEACTIVATED' },
    });

    return NextResponse.json({
      success: true,
      requestId: deletionRequest.id,
      status: deletionRequest.status,
      message:
        'Your account has been deactivated. Your data will be erased within 30 days, except records we are legally required to keep (e.g. booking and tax records).',
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
