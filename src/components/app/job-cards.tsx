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
  accepted: { label: 'On my way', next: 'EN_ROUTE' },
  confirmed: { label: 'On my way', next: 'EN_ROUTE' },
  en_route: { label: 'Mark complete', next: 'COMPLETED' },
  in_progress: { label: 'Mark complete', next: 'COMPLETED' },
};

// 4.6 state chips: colour lives HERE, never on the primary button —
// Accepted navy-tinted → On the way amber-tinted → ✓ Complete green-tinted.
export function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const onTheWay = s === 'en_route' || s === 'in_progress';
  const complete = s === 'completed' || s === 'reviewed';
  const cls = complete
    ? 'bg-trust/10 text-trust'
    : onTheWay
      ? 'bg-warning/10 text-warning'
      : 'bg-primary-soft text-primary';
  const label = complete ? '✓ Complete' : onTheWay ? 'On the way' : 'Accepted';
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-[0.08em] ${cls}`}
    >
      {label}
    </span>
  );
}

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
      className={`cursor-pointer rounded-2xl bg-primary p-5 text-white shadow-sm transition-opacity active:opacity-90 ${
        warm ? 'ring-2 ring-warning/80' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
          Next ·{' '}
          {['en_route', 'in_progress'].includes(job.status)
            ? 'On the way'
            : job.status.replace(/_/g, ' ')}
        </p>
        {countdown &&
          (warm ? (
            <p className="rounded-full bg-warning px-2.5 py-0.5 font-jost text-[12px] font-semibold text-white">
              {countdown}
            </p>
          ) : (
            <p className="font-jost text-[12px] font-semibold text-white/90">{countdown}</p>
          ))}
      </div>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-newsreader text-[22px] font-semibold leading-tight">
            {job.time} · {job.clientName}
          </p>
          <a
            href={mapsHref}
            className="mt-1 block truncate font-jost text-sm text-white/85 underline"
          >
            {job.address}
          </a>
          <p className="mt-1 font-jost text-[13px] text-white/60">
            {serviceLabel(job.serviceType)} · {job.duration}h{recurringSuffix(job)}
          </p>
        </div>
        <p className="shrink-0 font-newsreader text-[28px] font-medium leading-none">
          £{pay(job).toFixed(2)}
        </p>
      </div>

      {narration(job) && (
        <p className="mt-2 font-jost text-[12.5px] font-light text-white/75">{narration(job)}</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        {action && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={processing}
            className="flex-1 rounded-[10px] bg-white px-4 py-3 font-jost text-sm font-semibold text-primary transition-opacity active:opacity-80 disabled:opacity-50"
          >
            {processing ? 'Updating…' : action.label}
          </button>
        )}
        <Link
          href={`/messages?bookingId=${job.id}`}
          className="rounded-[10px] border border-white/25 px-4 py-3 font-jost text-sm font-medium text-white active:bg-white/10"
        >
          Message
        </Link>
      </div>
      {/* H3: quiet exit, ACCEPTED-family states only */}
      {['accepted', 'confirmed'].includes(job.status) && onCancelled && (
        <CantMakeIt job={job} onCancelled={onCancelled} tone="dark" />
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
  const action = LIFECYCLE_ACTION[job.status];
  const router = useRouter();
  void now;
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
      {/* H104 item 5: every job card clicks through to the job detail. */}
      <Link
        href={`/app/offer/${job.id}`}
        className="mb-1 block font-jost text-[11px] uppercase tracking-[0.08em] text-primary"
      >
        View details →
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-newsreader text-lg font-semibold text-ink">
            {job.time} · {job.clientName}
          </p>
          <a
            href={mapsHref}
            className="mt-0.5 block truncate font-jost text-sm text-primary underline"
          >
            {job.address}
          </a>
          <p className="mt-1 font-jost text-[13px] text-ink-3">
            {serviceLabel(job.serviceType)} · {job.duration}h{recurringSuffix(job)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-newsreader text-lg font-medium text-ink">£{pay(job).toFixed(2)}</p>
          <span className="mt-1 inline-block">
            <StatusChip status={job.status} />
          </span>
        </div>
      </div>

      {narration(job) && (
        <p className="mt-2 font-jost text-[12.5px] font-light text-ink-3">{narration(job)}</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        {action && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={processing}
            className="flex-1 rounded-[10px] bg-primary px-4 py-2.5 font-jost text-sm font-medium text-white transition-colors hover:bg-primary-hover active:opacity-80 disabled:opacity-50"
          >
            {processing ? 'Updating…' : action.label}
          </button>
        )}
        <Link
          href={`/messages?bookingId=${job.id}`}
          className="rounded-[10px] border border-line px-4 py-2.5 font-jost text-sm font-medium text-ink-2 active:bg-page"
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
      <p className="shrink-0 font-newsreader text-base font-medium text-ink">
        £{pay(job).toFixed(2)}
      </p>
    </div>
  );
}

// ── B1: pending offer card — surfaces at the top of the Jobs agenda ──
export function OfferCard({ job }: { job: AppJob }) {
  return (
    <Link
      href={`/app/offer/${job.id}`}
      className="block rounded-2xl border-2 border-primary bg-primary-soft p-4 active:opacity-90"
    >
      <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
        New offer · respond now
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-newsreader text-lg font-semibold text-ink">
            {job.date} · {job.time}
          </p>
          <p className="mt-0.5 truncate font-jost text-sm text-ink-2">{job.address}</p>
          <p className="mt-1 font-jost text-[13px] text-ink-3">
            {serviceLabel(job.serviceType)} · {job.duration}h{recurringSuffix(job)}
          </p>
        </div>
        <p className="shrink-0 font-newsreader text-xl font-medium text-primary">
          £{pay(job).toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
