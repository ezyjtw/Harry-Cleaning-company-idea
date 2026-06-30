import { type NextRequest, NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { getConversations, sendMessage } from '@/lib/services/message.service';
import { handleApiError, ValidationError } from '@/lib/utils/errors';
import { containsDangerousContent } from '@/lib/utils/sanitize';

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

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = await request.json();
    const { receiverId, content, bookingId } = body;

    // Validate content is not empty
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Message content cannot be empty');
    }

    if (!receiverId || typeof receiverId !== 'string') {
      throw new ValidationError('Receiver ID is required');
    }

    if (receiverId === user.id) {
      throw new ValidationError('Cannot send a message to yourself');
    }

    // STOPGAP (A10 P1): messaging must be between two parties who share a booking.
    // Closes the open-DM hole — previously any authenticated user could DM any
    // userId (receiverIds are harvestable from public /cleaners/[id]). Proper
    // booking-scoped authorization lands in A10 B1.
    const sharedBooking = await prisma.booking.findFirst({
      where: {
        OR: [
          { clientId: user.id, cleanerId: receiverId },
          { clientId: receiverId, cleanerId: user.id },
        ],
      },
      select: { id: true },
    });
    if (!sharedBooking) {
      return NextResponse.json(
        { error: 'You can only message someone you have a booking with.' },
        { status: 403 }
      );
    }

    // STOPGAP: reject active-content payloads (stored-XSS defence-in-depth) and cap
    // length. We REJECT rather than HTML-entity-encode so message text isn't
    // double-encoded on render. Proper strip-based sanitization + PII warn/flag
    // come in A10 B1/B3.
    if (content.trim().length > 5000) {
      throw new ValidationError('Message is too long (max 5000 characters).');
    }
    if (containsDangerousContent(content)) {
      throw new ValidationError('Message contains disallowed content.');
    }

    const message = await sendMessage(user.id, receiverId, content.trim(), bookingId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
