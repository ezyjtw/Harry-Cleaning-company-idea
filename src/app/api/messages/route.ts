import { NextRequest, NextResponse } from 'next/server';
import { getConversations, sendMessage } from '@/lib/services/message.service';
import { getSessionUser } from '@/lib/auth/session';
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

    const message = await sendMessage(user.id, receiverId, content.trim(), bookingId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
