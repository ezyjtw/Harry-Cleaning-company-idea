'use client';

import type { ReactNode } from 'react';

/** Initials avatar — navy on primary-soft. */
export function Avatar({ initials, size = 'md' }: { initials: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-10 w-10' : 'h-12 w-12';
  return (
    <div
      className={`flex ${dim} items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary`}
    >
      {initials}
    </div>
  );
}

/** A single conversation in the left list. Presentational — the caller owns
 *  selection state and the click handler. */
export function ConversationRow({
  initials,
  name,
  timeAgo,
  preview,
  isOwnLast,
  unreadCount,
  isActive,
  onClick,
}: {
  initials: string;
  name: string;
  timeAgo: string;
  preview: string;
  isOwnLast: boolean;
  unreadCount: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const unread = unreadCount > 0;
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-page ${
        isActive ? 'bg-primary-soft' : unread ? 'bg-primary-soft/40' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar initials={initials} />
        {unread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`truncate text-sm text-ink ${unread ? 'font-semibold' : 'font-medium'}`}>
            {name}
          </span>
          <span className="flex-shrink-0 text-xs text-ink-3">{timeAgo}</span>
        </div>
        <p
          className={`mt-0.5 truncate text-sm ${unread ? 'font-medium text-ink-2' : 'text-ink-3'}`}
        >
          {isOwnLast ? 'You: ' : ''}
          {preview}
        </p>
      </div>
    </button>
  );
}

/** A chat bubble. Own = primary-soft/ink on the right with a squared inner
 *  corner; other = surface/hairline on the left. `children` lets the caller
 *  append per-message affordances (e.g. a report control) below the bubble. */
export function MessageBubble({
  content,
  time,
  isOwn,
  children,
}: {
  content: string;
  time: string;
  isOwn: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
          isOwn
            ? 'rounded-br-md bg-primary-soft text-ink'
            : 'rounded-bl-md border border-line bg-surface text-ink'
        }`}
      >
        <p className="text-sm leading-relaxed">{content}</p>
        <p className="mt-1 text-right text-xs text-ink-3">{time}</p>
      </div>
      {children}
    </div>
  );
}
