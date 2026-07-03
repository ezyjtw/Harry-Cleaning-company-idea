'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_STORAGE_KEY = 'rena-chat-messages';
const SESSION_COUNT_KEY = 'rena-chat-message-count';
const MAX_MESSAGES_PER_SESSION = 30;

function loadMessages(): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // sessionStorage full or unavailable
  }
}

function getMessageCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(sessionStorage.getItem(SESSION_COUNT_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementMessageCount(): number {
  const count = getMessageCount() + 1;
  try {
    sessionStorage.setItem(SESSION_COUNT_KEY, String(count));
  } catch {
    // ignore
  }
  return count;
}

export default function AIChatWidget() {
  const pathname = usePathname();
  const isContactPage = pathname === '/contact';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoOpenedRef = useRef(false);

  // Load messages from sessionStorage on mount
  useEffect(() => {
    const stored = loadMessages();
    if (stored.length > 0) {
      setMessages(stored);
    }
  }, []);

  // Auto-open on contact page
  useEffect(() => {
    if (!isContactPage || hasAutoOpenedRef.current) return;
    hasAutoOpenedRef.current = true;
    const timer = setTimeout(() => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 350);
    }, 800);
    return () => clearTimeout(timer);
  }, [isContactPage]);

  // Save messages to sessionStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Rate limiting check
    const count = getMessageCount();
    if (count >= MAX_MESSAGES_PER_SESSION) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "You've reached the message limit for this session. Please refresh the page or contact us directly for more help.",
        },
      ]);
      return;
    }

    incrementMessageCount();

    const userMessage: Message = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Panel */}
      <div
        className={`fixed bottom-20 right-4 z-50 flex flex-col overflow-hidden
          w-[calc(100vw-2rem)] sm:w-[400px] h-[520px]
          transition-all duration-300 ease-in-out origin-bottom-right
          ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-0 opacity-0 pointer-events-none'}
        `}
        style={{ border: '0.5px solid rgba(14,14,12,0.1)', background: '#F7F9FC' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ background: '#1B2A4A' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center font-newsreader text-lg font-medium"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#F7F9FC' }}
            >
              R
            </div>
            <div>
              <h3 className="font-jost text-sm font-normal" style={{ color: '#F7F9FC' }}>
                Rena Assistant
              </h3>
              <p
                className="font-jost text-[10px] uppercase tracking-[0.1em]"
                style={{ color: 'rgba(247,249,252,0.5)' }}
              >
                Online
              </p>
            </div>
          </div>
          <button
            onClick={toggleChat}
            className="p-1.5 transition-colors hover:opacity-70"
            style={{ color: '#F7F9FC' }}
            aria-label="Close chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center mt-10 px-6">
              <p className="font-newsreader text-xl font-medium" style={{ color: '#1B2A4A' }}>
                How can we help?
              </p>
              <p className="mt-2 font-jost text-xs font-light" style={{ color: '#7A8A9E' }}>
                Ask about bookings, pricing, cleaner availability, or any issues with your service.
              </p>
              <div className="mt-6 space-y-2">
                {[
                  'I need help with a booking',
                  'What are your prices?',
                  'I have an issue with a cleaner',
                  'How do I reschedule?',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="block w-full px-4 py-2.5 text-left font-jost text-sm font-light transition hover:bg-cream-2"
                    style={{
                      color: '#1B2A4A',
                      border: '0.5px solid rgba(14,14,12,0.1)',
                      background: '#FFFFFF',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[80%] px-4 py-2.5 font-jost text-sm font-light leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === 'user'
                    ? {
                        background: '#1B2A4A',
                        color: '#F7F9FC',
                        borderRadius: '2px 2px 2px 2px',
                      }
                    : {
                        background: '#FFFFFF',
                        color: '#1B2A4A',
                        border: '0.5px solid rgba(14,14,12,0.1)',
                        borderRadius: '2px 2px 2px 2px',
                      }
                }
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className="px-4 py-3"
                style={{
                  background: '#FFFFFF',
                  border: '0.5px solid rgba(14,14,12,0.1)',
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:0ms]"
                    style={{ background: '#7A8A9E' }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:150ms]"
                    style={{ background: '#7A8A9E' }}
                  />
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:300ms]"
                    style={{ background: '#7A8A9E' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-3" style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 font-jost text-sm font-light focus:outline-none"
              style={{
                color: '#1B2A4A',
                background: '#FFFFFF',
                border: '0.5px solid rgba(14,14,12,0.1)',
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: '#1B2A4A', color: '#F7F9FC' }}
              aria-label="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center transition-all duration-300 hover:opacity-80"
        style={{
          background: '#1B2A4A',
          color: '#F7F9FC',
          border: '0.5px solid rgba(14,14,12,0.1)',
          boxShadow: '0 2px 15px -3px rgba(0, 0, 0, 0.12)',
        }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
    </>
  );
}
