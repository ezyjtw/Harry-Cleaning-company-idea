'use client';

// The chat's info sheet (UGC report + block, James-ordered, both roles, both
// surfaces): who you are talking to, the Report door, the Block / Unblock
// door with honest copy, and the standing contact line. A block stops
// messages both ways and changes who reaches whom from now on; any booking
// the pair already has carries on as normal, with its own payments,
// cancellations and support, and the sheet says so.

import { useState } from 'react';

import CleanerAvatar from '@/components/CleanerAvatar';
import ReportSheet from '@/components/ReportSheet';
import { SUPPORT_EMAIL } from '@/lib/reports';

interface Props {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  partnerRole: 'customer' | 'cleaner';
  contextLine: string | null;
  blockedByMe: boolean;
  blockBusy: boolean;
  onToggleBlock: () => void;
  onClose: () => void;
}

export default function ConversationInfoSheet({
  partnerId,
  partnerName,
  partnerAvatar,
  partnerRole,
  contextLine,
  blockedByMe,
  blockBusy,
  onToggleBlock,
  onClose,
}: Props) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const first = partnerName.split(' ')[0] || partnerName;
  // What a block means for THIS viewer, in their own words.
  const reachLine =
    partnerRole === 'cleaner'
      ? `${first} will no longer appear when you browse cleaners.`
      : `You will no longer receive booking offers from ${first}.`;

  if (reporting) {
    return (
      <ReportSheet
        target="CONVERSATION"
        partnerId={partnerId}
        onClose={() => setReporting(false)}
        onReported={() => setReported(true)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40"
      role="dialog"
      aria-modal="true"
      aria-label="Conversation info"
      data-testid="msg-info-sheet"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <CleanerAvatar photo={partnerAvatar} name={partnerName} size={44} />
          <div className="min-w-0">
            <p className="truncate font-jost text-[16px] font-semibold text-ink">{partnerName}</p>
            <p className="truncate font-jost text-[12px] text-ink-3">
              {contextLine ?? (partnerRole === 'cleaner' ? 'Cleaner' : 'Customer')}
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-line rounded-[12px] border border-line bg-surface">
          <button
            type="button"
            onClick={() => setReporting(true)}
            disabled={reported}
            data-testid="msg-report-conversation"
            className="flex w-full items-center justify-between px-4 py-3 text-left font-jost text-sm font-medium text-ink active:bg-page disabled:opacity-60"
          >
            <span>Report this conversation</span>
            <span className="font-jost text-[12px] text-ink-3">{reported ? 'Reported' : '›'}</span>
          </button>
          {!confirmBlock ? (
            <button
              type="button"
              onClick={() => (blockedByMe ? onToggleBlock() : setConfirmBlock(true))}
              disabled={blockBusy}
              data-testid="msg-block-toggle"
              className="flex w-full items-center justify-between px-4 py-3 text-left font-jost text-sm font-medium text-ink active:bg-page disabled:opacity-60"
            >
              <span>{blockedByMe ? `Unblock ${first}` : `Block ${first}`}</span>
              <span className="font-jost text-[12px] text-ink-3">{blockBusy ? '…' : '›'}</span>
            </button>
          ) : (
            <div className="px-4 py-3" data-testid="msg-block-confirm">
              <p className="font-jost text-sm font-medium text-ink">Block {first}?</p>
              <p className="mt-1 font-jost text-[13px] leading-relaxed text-ink-3">
                Messages stop both ways. {reachLine} Any booking you already have together carries
                on as normal, with its own payments, cancellations and support. You can unblock from
                here at any time.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmBlock(false);
                    onToggleBlock();
                  }}
                  disabled={blockBusy}
                  data-testid="msg-block-confirm-yes"
                  className="rounded-[10px] bg-primary px-4 py-2 font-jost text-[13px] font-semibold uppercase tracking-[0.08em] text-white active:opacity-80 disabled:opacity-50"
                >
                  {blockBusy ? 'Blocking…' : 'Block'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBlock(false)}
                  className="rounded-[10px] px-4 py-2 font-jost text-[13px] font-medium text-ink-3"
                >
                  Keep talking
                </button>
              </div>
            </div>
          )}
        </div>

        {blockedByMe && (
          <p className="mt-2 font-jost text-[12px] text-ink-3" data-testid="msg-blocked-note">
            You have blocked {first}. Messages are off both ways. Any booking you already have
            together carries on as normal.
          </p>
        )}

        <p className="mt-4 font-jost text-[12px] text-ink-3">
          Need Rena?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-testid="msg-support-line"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-[12px] px-4 py-3 font-jost text-sm font-medium text-ink-3"
        >
          Close
        </button>
      </div>
    </div>
  );
}
