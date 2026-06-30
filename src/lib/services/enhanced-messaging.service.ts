import { prisma } from '@/lib/db/prisma';
import { ValidationError } from '@/lib/utils/errors';

import { sendMessage as sendGatedMessage } from './message.service';

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
   * Send a message between customer and cleaner.
   *
   * Delegates to the single gated send path (message.service.sendMessage), which
   * performs booking-scoped authorization, server-side receiver derivation, the
   * release-gate and sanitization. This class must NOT write messages directly —
   * doing so would reintroduce the unguarded-writer hole we just closed.
   * (Attachments are not yet supported by the gated path; B2/B3.)
   */
  static async sendMessage(params: SendMessageParams) {
    if (!params.bookingId) {
      throw new ValidationError('A booking is required to send a message.');
    }

    const message = await sendGatedMessage(params.senderId, params.bookingId, params.content);

    // Notify the (server-derived) receiver.
    const sender = await prisma.user.findUnique({
      where: { id: params.senderId },
      select: { name: true },
    });
    await prisma.notification.create({
      data: {
        userId: message.receiverId,
        type: 'NEW_MESSAGE',
        title: `New message from ${sender?.name ?? 'User'}`,
        body: message.content.substring(0, 100),
        data: {
          senderId: params.senderId,
          messageId: message.id,
          bookingId: params.bookingId,
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
