// ─── Types ──────────────────────────────────────────────────

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

// ─── Mock Data ──────────────────────────────────────────────

const now = Date.now();

function minutesAgo(min: number): string {
  return new Date(now - min * 60 * 1000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(now - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

const currentUserId = 'user-1';

const mockMessages: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-1',
      receiverId: 'cleaner-1',
      content: 'Hi Sarah! I just booked a cleaning for next Tuesday. Is 10 AM still good?',
      bookingId: 'booking-1',
      read: true,
      createdAt: hoursAgo(3),
    },
    {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'cleaner-1',
      receiverId: 'user-1',
      content: 'Hi! Yes, 10 AM works perfectly. I will be there on time.',
      read: true,
      createdAt: hoursAgo(2.5),
    },
    {
      id: 'msg-3',
      conversationId: 'conv-1',
      senderId: 'user-1',
      receiverId: 'cleaner-1',
      content: 'Great! Should I leave the key under the mat or will you need me to be home?',
      read: true,
      createdAt: hoursAgo(2),
    },
    {
      id: 'msg-4',
      conversationId: 'conv-1',
      senderId: 'cleaner-1',
      receiverId: 'user-1',
      content: 'Either works for me! If you leave the key, just make sure to let me know the exact spot. I will also bring my own cleaning products — no extra charge.',
      read: false,
      createdAt: minutesAgo(30),
    },
  ],
  'conv-2': [
    {
      id: 'msg-5',
      conversationId: 'conv-2',
      senderId: 'cleaner-2',
      receiverId: 'user-1',
      content: 'Hello! Thanks for booking with me. I wanted to ask about your deep cleaning — do you have any specific areas you would like me to focus on?',
      read: true,
      createdAt: daysAgo(1),
    },
    {
      id: 'msg-6',
      conversationId: 'conv-2',
      senderId: 'user-1',
      receiverId: 'cleaner-2',
      content: 'Yes! The kitchen and bathrooms need extra attention. The oven especially has not been cleaned in a while.',
      read: true,
      createdAt: daysAgo(1),
    },
    {
      id: 'msg-7',
      conversationId: 'conv-2',
      senderId: 'cleaner-2',
      receiverId: 'user-1',
      content: 'No problem at all! I have professional-grade oven cleaner. I will make sure those areas are spotless. See you Friday!',
      read: true,
      createdAt: hoursAgo(20),
    },
  ],
  'conv-3': [
    {
      id: 'msg-8',
      conversationId: 'conv-3',
      senderId: 'user-1',
      receiverId: 'cleaner-3',
      content: 'Hi James, I need to reschedule my cleaning from Wednesday to Thursday. Is that possible?',
      read: true,
      createdAt: daysAgo(2),
    },
    {
      id: 'msg-9',
      conversationId: 'conv-3',
      senderId: 'cleaner-3',
      receiverId: 'user-1',
      content: 'Hi there! Thursday afternoon works — how about 2 PM?',
      read: true,
      createdAt: daysAgo(2),
    },
    {
      id: 'msg-10',
      conversationId: 'conv-3',
      senderId: 'user-1',
      receiverId: 'cleaner-3',
      content: 'Perfect, 2 PM Thursday it is. Thank you for being flexible!',
      read: true,
      createdAt: daysAgo(2),
    },
  ],
  'conv-4': [
    {
      id: 'msg-11',
      conversationId: 'conv-4',
      senderId: 'cleaner-4',
      receiverId: 'user-1',
      content: 'Good morning! Just wanted to let you know I completed the end-of-tenancy clean. I have left photos of each room in the booking notes.',
      read: true,
      createdAt: daysAgo(5),
    },
    {
      id: 'msg-12',
      conversationId: 'conv-4',
      senderId: 'user-1',
      receiverId: 'cleaner-4',
      content: 'Wow, the place looks amazing! Thank you so much. I have released the payment from escrow.',
      read: true,
      createdAt: daysAgo(5),
    },
    {
      id: 'msg-13',
      conversationId: 'conv-4',
      senderId: 'cleaner-4',
      receiverId: 'user-1',
      content: 'Thank you! It was a pleasure. Feel free to book me anytime you need another clean!',
      read: true,
      createdAt: daysAgo(4),
    },
  ],
};

const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-1', name: 'Sarah M.', avatar: '/images/cleaners/sarah.jpg', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-1'][mockMessages['conv-1'].length - 1],
    unreadCount: 1,
    bookingId: 'booking-1',
    createdAt: hoursAgo(3),
    updatedAt: minutesAgo(30),
  },
  {
    id: 'conv-2',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-2', name: 'Emma L.', avatar: '/images/cleaners/emma.jpg', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-2'][mockMessages['conv-2'].length - 1],
    unreadCount: 0,
    bookingId: 'booking-2',
    createdAt: daysAgo(1),
    updatedAt: hoursAgo(20),
  },
  {
    id: 'conv-3',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-3', name: 'James T.', avatar: '/images/cleaners/james.jpg', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-3'][mockMessages['conv-3'].length - 1],
    unreadCount: 0,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: 'conv-4',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-4', name: 'Maria G.', avatar: '/images/cleaners/maria.jpg', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-4'][mockMessages['conv-4'].length - 1],
    unreadCount: 0,
    bookingId: 'booking-6',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(4),
  },
];

// ─── Service Functions ──────────────────────────────────────

export async function getConversations(userId: string): Promise<Conversation[]> {
  // Filter conversations where user is a participant, sorted by updatedAt
  return mockConversations
    .filter((c) => c.participants.some((p) => p.id === userId))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  return mockMessages[conversationId] || [];
}

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string,
  bookingId?: string
): Promise<Message> {
  // Find or create conversation
  const conversation = mockConversations.find((c) =>
    c.participants.some((p) => p.id === senderId) &&
    c.participants.some((p) => p.id === receiverId)
  );

  const conversationId = conversation?.id || `conv-${Date.now()}`;

  const message: Message = {
    id: `msg-${Date.now()}`,
    conversationId,
    senderId,
    receiverId,
    content,
    bookingId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  // In production, save to database
  console.log('[Message] Sent:', message.content.substring(0, 50));
  return message;
}

export async function markAsRead(conversationId: string, userId: string): Promise<void> {
  const messages = mockMessages[conversationId];
  if (messages) {
    messages.forEach((m) => {
      if (m.receiverId === userId && !m.read) {
        m.read = true;
      }
    });
  }

  const conversation = mockConversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.unreadCount = 0;
  }

  console.log(`[Message] Marked conversation ${conversationId} as read for user ${userId}`);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return mockConversations
    .filter((c) => c.participants.some((p) => p.id === userId))
    .reduce((total, c) => total + c.unreadCount, 0);
}
