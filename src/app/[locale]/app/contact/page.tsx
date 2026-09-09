'use client';

// Contact Rena (James-ruled P3): the smallest honest mechanism — an L2 screen
// posting the EXISTING support intake (POST /api/contact: validated, rate-
// limited, support-alert email to the team + confirmation email to the sender).
// Name/email prefill from the session profile; subjects are the server's own
// valid set minus the customer-only "Cleaner Issue"; the honest closing beat is
// stated up front and on success. No schema change, no new server surface —
// the real support-thread mechanism is ledgered with the native chat rebuild.

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';

// Wire values MUST stay within the server's VALID_SUBJECTS.
const SUBJECTS = ['General Enquiry', 'Booking Issue', 'Billing', 'Other'] as const;

export default function ContactRenaPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('General Enquiry');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setName((v) => v || d.name);
        if (d?.email) setEmail((v) => v || d.email);
      })
      .catch(() => {});
  }, []);

  const send = async () => {
    if (sending) return;
    if (message.trim().length < 10) {
      setError('Tell us a little more — at least a sentence.');
      return;
    }
    haptic('medium');
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        throw new Error('Too many messages just now — please try again in a little while.');
      }
      if (!res.ok) {
        throw new Error(data?.error || 'Could not send your message — try again.');
      }
      haptic('success');
      setSent(true);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Could not send your message — try again.');
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    'w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 font-jost text-[15px] text-ink focus:outline-none focus:ring-2 focus:ring-primary/20';

  if (sent) {
    return (
      <div>
        <header className="mb-5 flex items-center gap-2">
          <BackButton onBack={() => router.back()} />
          <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">
            Contact Rena
          </h1>
        </header>
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="mt-4 font-jost text-lg font-semibold text-ink">Message Sent</p>
          <p className="mt-1.5 font-jost text-sm text-ink-2">
            We reply by email within 24 hours — a confirmation is on its way to {email || 'you'}.
          </p>
          <button
            type="button"
            onClick={() => {
              haptic('light');
              router.back();
            }}
            className="mt-5 rounded-[10px] bg-primary px-5 py-2.5 font-jost text-sm font-medium text-white active:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5 flex items-center gap-2">
        <BackButton onBack={() => router.back()} />
        <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">Contact Rena</h1>
      </header>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-jost text-[13px] text-ink-2">
          Tell us what&apos;s up — the team reads every message and replies by email within 24
          hours.
        </p>

        <p className="mb-1.5 mt-4 font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          Subject
        </p>
        <div className="flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                haptic('light');
                setSubject(s);
              }}
              aria-pressed={subject === s}
              className={`rounded-full border px-3.5 py-2 font-jost text-[13px] font-medium transition-colors ${
                subject === s
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-page text-ink-2'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-4 font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
          Message
        </p>
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setError(null);
          }}
          rows={5}
          placeholder="What can we help with?"
          className={`${inputCls} resize-none leading-relaxed`}
          data-testid="contact-message"
        />

        {(name || email) && (
          <p className="mt-2 font-jost text-[12px] text-ink-3" data-testid="contact-reply-to">
            Replies go to {email || 'your account email'}.
          </p>
        )}

        {error && <p className="mt-3 font-jost text-[13px] text-danger">{error}</p>}

        <button
          type="button"
          onClick={send}
          disabled={sending || message.trim().length === 0}
          data-testid="contact-send"
          className="mt-4 w-full rounded-[12px] bg-primary px-4 py-3 font-jost text-sm font-semibold uppercase tracking-[0.04em] text-white active:opacity-80 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        haptic('light');
        onBack();
      }}
      className="rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}
