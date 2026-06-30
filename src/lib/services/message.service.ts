// ─── Types ──────────────────────────────────────────────────

import { prisma } from '@/lib/db/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { sanitizeMessageContent } from '@/lib/utils/sanitize';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  bookingId?: string;
  read: boolean;
  createdAt: string;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar: string;
  role: 'customer' | 'cleaner';
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage: Message;
  unreadCount: number;
  bookingId?: string;
  // A10 B1: send-eligibility for this pair. canSend is true only while the pair
  // shares an active/settling booking (funds not released/refunded, not cancelled).
  // activeBookingId is that booking — the one a new message is tagged with.
  canSend: boolean;
  activeBookingId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Service Functions ──────────────────────────────────────

export async function getConversations(userId: string): Promise<Conversation[]> {
  // Self role — fixes the bug where the self-participant was hardcoded 'customer'
  // (so a cleaner saw themselves mislabeled).
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const myRole: 'customer' | 'cleaner' = me?.role === 'CLEANER' ? 'cleaner' : 'customer';

  // Get all distinct conversation partners (pair-level grouping).
  const sentTo = await prisma.message.findMany({
    where: { senderId: userId },
    select: { receiverId: true },
    distinct: ['receiverId'],
  });
  const receivedFrom = await prisma.message.findMany({
    where: { receiverId: userId },
    select: { senderId: true },
    distinct: ['senderId'],
  });

  const partnerIds = Array.from(
    new Set([...sentTo.map((m) => m.receiverId), ...receivedFrom.map((m) => m.senderId)])
  );

  const conversations: Conversation[] = [];

  for (const partnerId of partnerIds) {
    const pairWhere = {
      OR: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    };

    const [partner, lastMessage, unreadCount, activeBooking] = await Promise.all([
      prisma.user.findUnique({
        where: { id: partnerId },
        select: { id: true, name: true, image: true, role: true },
      }),
      prisma.message.findFirst({ where: pairWhere, orderBy: { createdAt: 'desc' } }),
      prisma.message.count({ where: { senderId: partnerId, receiverId: userId, read: false } }),
      // Send is allowed only while the pair shares an ACTIVE/SETTLING booking:
      // funds not yet released/refunded AND the booking isn't cancelled. After that
      // the conversation is read-only until a new booking.
      prisma.booking.findFirst({
        where: {
          OR: [
            { clientId: userId, cleanerId: partnerId },
            { clientId: partnerId, cleanerId: userId },
          ],
          transferStatus: { notIn: ['RELEASED', 'REFUNDED'] },
          status: { notIn: ['CANCELLED', 'CASCADE_EXHAUSTED'] },
        },
        orderBy: { date: 'desc' },
        select: { id: true },
      }),
    ]);

    if (!partner || !lastMessage) continue;

    conversations.push({
      id: partnerId,
      participants: [
        { id: userId, name: 'You', avatar: '', role: myRole },
        {
          id: partner.id,
          name: partner.name || 'User',
          avatar: partner.image || '',
          role: partner.role === 'CLEANER' ? 'cleaner' : 'customer',
        },
      ],
      lastMessage: {
        id: lastMessage.id,
        conversationId: partnerId,
        senderId: lastMessage.senderId,
        receiverId: lastMessage.receiverId,
        content: lastMessage.content,
        bookingId: lastMessage.bookingId || undefined,
        read: lastMessage.read,
        createdAt: lastMessage.createdAt.toISOString(),
      },
      unreadCount,
      bookingId: lastMessage.bookingId || undefined,
      canSend: !!activeBooking,
      activeBookingId: activeBooking?.id ?? undefined,
      createdAt: lastMessage.createdAt.toISOString(),
      updatedAt: lastMessage.createdAt.toISOString(),
    });
  }

  return conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getMessages(partnerId: string, userId: string): Promise<Message[]> {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map((m) => ({
    id: m.id,
    conversationId: partnerId,
    senderId: m.senderId,
    receiverId: m.receiverId,
    content: m.content,
    bookingId: m.bookingId || undefined,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  }));
}

/**
 * Send a message, scoped and authorized by a booking.
 *
 * The ONLY gated write path for messages — the route and EnhancedMessagingService
 * both go through here, so no caller can bypass these checks:
 *  - sender must be a participant of `bookingId`; the receiver is DERIVED as the
 *    other party (never taken from the request body);
 *  - release-gate: the booking must be active/settling (funds not released/refunded
 *    and not cancelled) — otherwise the conversation is read-only;
 *  - content is strip-sanitized (not entity-encoded) and length-capped.
 */
export async function sendMessage(
  senderId: string,
  bookingId: string,
  rawContent: string
): Promise<Message> {
  if (!bookingId || typeof bookingId !== 'string') {
    throw new ValidationError('A booking is required to send a message.');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { clientId: true, cleanerId: true, transferStatus: true, status: true },
  });
  if (!booking) throw new NotFoundError('Booking not found.');

  // Authorization: sender must be a participant; receiver = the OTHER party.
  const isClient = booking.clientId === senderId;
  const isCleaner = booking.cleanerId === senderId;
  if (!isClient && !isCleaner) {
    throw new ForbiddenError('You can only message about your own bookings.');
  }
  const receiverId = isClient ? booking.cleanerId : booking.clientId;
  if (!receiverId) {
    throw new ForbiddenError('This booking has no counterparty to message.');
  }

  // Release-gate (A6): open only while active/settling; read-only once settled or
  // cancelled (a cancelled-pre-charge booking can't keep the channel open).
  const isSettled = booking.transferStatus === 'RELEASED' || booking.transferStatus === 'REFUNDED';
  const isDead = booking.status === 'CANCELLED' || booking.status === 'CASCADE_EXHAUSTED';
  if (isSettled || isDead) {
    throw new ForbiddenError(
      'This conversation is read-only — start a new booking to message again.'
    );
  }

  const content = sanitizeMessageContent(rawContent);
  if (!content) {
    throw new ValidationError('Message content cannot be empty.');
  }
  if (content.length > 5000) {
    throw new ValidationError('Message is too long (max 5000 characters).');
  }

  const created = await prisma.message.create({
    data: { senderId, receiverId, content, bookingId },
  });

  return {
    id: created.id,
    conversationId: receiverId,
    senderId: created.senderId,
    receiverId: created.receiverId,
    content: created.content,
    bookingId: created.bookingId,
    read: created.read,
    createdAt: created.createdAt.toISOString(),
  };
}

export async function markAsRead(partnerId: string, userId: string): Promise<void> {
  await prisma.message.updateMany({
    where: {
      senderId: partnerId,
      receiverId: userId,
      read: false,
    },
    data: { read: true },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.message.count({
    where: { receiverId: userId, read: false },
  });
}
