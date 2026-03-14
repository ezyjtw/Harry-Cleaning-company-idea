import { NextRequest, NextResponse } from 'next/server';
import { getConversations, sendMessage } from '@/lib/services/message.service';
import { handleApiError, ValidationError } from '@/lib/utils/errors';

// GET /api/messages - List conversations for the current user
export async function GET() {
  try {
    // In production, get userId from session/auth
    const userId = 'user-1';
    const conversations = await getConversations(userId);

    return NextResponse.json({ conversations });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { receiverId, content, bookingId } = body;

    // Validate content is not empty
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new ValidationError('Message content cannot be empty');
    }

    if (!receiverId || typeof receiverId !== 'string') {
      throw new ValidationError('Receiver ID is required');
    }

    // In production, get senderId from session/auth
    const senderId = 'user-1';

    const message = await sendMessage(senderId, receiverId, content.trim(), bookingId);

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
