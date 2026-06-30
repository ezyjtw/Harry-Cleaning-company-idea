import { NextResponse } from 'next/server';

import { getSessionUser } from '@/lib/auth/session';
import prisma from '@/lib/db/prisma';
import { handleApiError, ValidationError } from '@/lib/utils/errors';

// Block is scoped to the booking-pair context: you can only block someone you
// share (or shared) a booking with.
async function sharesBooking(userId: string, partnerId: string): Promise<boolean> {
  const shared = await prisma.booking.findFirst({
    where: {
      OR: [
        { clientId: userId, cleanerId: partnerId },
        { clientId: partnerId, cleanerId: userId },
      ],
    },
    select: { id: true },
  });
  return !!shared;
}

// POST /api/messages/block { partnerId } — block a conversation partner.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { partnerId } = await request.json();
    if (!partnerId || typeof partnerId !== 'string') {
      throw new ValidationError('partnerId is required.');
    }
    if (partnerId === user.id) {
      throw new ValidationError('You cannot block yourself.');
    }
    if (!(await sharesBooking(user.id, partnerId))) {
      return NextResponse.json(
        { error: 'You can only block someone you have a booking with.' },
        { status: 403 }
      );
    }

    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: partnerId } },
      create: { blockerId: user.id, blockedId: partnerId },
      update: {},
    });

    return NextResponse.json({ blocked: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/messages/block { partnerId } — unblock.
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const { partnerId } = await request.json();
    if (!partnerId || typeof partnerId !== 'string') {
      throw new ValidationError('partnerId is required.');
    }

    await prisma.userBlock.deleteMany({
      where: { blockerId: user.id, blockedId: partnerId },
    });

    return NextResponse.json({ blocked: false });
  } catch (error) {
    return handleApiError(error);
  }
}
