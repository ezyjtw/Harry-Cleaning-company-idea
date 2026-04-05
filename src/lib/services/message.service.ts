// ─── Types ──────────────────────────────────────────────────

import { prisma } from '@/lib/db/prisma';

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
  createdAt: string;
  updatedAt: string;
}

// ─── Service Functions ──────────────────────────────────────

export async function getConversations(userId: string): Promise<Conversation[]> {
  // Get all distinct conversation partners
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

  const partnerIds = Array.from(new Set([
    ...sentTo.map(m => m.receiverId),
    ...receivedFrom.map(m => m.senderId),
  ]));

  const conversations: Conversation[] = [];

  for (const partnerId of partnerIds) {
    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true, image: true, role: true },
    });
    if (!partner) continue;

    const lastMessage = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const unreadCount = await prisma.message.count({
      where: { senderId: partnerId, receiverId: userId, read: false },
    });

    if (!lastMessage) continue;

    // Find if there's a booking between them
    const bookingMessage = await prisma.message.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
        bookingId: { not: null },
      },
      select: { bookingId: true },
      orderBy: { createdAt: 'desc' },
    });

    conversations.push({
      id: partnerId,
      participants: [
        { id: userId, name: 'You', avatar: '', role: 'customer' },
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
      bookingId: bookingMessage?.bookingId || undefined,
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

  return messages.map(m => ({
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

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  bookingId?: string
): Promise<Message> {
  const created = await prisma.message.create({
    data: {
      senderId,
      receiverId,
      content,
      bookingId: bookingId || null,
    },
  });

  return {
    id: created.id,
    conversationId: receiverId,
    senderId: created.senderId,
    receiverId: created.receiverId,
    content: created.content,
    bookingId: created.bookingId || undefined,
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
