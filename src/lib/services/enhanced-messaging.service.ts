import { prisma } from '@/lib/db/prisma';

export interface SendMessageParams {
  senderId: string;
  receiverId: string;
  content: string;
  bookingId?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'document';
}

export interface ConversationSummary {
  participantId: string;
  participantName: string;
  participantRole: string;
  lastMessageContent: string;
  lastMessageAt: Date;
  unreadCount: number;
  bookingId?: string;
}

export class EnhancedMessagingService {
  /**
   * Send a message between customer and cleaner
   */
  static async sendMessage(params: SendMessageParams) {
    const message = await prisma.message.create({
      data: {
        senderId: params.senderId,
        receiverId: params.receiverId,
        content: params.content,
        bookingId: params.bookingId,
      },
      include: { sender: { select: { name: true } } },
    });

    // Create notification for receiver
    await prisma.notification.create({
      data: {
        userId: params.receiverId,
        type: 'NEW_MESSAGE',
        title: `New message from ${message.sender.name ?? 'User'}`,
        body: params.content.substring(0, 100),
        data: {
          senderId: params.senderId,
          messageId: message.id,
          bookingId: params.bookingId ?? '',
        },
      },
    });

    return message;
  }

  /**
   * Get conversation list for a user
   */
  static async getConversations(userId: string): Promise<ConversationSummary[]> {
    // Find all unique conversation partners
    const sentMessages = await prisma.message.findMany({
      where: { senderId: userId },
      select: { receiverId: true },
      distinct: ['receiverId'],
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: userId },
      select: { senderId: true },
      distinct: ['senderId'],
    });

    const partnerIdSet = new Set([
      ...sentMessages.map((m) => m.receiverId),
      ...receivedMessages.map((m) => m.senderId),
    ]);
    const partnerIds = Array.from(partnerIdSet);

    const conversations: ConversationSummary[] = [];

    for (const partnerId of partnerIds) {
      const [partner, lastMessage, unreadCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: partnerId }, select: { name: true, role: true } }),
        prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: partnerId },
              { senderId: partnerId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.message.count({
          where: { senderId: partnerId, receiverId: userId, read: false },
        }),
      ]);

      if (partner && lastMessage) {
        conversations.push({
          participantId: partnerId,
          participantName: partner.name ?? 'Unknown',
          participantRole: partner.role,
          lastMessageContent: lastMessage.content,
          lastMessageAt: lastMessage.createdAt,
          unreadCount,
          bookingId: lastMessage.bookingId ?? undefined,
        });
      }
    }

    return conversations.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  /**
   * Get message history between two users
   */
  static async getMessageHistory(
    userId: string,
    partnerId: string,
    options?: { page?: number; pageSize?: number }
  ) {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: userId },
          ],
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { sender: { select: { name: true } } },
      }),
      prisma.message.count({
        where: {
          OR: [
            { senderId: userId, receiverId: partnerId },
            { senderId: partnerId, receiverId: userId },
          ],
        },
      }),
    ]);

    return {
      messages: messages.reverse(),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /**
   * Mark all messages from a partner as read
   */
  static async markConversationRead(userId: string, partnerId: string) {
    return prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: userId, read: false },
      data: { read: true },
    });
  }

  /**
   * Get total unread message count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.message.count({
      where: { receiverId: userId, read: false },
    });
  }
}
