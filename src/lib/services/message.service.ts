// ─── Types ──────────────────────────────────────────────────

import { prisma } from '@/lib/db/prisma';
import { sendNewMessageEmail } from '@/lib/services/email.service';
import { EnhancedNotificationService } from '@/lib/services/enhanced-notification.service';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/utils/errors';
import { detectContactInfo } from '@/lib/utils/pii';
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
  // A10 B2: true when the current user has blocked this partner (drives the
  // block/unblock toggle). canSend is already false when EITHER party blocks.
  blockedByMe: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Service Functions ──────────────────────────────────────

export async function getConversations(userId: string): Promise<Conversation[]> {
  // A10 B3: replaces the former per-partner N+1 (≈5 queries × partners) with a
  // small constant set of batched queries. One ordered fetch of all messages
  // involving the user yields the partner list + last message + unread counts;
  // blocks and active bookings are each a single query; partner users are one
  // `in` query.
  const [me, allMessages, blocks, activeBookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
    // Active/settling bookings of this user — funds not released/refunded AND not
    // cancelled. Ordered newest-first so the first per partner is the active one.
    prisma.booking.findMany({
      where: {
        OR: [{ clientId: userId }, { cleanerId: userId }],
        transferStatus: { notIn: ['RELEASED', 'REFUNDED'] },
        status: { notIn: ['CANCELLED', 'CASCADE_EXHAUSTED'] },
      },
      orderBy: { date: 'desc' },
      select: { id: true, clientId: true, cleanerId: true },
    }),
  ]);

  const myRole: 'customer' | 'cleaner' = me?.role === 'CLEANER' ? 'cleaner' : 'customer';

  // Derive last message (newest, since allMessages is desc) + unread per partner.
  const lastByPartner = new Map<string, (typeof allMessages)[number]>();
  const unreadByPartner = new Map<string, number>();
  for (const m of allMessages) {
    const partnerId = m.senderId === userId ? m.receiverId : m.senderId;
    if (!lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
    if (m.receiverId === userId && !m.read) {
      unreadByPartner.set(partnerId, (unreadByPartner.get(partnerId) ?? 0) + 1);
    }
  }
  const partnerIds = Array.from(lastByPartner.keys());

  // Blocks: blockedByMe (I blocked them) and eitherBlocked (either direction).
  const blockedByMeSet = new Set<string>();
  const eitherBlockedSet = new Set<string>();
  for (const b of blocks) {
    if (b.blockerId === userId) {
      blockedByMeSet.add(b.blockedId);
      eitherBlockedSet.add(b.blockedId);
    }
    if (b.blockedId === userId) {
      eitherBlockedSet.add(b.blockerId);
    }
  }

  // Active booking per partner (most recent qualifying).
  const activeBookingByPartner = new Map<string, string>();
  for (const bk of activeBookings) {
    const partnerId = bk.clientId === userId ? bk.cleanerId : bk.clientId;
    if (partnerId && !activeBookingByPartner.has(partnerId)) {
      activeBookingByPartner.set(partnerId, bk.id);
    }
  }

  // Partner users in one query.
  const partners = await prisma.user.findMany({
    where: { id: { in: partnerIds } },
    select: { id: true, name: true, image: true, role: true },
  });
  const partnerById = new Map(partners.map((p) => [p.id, p]));

  const conversations: Conversation[] = [];
  for (const partnerId of partnerIds) {
    const partner = partnerById.get(partnerId);
    const lastMessage = lastByPartner.get(partnerId);
    if (!partner || !lastMessage) continue;

    const activeBookingId = activeBookingByPartner.get(partnerId);

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
      unreadCount: unreadByPartner.get(partnerId) ?? 0,
      bookingId: lastMessage.bookingId || undefined,
      canSend: !!activeBookingId && !eitherBlockedSet.has(partnerId),
      activeBookingId,
      blockedByMe: blockedByMeSet.has(partnerId),
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

  // Block-gate (A10 B2): a block in EITHER direction closes the conversation, even
  // with an active booking. Enforced here so a blocked send is rejected at the API,
  // not merely hidden in the UI.
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: senderId },
      ],
    },
    select: { id: true },
  });
  if (block) {
    throw new ForbiddenError('You can no longer message this person.');
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

  // PII auto-flag (A10 B3): if the content looks like contact info, raise a
  // SYSTEM-origin moderation flag (off-platform circumvention) for the admin queue.
  // The message is NOT blocked or redacted — it still sends. Fire-and-forget so a
  // flag failure can never 500 the send.
  if (detectContactInfo(content).any) {
    prisma.messageReport
      .create({
        data: {
          messageId: created.id,
          origin: 'SYSTEM',
          reportedUserId: senderId,
          bookingId,
          reason: 'OFF_PLATFORM',
          details: 'Auto-flagged: message appears to contain contact info (phone/email).',
        },
      })
      .catch(() => {});
  }

  // Notify the recipient — fire-and-forget so a notification failure can NEVER
  // 500 a successfully-sent message. This is the single gated path, so every send
  // (any caller) notifies the recipient exactly once.
  dispatchNewMessageNotifications({
    messageId: created.id,
    senderId,
    receiverId,
    bookingId,
    content: created.content,
  }).catch(() => {});

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

/**
 * Best-effort fan-out of NEW_MESSAGE notifications, called fire-and-forget from
 * the gated sendMessage. In-app + push every time (via the canonical
 * EnhancedNotificationService.send, same path as review requests). Email only on
 * the FIRST unread from this sender (a burst -> one email, no re-nag), and the
 * email links to the thread rather than exposing the message body (PII).
 */
async function dispatchNewMessageNotifications(params: {
  messageId: string;
  senderId: string;
  receiverId: string;
  bookingId: string;
  content: string;
}): Promise<void> {
  const { messageId, senderId, receiverId, bookingId, content } = params;

  const [sender, receiver, priorUnread] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: receiverId }, select: { name: true, email: true } }),
    // "First unread" = no OTHER unread message from this sender to this recipient.
    prisma.message.count({
      where: { senderId, receiverId, read: false, id: { not: messageId } },
    }),
  ]);

  const senderName = sender?.name ?? 'Someone';

  // In-app + push.
  await EnhancedNotificationService.send({
    userId: receiverId,
    type: 'NEW_MESSAGE',
    title: `New message from ${senderName}`,
    body: content.substring(0, 100),
    data: { senderId, messageId, bookingId },
  });

  // Email — first-unread-only.
  if (priorUnread === 0 && receiver?.email) {
    await sendNewMessageEmail(receiver.email, receiver.name ?? '', senderName);
  }
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
