'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';

import { Avatar, ConversationRow, MessageBubble } from '@/components/messages/primitives';
import { detectContactInfo } from '@/lib/utils/pii';

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
  // A10 B1: send-eligibility. canSend is false once the pair has no active/settling
  // booking; activeBookingId is the booking a new message is tagged with.
  canSend: boolean;
  activeBookingId?: string;
  // A10 B2: true if the current user has blocked this partner (drives the toggle).
  blockedByMe: boolean;
  updatedAt: string;
}

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

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

// ─── Component ──────────────────────────────────────────────

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // F16: loud failure feedback (send/block/report) + block pending state.
  const [sendError, setSendError] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'customer' | 'cleaner'>('customer');

  // A10 B2b: per-message report UI state
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // A10 B3: compose-from-booking (?bookingId=) + before-send PII warning
  const composeHandled = useRef(false);
  const [showPiiWarning, setShowPiiWarning] = useState(false);

  // Fetch current user session
  useEffect(() => {
    fetch('/api/auth/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const u = data?.id ? data : data?.user;
        if (u?.id) setCurrentUserId(u.id);
        if (u?.role) setCurrentUserRole(u.role === 'CLEANER' ? 'cleaner' : 'customer');
      })
      .catch(() => {});
  }, []);

  // Fetch conversations
  useEffect(() => {
    setLoading(true);
    fetch('/api/messages')
      .then((res) => (res.ok ? res.json() : { conversations: [] }))
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch(() => {
        setConversations([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // A10 B3: compose-from-booking. If arrived via /messages?bookingId=<id>, derive
  // the partner + send-eligibility server-side and open (or synthesize) the pane so
  // a conversation can START from a booking that has no messages yet.
  useEffect(() => {
    if (composeHandled.current || loading || !currentUserId) return;
    const composeBookingId = new URLSearchParams(window.location.search).get('bookingId');
    if (!composeBookingId) return;
    composeHandled.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/messages/compose?bookingId=${composeBookingId}`);
        if (!res.ok) return;
        const c = await res.json();
        setConversations((prev) => {
          if (prev.some((x) => x.id === c.partnerId)) return prev; // already exists
          const synthetic: Conversation = {
            id: c.partnerId,
            participants: [
              {
                id: currentUserId,
                name: 'You',
                avatar: '',
                role: c.partnerRole === 'cleaner' ? 'customer' : 'cleaner',
              },
              { id: c.partnerId, name: c.partnerName, avatar: '', role: c.partnerRole },
            ],
            lastMessage: {
              id: 'pending',
              conversationId: c.partnerId,
              senderId: currentUserId,
              content: '',
              read: true,
              createdAt: new Date().toISOString(),
            },
            unreadCount: 0,
            canSend: c.canSend,
            activeBookingId: c.bookingId,
            blockedByMe: c.blockedByMe,
            updatedAt: new Date().toISOString(),
          };
          return [synthetic, ...prev];
        });
        setActiveConversationId(c.partnerId);
      } catch {
        // ignore — user can still pick a conversation manually
      }
    })();
  }, [loading, currentUserId]);

  // Fetch messages for active conversation
  const loadMessages = useCallback(async (partnerId: string) => {
    try {
      const res = await fetch(`/api/messages/${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    setShowPiiWarning(false);
    if (activeConversationId) {
      loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);

  function getOtherParticipant(conversation: Conversation): Participant {
    return (
      conversation.participants.find((p) => p.id !== currentUserId) ||
      conversation.participants[1] ||
      conversation.participants[0]
    );
  }

  function handleSendMessage() {
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!messageInput.trim() || !conv || !conv.canSend || !conv.activeBookingId || sending) return;

    // A10 B3: before-send PII warning (non-blocking). If the message looks like it
    // contains contact info, show an interstitial; the user can still "Send anyway".
    if (detectContactInfo(messageInput).any) {
      setShowPiiWarning(true);
      return;
    }
    doSend(conv.activeBookingId);
  }

  async function doSend(bookingId: string) {
    setShowPiiWarning(false);
    setSending(true);
    try {
      // Booking-scoped: send is tagged with the pair's active booking; the server
      // derives the receiver from it (we never send receiverId from the client).
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          content: messageInput.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setMessageInput('');
        setSendError(false);
        // Refresh conversation list to update last message
        const convRes = await fetch('/api/messages');
        if (convRes.ok) {
          const convData = await convRes.json();
          setConversations(convData.conversations || []);
        }
      } else {
        // F16 (R-Messages): failed sends are LOUD — toast + the draft stays in
        // the composer so "Try again" is one tap.
        setSendError(true);
      }
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleBackToList() {
    setActiveConversationId(null);
    setMessages([]);
  }

  async function handleToggleBlock() {
    const conv = conversations.find((c) => c.id === activeConversationId);
    if (!conv) return;
    setBlockBusy(true);
    try {
      const res = await fetch('/api/messages/block', {
        method: conv.blockedByMe ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: conv.id }),
      });
      if (res.ok) {
        // Refresh so canSend / blockedByMe update.
        const convRes = await fetch('/api/messages');
        if (convRes.ok) {
          const convData = await convRes.json();
          setConversations(convData.conversations || []);
        }
      }
    } catch {
      setSendError(true); // reuse the toast — the action didn't go through
    } finally {
      setBlockBusy(false);
    }
  }

  async function submitReport(messageId: string) {
    setReportBusy(true);
    try {
      const res = await fetch('/api/messages/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          reason: reportReason,
          details: reportDetails.trim() || undefined,
        }),
      });
      if (res.ok) {
        setReportedIds((prev) => new Set(prev).add(messageId));
        setReportingId(null);
        setReportDetails('');
      } else {
        setSendError(true);
      }
    } catch {
      setSendError(true);
    } finally {
      setReportBusy(false);
    }
  }

  // ─── Loading State ──────────────────────────────────────

  if (loading) {
    // F16: branded skeleton, not bare text.
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-md space-y-3 px-6">
          <div className="h-14 animate-pulse rounded-xl bg-line" />
          <div className="h-14 animate-pulse rounded-xl bg-line" />
          <div className="h-14 animate-pulse rounded-xl bg-line" />
        </div>
      </div>
    );
  }

  // ─── Empty State ────────────────────────────────────────

  if (conversations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
          <svg
            className="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
            />
          </svg>
        </div>
        <h2 className="font-newsreader text-xl font-semibold text-ink">No messages yet</h2>
        <p className="mt-1 text-sm text-ink-3">
          When you book a cleaner, you can message them here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full border-x border-line">
      {/* ─── Left Panel: Conversation List ─────────────────── */}
      <div
        className={`w-full flex-shrink-0 border-r border-line md:w-80 lg:w-96 ${
          activeConversationId ? 'hidden md:block' : 'block'
        }`}
      >
        {/* Header */}
        <div className="border-b border-line px-4 py-4">
          <Link
            href={currentUserRole === 'cleaner' ? '/cleaner' : '/dashboard'}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-ink-3 transition hover:text-ink"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Back to dashboard
          </Link>
          <h1 className="font-newsreader text-xl font-semibold text-ink">Messages</h1>
        </div>

        {/* Conversation list */}
        <div className="overflow-y-auto" style={{ height: 'calc(100% - 65px)' }}>
          {conversations.map((conversation) => {
            const other = getOtherParticipant(conversation);
            const isActive = conversation.id === activeConversationId;
            const lastMsg = conversation.lastMessage;
            const isOwnMessage = lastMsg.senderId === currentUserId;

            return (
              <ConversationRow
                key={conversation.id}
                initials={getInitials(other.name)}
                name={other.name}
                timeAgo={timeAgo(conversation.updatedAt)}
                preview={lastMsg.content}
                isOwnLast={isOwnMessage}
                unreadCount={conversation.unreadCount}
                isActive={isActive}
                onClick={() => setActiveConversationId(conversation.id)}
              />
            );
          })}
        </div>
      </div>

      {/* ─── Right Panel: Active Conversation ──────────────── */}
      <div className={`flex flex-1 flex-col ${activeConversationId ? 'block' : 'hidden md:flex'}`}>
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              {/* Back button (mobile) */}
              <button
                onClick={handleBackToList}
                className="rounded-lg p-1.5 text-ink-3 transition hover:bg-page md:hidden"
                aria-label="Back to conversations"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5 8.25 12l7.5-7.5"
                  />
                </svg>
              </button>

              <Avatar
                initials={getInitials(getOtherParticipant(activeConversation).name)}
                size="sm"
              />
              <div>
                <h2 className="text-sm font-semibold text-ink">
                  {getOtherParticipant(activeConversation).name}
                </h2>
                <p className="text-xs text-ink-3">
                  {getOtherParticipant(activeConversation).role === 'cleaner'
                    ? 'Cleaner'
                    : 'Customer'}
                </p>
              </div>

              <button
                onClick={handleToggleBlock}
                disabled={blockBusy}
                className="ml-auto rounded-[10px] border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:bg-page disabled:opacity-60"
              >
                {blockBusy ? 'Working…' : activeConversation.blockedByMe ? 'Unblock' : 'Block'}
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-page px-4 py-4">
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwn = message.senderId === currentUserId;

                  return (
                    <MessageBubble
                      key={message.id}
                      content={message.content}
                      time={formatTime(message.createdAt)}
                      isOwn={isOwn}
                    >
                      {/* Report — only on messages you received */}
                      {!isOwn &&
                        (reportedIds.has(message.id) ? (
                          <span className="mt-1 text-[11px] text-ink-3">Reported</span>
                        ) : reportingId === message.id ? (
                          <div className="mt-1 w-full max-w-[75%] rounded-[10px] border border-line bg-surface p-2">
                            <select
                              value={reportReason}
                              onChange={(e) => setReportReason(e.target.value)}
                              className="w-full rounded-[8px] border border-line px-2 py-1 text-xs text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="SPAM">Spam</option>
                              <option value="HARASSMENT">Harassment</option>
                              <option value="OFF_PLATFORM">Off-platform / circumvention</option>
                              <option value="INAPPROPRIATE">Inappropriate</option>
                              <option value="OTHER">Other</option>
                            </select>
                            <textarea
                              value={reportDetails}
                              onChange={(e) => setReportDetails(e.target.value)}
                              rows={2}
                              maxLength={1000}
                              placeholder="Add details (optional)"
                              className="mt-1 w-full rounded-[8px] border border-line px-2 py-1 text-xs text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <div className="mt-1 flex gap-2">
                              <button
                                onClick={() => submitReport(message.id)}
                                disabled={reportBusy}
                                className="rounded-[8px] bg-danger px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                              >
                                {reportBusy ? 'Reporting…' : 'Submit report'}
                              </button>
                              <button
                                onClick={() => setReportingId(null)}
                                className="text-xs text-ink-3 hover:text-ink"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setReportingId(message.id);
                              setReportReason('SPAM');
                              setReportDetails('');
                            }}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-danger"
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.8}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
                              />
                            </svg>
                            Report
                          </button>
                        ))}
                    </MessageBubble>
                  );
                })}
              </div>
            </div>

            {/* Message input — read-only once the pair has no active/settling booking */}
            {activeConversation.canSend ? (
              <div className="border-t border-line bg-surface px-4 py-3">
                {showPiiWarning && (
                  <div className="mb-2 rounded-[10px] border border-warning/25 bg-warning/[0.06] px-3 py-2">
                    <p className="text-xs text-warning">
                      This looks like contact info. Keep conversations and payments on Rena —
                      sharing contact details or paying off-platform isn&rsquo;t allowed and may
                      affect your account.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          const conv = conversations.find((c) => c.id === activeConversationId);
                          if (conv?.activeBookingId) doSend(conv.activeBookingId);
                        }}
                        disabled={sending}
                        className="rounded-[8px] bg-warning px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-warning/90 disabled:opacity-50"
                      >
                        Send anyway
                      </button>
                      <button
                        onClick={() => setShowPiiWarning(false)}
                        className="rounded-[8px] border border-line px-3 py-1 text-xs font-medium text-ink-2 transition-colors hover:bg-page"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  {sendError && (
                    <div className="mb-2 flex items-center justify-between rounded-lg bg-danger/10 px-3 py-2 font-jost text-[13px] text-danger">
                      <span>Message didn&apos;t send — your draft is still here.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSendError(false);
                          handleSendMessage();
                        }}
                        className="ml-3 font-semibold underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 resize-none rounded-[10px] border border-line px-4 py-2.5 text-sm text-ink placeholder-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sending}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-line bg-page px-4 py-4 text-center">
                <p className="text-sm text-ink-3">
                  {activeConversation.blockedByMe
                    ? "You've blocked this person. Unblock to message them again."
                    : 'This conversation is read-only — start a new booking to message again.'}
                </p>
              </div>
            )}
          </>
        ) : (
          /* No conversation selected */
          <div className="hidden flex-1 flex-col items-center justify-center bg-page text-center md:flex">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
              <svg
                className="h-8 w-8 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                />
              </svg>
            </div>
            <h2 className="font-newsreader text-xl font-semibold text-ink">
              Select a conversation
            </h2>
            <p className="mt-1 text-sm text-ink-3">
              Choose a conversation from the list to start messaging.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
