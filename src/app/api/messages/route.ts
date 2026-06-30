import { type NextRequest, NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import { getConversations, sendMessage } from '@/lib/services/message.service';
import { handleApiError, ValidationError } from '@/lib/utils/errors';

// GET /api/messages - List conversations for the current user
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const conversations = await getConversations(user.id);

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/messages - Send a message within a booking-scoped conversation.
// Body: { bookingId, content }. The receiver, authorization, release-gate and
// sanitization are all handled server-side in sendMessage() — the receiver is
// DERIVED from the booking and never taken from the request body.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { bookingId, content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Message content cannot be empty');
    }
    if (!bookingId || typeof bookingId !== 'string') {
      throw new ValidationError('A booking is required to send a message.');
    }

    const message = await sendMessage(user.id, bookingId, content);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
