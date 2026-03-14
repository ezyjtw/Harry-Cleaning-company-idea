'use client';

import { useState } from 'react';

// ─── Types ──────────────────────────────────────────────────

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

interface Participant {
  id: string;
  name: string;
  avatar: string;
  role: 'customer' | 'cleaner';
}

interface Conversation {
  id: string;
  participants: Participant[];
  lastMessage: Message;
  unreadCount: number;
  updatedAt: string;
}

// ─── Mock Data ──────────────────────────────────────────────

const currentUserId = 'user-1';
const now = Date.now();

const mockMessages: Record<string, Message[]> = {
  'conv-1': [
    { id: 'msg-1', conversationId: 'conv-1', senderId: 'user-1', content: 'Hi Sarah! I just booked a cleaning for next Tuesday. Is 10 AM still good?', read: true, createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-2', conversationId: 'conv-1', senderId: 'cleaner-1', content: 'Hi! Yes, 10 AM works perfectly. I will be there on time.', read: true, createdAt: new Date(now - 2.5 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-3', conversationId: 'conv-1', senderId: 'user-1', content: 'Great! Should I leave the key under the mat or will you need me to be home?', read: true, createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-4', conversationId: 'conv-1', senderId: 'cleaner-1', content: 'Either works for me! If you leave the key, just let me know the exact spot. I will also bring my own cleaning products.', read: false, createdAt: new Date(now - 30 * 60 * 1000).toISOString() },
  ],
  'conv-2': [
    { id: 'msg-5', conversationId: 'conv-2', senderId: 'cleaner-2', content: 'Hello! Thanks for booking. Do you have specific areas you would like me to focus on?', read: true, createdAt: new Date(now - 24 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-6', conversationId: 'conv-2', senderId: 'user-1', content: 'Yes! The kitchen and bathrooms need extra attention. The oven especially.', read: true, createdAt: new Date(now - 23 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-7', conversationId: 'conv-2', senderId: 'cleaner-2', content: 'No problem at all! I have professional-grade oven cleaner. See you Friday!', read: true, createdAt: new Date(now - 20 * 60 * 60 * 1000).toISOString() },
  ],
  'conv-3': [
    { id: 'msg-8', conversationId: 'conv-3', senderId: 'user-1', content: 'Hi James, I need to reschedule from Wednesday to Thursday. Possible?', read: true, createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-9', conversationId: 'conv-3', senderId: 'cleaner-3', content: 'Thursday afternoon works. How about 2 PM?', read: true, createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString() },
    { id: 'msg-10', conversationId: 'conv-3', senderId: 'user-1', content: 'Perfect, 2 PM Thursday it is. Thank you!', read: true, createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString() },
  ],
  'conv-4': [
    { id: 'msg-11', conversationId: 'conv-4', senderId: 'cleaner-4', content: 'Good morning! I completed the end-of-tenancy clean. Photos are in the booking notes.', read: true, createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-12', conversationId: 'conv-4', senderId: 'user-1', content: 'The place looks amazing! Thank you so much. Payment released from escrow.', read: true, createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-13', conversationId: 'conv-4', senderId: 'cleaner-4', content: 'Thank you! It was a pleasure. Feel free to book me anytime!', read: true, createdAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString() },
  ],
};

const mockConversations: Conversation[] = [
  {
    id: 'conv-1',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-1', name: 'Sarah M.', avatar: '', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-1'][3],
    unreadCount: 1,
    updatedAt: new Date(now - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'conv-2',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-2', name: 'Emma L.', avatar: '', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-2'][2],
    unreadCount: 0,
    updatedAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'conv-3',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-3', name: 'James T.', avatar: '', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-3'][2],
    unreadCount: 0,
    updatedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'conv-4',
    participants: [
      { id: 'user-1', name: 'You', avatar: '', role: 'customer' },
      { id: 'cleaner-4', name: 'Maria G.', avatar: '', role: 'cleaner' },
    ],
    lastMessage: mockMessages['conv-4'][2],
    unreadCount: 0,
    updatedAt: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Helpers ────────────────────────────────────────────────

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString();
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getOtherParticipant(conversation: Conversation): Participant {
  return conversation.participants.find((p) => p.id !== currentUserId) || conversation.participants[0];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

// ─── Component ──────────────────────────────────────────────

export default function MessagesPage() {
  const [conversations] = useState<Conversation[]>(mockConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>(mockMessages);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversationId ? allMessages[activeConversationId] || [] : [];

  function handleSendMessage() {
    if (!messageInput.trim() || !activeConversationId) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUserId,
      content: messageInput.trim(),
      read: false,
      createdAt: new Date().toISOString(),
    };

    setAllMessages((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMessage],
    }));
    setMessageInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleBackToList() {
    setActiveConversationId(null);
  }

  // ─── Empty State ────────────────────────────────────────

  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">No messages yet</h2>
        <p className="mt-1 text-sm text-gray-500">
          When you book a cleaner, you can message them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full border-x border-gray-200">
      {/* ─── Left Panel: Conversation List ─────────────────── */}
      <div
        className={`w-full flex-shrink-0 border-r border-gray-200 md:w-80 lg:w-96 ${
          activeConversationId ? 'hidden md:block' : 'block'
        }`}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
        </div>

        {/* Conversation list */}
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 65px)' }}>
          {conversations.map((conversation) => {
            const other = getOtherParticipant(conversation);
            const isActive = conversation.id === activeConversationId;
            const lastMsg = conversation.lastMessage;
            const isOwnMessage = lastMsg.senderId === currentUserId;

            return (
              <button
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${
                  isActive ? 'bg-blue-50' : ''
                } ${conversation.unreadCount > 0 ? 'bg-blue-50/30' : ''}`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {getInitials(other.name)}
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`truncate text-sm ${
                        conversation.unreadCount > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                      }`}
                    >
                      {other.name}
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {timeAgo(conversation.updatedAt)}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 truncate text-sm ${
                      conversation.unreadCount > 0 ? 'font-medium text-gray-800' : 'text-gray-500'
                    }`}
                  >
                    {isOwnMessage ? 'You: ' : ''}
                    {lastMsg.content}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Right Panel: Active Conversation ──────────────── */}
      <div
        className={`flex flex-1 flex-col ${
          activeConversationId ? 'block' : 'hidden md:flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
              {/* Back button (mobile) */}
              <button
                onClick={handleBackToList}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 md:hidden"
                aria-label="Back to conversations"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>

              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {getInitials(getOtherParticipant(activeConversation).name)}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {getOtherParticipant(activeConversation).name}
                </h2>
                <p className="text-xs text-gray-500">
                  {getOtherParticipant(activeConversation).role === 'cleaner' ? 'Cleaner' : 'Customer'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                {activeMessages.map((message) => {
                  const isOwn = message.senderId === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isOwn
                            ? 'rounded-br-md bg-blue-600 text-white'
                            : 'rounded-bl-md bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <p
                          className={`mt-1 text-right text-xs ${
                            isOwn ? 'text-blue-200' : 'text-gray-400'
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message input */}
            <div className="border-t border-gray-200 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No conversation selected */
          <div className="hidden flex-1 flex-col items-center justify-center text-center md:flex">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Select a conversation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Choose a conversation from the list to start messaging.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
