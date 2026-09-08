'use client';

// B1: THE shared job-card module for the Rena Pro shell screens. Extracted from
// /app/today so Today and /app/jobs consume ONE source (cards, lifecycle
// actions, helpers) and can never drift. Shell-only surface — imported only by
// /app/* pages, which are served exclusively to the native shell (+ preview).

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// F24.1: recurring occurrences are visibly recurring on the shell too.
function recurringSuffix(job: { recurringFrequency?: string | null }): string {
  if (!job.recurringFrequency) return '';
  return ` · Regular clean (${job.recurringFrequency === 'WEEKLY' ? 'weekly' : 'every two weeks'})`;
}

export interface AppJob {
  id: string;
  clientName: string;
  address: string;
  fullAddress?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  serviceType: string;
  cleanerEarnings: number;
  viewerEarnings: number | null;
  // F24.1: non-null = a recurring occurrence (WEEKLY | FORTNIGHTLY).
  recurringFrequency?: string | null;
  status: string; // lowercase
  duration: number;
}

// 4.6 (James-ruled): three cleaner actions only — Accept (at the offer) →
// "On my way" → "Mark complete". Start-job is gone; legacy in_progress rows
// still get a working "Mark complete" so nothing strands mid-flight.
export const LIFECYCLE_ACTION: Record<string, { label: string; next: string } | undefined> = {
  accepted: { label: 'ON MY WAY', next: 'EN_ROUTE' },
  confirmed: { label: 'ON MY WAY', next: 'EN_ROUTE' },
  en_route: { label: 'MARK COMPLETE', next: 'COMPLETED' },
  in_progress: { label: 'MARK COMPLETE', next: 'COMPLETED' },
};

// Pro Navy law: status chips died — state lives in the button and row style.

/** 4.6 meta narration — the card states the consequence of the last tap. */
export function narration(job: AppJob): string | null {
  const s = job.status.toLowerCase();
  if (s === 'en_route' || s === 'in_progress') {
    return `${job.clientName}'s been told you're coming`;
  }
  if (s === 'completed' || s === 'reviewed') {
    return `£${pay(job).toFixed(2)} releasing to you after the review window`;
  }
  return null;
}

/** H3: quiet cancel entry — ACCEPTED state only, never competing with the
 *  primary. Opens a consequences-first confirm; the PATCH CANCELLED path is
 *  the existing one (paid → CLEANER_CANCELLED → M3 rescue for the customer). */
