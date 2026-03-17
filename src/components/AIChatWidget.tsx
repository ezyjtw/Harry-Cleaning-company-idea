'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_STORAGE_KEY = 'rena-chat-messages';
const SESSION_COUNT_KEY = 'rena-chat-message-count';
const MAX_MESSAGES_PER_SESSION = 30;
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [_isAnimating, setIsAnimating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proactiveShownRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages from sessionStorage on mount
  useEffect(() => {
    const stored = loadMessages();
    if (stored.length > 0) {
      setMessages(stored);
    }
  }, []);

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

  // Proactive inactivity message
  const showProactiveMessage = useCallback(() => {
    if (proactiveShownRef.current) return;
    proactiveShownRef.current = true;

    const proactiveMsg: Message = {
      role: 'assistant',
      content: "Need help choosing a cleaner? I can show you who's available in your area",
    };

    setMessages((prev) => {
      const updated = [...prev, proactiveMsg];
      saveMessages(updated);
      return updated;
    });

    // Open the chat panel to show the message
    if (!isOpen) {
      setIsAnimating(true);
      setIsOpen(true);
    }
  }, [isOpen]);

  // Reset inactivity timer on any user interaction on the page
  useEffect(() => {
    // Don't set up if proactive message already shown
    if (proactiveShownRef.current) return;

    const resetTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(showProactiveMessage, INACTIVITY_TIMEOUT_MS);
    };

    // Start the timer
    resetTimer();

    // Reset on user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [showProactiveMessage]);

  const toggleChat = () => {
    setIsAnimating(true);
    setIsOpen((prev) => !prev);
    // Focus input when opening
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  };

  const handleAnimationEnd = () => {
    setIsAnimating(false);
  };

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
        className={`fixed bottom-20 right-4 z-50 flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden
          w-[calc(100vw-2rem)] sm:w-[400px] h-[500px]
          transition-all duration-300 ease-in-out origin-bottom-right
          ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-0 opacity-0 pointer-events-none'}
        `}
        onTransitionEnd={handleAnimationEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-brand-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
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
            </div>
            <div>
              <h3 className="font-semibold text-sm">Rena Assistant</h3>
              <p className="text-xs text-white/70">Online</p>
            </div>
          </div>
          <button
            onClick={toggleChat}
            className="p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close chat"
          >
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
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm mt-8">
              <p className="font-medium text-gray-600 mb-1">Welcome to Rena Cleaning Network!</p>
              <p>Ask me about our cleaning services, pricing, or finding a cleaner in your area.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                  ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                  }
                `}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="p-2.5 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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
        className={`fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-all duration-300 flex items-center justify-center hover:scale-110
          ${isOpen ? 'rotate-90' : 'rotate-0'}
        `}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
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
            className="h-6 w-6"
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
