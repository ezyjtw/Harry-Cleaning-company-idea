import { NextResponse } from 'next/server';
import { getMessages, markAsRead } from '@/lib/services/message.service';
import { getSessionUser } from '@/lib/auth/session';
import { handleApiError } from '@/lib/utils/errors';

// GET /api/messages/[partnerId] - Get messages with a specific partner
export async function GET(
  _request: Request,
  { params }: { params: { partnerId: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const messages = await getMessages(params.partnerId, user.id);

    // Mark messages from this partner as read
    await markAsRead(params.partnerId, user.id);

    return NextResponse.json({ messages });
  } catch (error) {
    return handleApiError(error);
  }
}
