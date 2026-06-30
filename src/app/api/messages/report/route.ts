import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { handleApiError, ValidationError } from '@/lib/utils/errors';

const REASONS = ['SPAM', 'HARASSMENT', 'OFF_PLATFORM', 'INAPPROPRIATE', 'OTHER'] as const;
type Reason = (typeof REASONS)[number];

// POST /api/messages/report { messageId, reason, details? }
// You can only report a message that was sent TO you (a participant of your own
// conversation). The reported user is the message's author.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { messageId, reason, details } = await request.json();

    if (!messageId || typeof messageId !== 'string') {
      throw new ValidationError('messageId is required.');
    }
    if (!reason || !REASONS.includes(reason)) {
      throw new ValidationError('A valid reason is required.');
    }

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, receiverId: true, bookingId: true },
    });
    if (!message) {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    }

    // Authorization: you can only report a message you RECEIVED (in your own
    // conversation), not your own message.
    if (message.receiverId !== user.id) {
      return NextResponse.json(
        { error: 'You can only report messages sent to you.' },
        { status: 403 }
      );
    }

    // Dedupe: one report per (reporter, message).
    const existing = await prisma.messageReport.findFirst({
      where: { messageId, reporterId: user.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ reported: true, alreadyReported: true });
    }

    const trimmedDetails =
      typeof details === 'string' && details.trim() ? details.trim().substring(0, 1000) : null;

    await prisma.messageReport.create({
      data: {
        messageId,
        reporterId: user.id,
        reportedUserId: message.senderId,
        bookingId: message.bookingId,
        reason: reason as Reason,
        details: trimmedDetails,
      },
    });

    return NextResponse.json({ reported: true });
  } catch (error) {
    return handleApiError(error);
  }
}