export function CantMakeIt({
  job,
  onCancelled,
  tone = 'light',
}: {
  job: AppJob;
  onCancelled: () => void;
  /** 'dark' for the navy hero card — keeps the quiet link legible. */
  tone?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/cleaner/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'CANCELLED',
          cancellationReason: reason.trim() || 'Cancelled by cleaner',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Couldn't cancel — please try again.");
        return;
      }
      haptic('error');
      setOpen(false);
      onCancelled();
    } catch {
      setError("Couldn't cancel — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-2 block w-full text-center font-jost text-[12px] font-light underline underline-offset-2 ${
          tone === 'dark' ? 'text-white/60 active:text-white' : 'text-ink-3 active:text-ink-2'
        }`}
      >
        Can&apos;t make this job?
      </button>
    );
  }
  return (
    <div
      className="mt-3 rounded-[10px] border border-danger/25 bg-surface p-3"
      data-testid="cant-make-it-confirm"
      data-card-interactive
    >
      <p className="font-jost text-[13px] leading-relaxed text-ink-2">
        Cancel this job? {job.clientName} will be told straight away and offered a full refund or a
        free rebooking with another cleaner. This cancellation will affect your completion rate —
        only cancel if you genuinely can&apos;t make it.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Tell us why (optional — shared with Rena, not the customer)"
        className="mt-2 w-full rounded-[8px] border border-line bg-page px-3 py-2 font-jost text-[13px] text-ink placeholder:text-ink-3/60 focus:outline-none focus:ring-1 focus:ring-danger/40"
      />
      {error && <p className="mt-1 font-jost text-[12px] text-danger">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-[10px] bg-danger px-3 py-2 font-jost text-[13px] font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Cancelling…' : 'Cancel this job'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="rounded-[10px] border border-line px-3 py-2 font-jost text-[13px] font-medium text-ink-2"
        >
          I can make it
        </button>
      </div>
    </div>
  );
}

// Native-shell haptic bridge. No-op in a normal browser (ReactNativeWebView is
// undefined) — so this changes nothing on the website.
export function haptic(style: 'light' | 'medium' | 'success' | 'error') {
  (
    window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }
  ).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'haptic', style }));
}

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function pay(job: AppJob): number {
  return job.viewerEarnings ?? job.cleanerEarnings;
}

export function minutesUntilStart(dateIso: string, time: string): number | null {
  const [h, m] = time.split(':').map(Number);
  const start = new Date(`${dateIso}T00:00:00`);
  start.setHours(h || 0, m || 0, 0, 0);
  const diffMs = start.getTime() - Date.now();
  if (diffMs <= 0) return null;
  return Math.round(diffMs / 60000);
}

export function startsInLabel(dateIso: string, time: string): string | null {
  const mins = minutesUntilStart(dateIso, time);
  if (mins === null) return null;
  if (mins < 60) return `Starts in ${mins} min`;
  return `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function serviceLabel(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── NEXT job: navy ink hero card ──
export function HeroJob({
  job,
  now,
  processing,
  onAdvance,
  onCancelled,
}: {
  job: AppJob;
  now: number;
  processing: boolean;
  onAdvance: () => void;
  onCancelled?: () => void;
}) {
  const action = LIFECYCLE_ACTION[job.status];
  const router = useRouter();
  void now; // referenced so the hero re-renders on the countdown tick
  const countdown = startsInLabel(job.date, job.time);
  // C3: T-30 warm state — inside half an hour of the start the hero warms up
  // (amber ring + amber countdown chip) so "you should be moving" reads at a
  // glance. Only before the job starts; once it's underway the state chip is
  // the story.
  const minsToStart = minutesUntilStart(job.date, job.time);
  const warm = minsToStart !== null && minsToStart <= 30;
  const mapsHref = `https://maps.apple.com/?q=${encodeURIComponent(job.fullAddress || job.address)}`;

  return (
    // F3: the WHOLE card is the click target for the job detail. Inner
    // interactive elements (lifecycle button, Message, map link, Can't-make-it)
    // always win: the guard bails when the tap landed on any button/a ancestor —
    // the same layering as stopPropagation on every control, but unmissable.
    <div
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'button, a, input, textarea, select, label, [data-card-interactive]'
          )
        )
          return;
        router.push(`/app/offer/${job.id}`);
      }}
      className={`cursor-pointer rounded-2xl border border-line bg-surface p-5 shadow-sm transition-colors active:bg-page ${
        warm ? 'ring-2 ring-warning/80' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          Next
        </p>
        {countdown &&
          (warm ? (
            <p className="rounded-full bg-warning px-2.5 py-0.5 font-jost text-[12px] font-semibold text-white">
              {countdown}
            </p>
          ) : (
            <p className="font-jost text-[12px] font-semibold text-ink-2">{countdown}</p>
          ))}
      </div>

      {/* Pro Navy law: numbers are the heroes — time bold navy left, pay bold
          teal right; one grey supporting line beneath. */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="font-jost text-[26px] font-semibold leading-tight text-primary">{job.time}</p>
        <p className="shrink-0 text-right font-jost text-[22px] font-semibold leading-tight text-teal">
          £{pay(job).toFixed(2)}
        </p>
      </div>
      <p className="mt-1 truncate font-jost text-sm text-ink-2">
        {job.clientName} · {serviceLabel(job.serviceType)} · {job.duration}h{recurringSuffix(job)} ·{' '}
        <a href={mapsHref} className="underline decoration-line underline-offset-2">
          {job.address}
        </a>
      </p>

      {narration(job) && (
        <p className="mt-2 font-jost text-[12.5px] font-light text-ink-3">{narration(job)}</p>
      )}

      {action && (
        <button
          type="button"
          onClick={onAdvance}
          disabled={processing}
          className="mt-4 w-full rounded-[10px] bg-primary px-4 py-3 font-jost text-sm font-semibold uppercase tracking-[0.1em] text-white transition-colors hover:bg-primary-hover active:opacity-80 disabled:opacity-50"
        >
          {processing ? 'UPDATING…' : action.label}
        </button>
      )}
      <div className="mt-2 flex items-center justify-center gap-4">
        <Link
          href={`/messages?bookingId=${job.id}`}
          className="font-jost text-[12px] font-medium text-ink-2 underline underline-offset-2 active:text-ink"
        >
          Message
        </Link>
      </div>
      {/* H3: quiet exit, ACCEPTED-family states only */}
      {['accepted', 'confirmed'].includes(job.status) && onCancelled && (
        <CantMakeIt job={job} onCancelled={onCancelled} />
      )}
    </div>
  );
}

// ── Later / week job: white surface card with hairline ──
export function JobCard({
  job,
  now,
  processing,
  onAdvance,
  onCancelled,
}: {
  job: AppJob;
  now: number;
  processing: boolean;
  onAdvance: () => void;
  onCancelled?: () => void;
}) {
  const router = useRouter();
  void now;
  void processing;
  void onAdvance;
  const mapsHref = `https://maps.apple.com/?q=${encodeURIComponent(job.fullAddress || job.address)}`;

  return (
    // F3: whole-card click target; inner buttons/links win via the ancestor guard.
    <div
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            'button, a, input, textarea, select, label, [data-card-interactive]'
          )
        )
          return;
        router.push(`/app/offer/${job.id}`);
      }}
      className="cursor-pointer rounded-2xl border border-line bg-surface p-4 transition-colors active:bg-page"
    >
      {/* Pro Navy law: same top row on every variant — time bold navy left,
          pay bold teal right; one grey supporting line. Non-hero upcoming
          cards carry NO button (the whole card clicks through, H104/F3). */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-jost text-[20px] font-semibold leading-tight text-primary">{job.time}</p>
        <p className="shrink-0 text-right font-jost text-[18px] font-semibold leading-tight text-teal">
          £{pay(job).toFixed(2)}
        </p>
      </div>
      <p className="mt-1 truncate font-jost text-sm text-ink-2">
        {job.clientName} · {serviceLabel(job.serviceType)} · {job.duration}h{recurringSuffix(job)} ·{' '}
        <a href={mapsHref} className="underline decoration-line underline-offset-2">
          {job.address}
        </a>
      </p>

      {narration(job) && (
        <p className="mt-2 font-jost text-[12.5px] font-light text-ink-3">{narration(job)}</p>
      )}
      {/* H3: quiet exit, ACCEPTED-family states only */}
      {['accepted', 'confirmed'].includes(job.status) && onCancelled && (
        <CantMakeIt job={job} onCancelled={onCancelled} />
      )}
    </div>
  );
}

// ── C3: completed job as a single-line receipt ──
export function ReceiptRow({ job }: { job: AppJob }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        <svg
          className="h-4 w-4 shrink-0 text-trust"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="truncate font-jost text-sm text-ink-2">
          {job.time} · {job.clientName}
        </p>
      </div>
      <p className="shrink-0 font-jost text-base font-semibold text-teal">£{pay(job).toFixed(2)}</p>
    </div>
  );
}

// ── B1: pending offer card — surfaces at the top of the Jobs agenda ──
export function OfferCard({ job }: { job: AppJob }) {
  return (
    <Link
      href={`/app/offer/${job.id}`}
      className="block rounded-2xl border-2 border-primary bg-surface p-4 active:opacity-90"
    >
      <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
        NEW OFFER · RESPOND NOW
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="font-jost text-[20px] font-semibold leading-tight text-primary">
          {new Date(`${job.date}T00:00:00`).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}{' '}
          · {job.time}
        </p>
        <p className="shrink-0 text-right font-jost text-[18px] font-semibold leading-tight text-teal">
          £{pay(job).toFixed(2)}
        </p>
      </div>
      <p className="mt-1 truncate font-jost text-sm text-ink-2">
        {serviceLabel(job.serviceType)} · {job.duration}h{recurringSuffix(job)} · {job.address}
      </p>
    </Link>
  );
}
