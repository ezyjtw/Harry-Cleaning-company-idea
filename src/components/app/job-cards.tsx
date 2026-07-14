'use client';

// B1: THE shared job-card module for the Rena Pro shell screens. Extracted from
// /app/today so Today and /app/jobs consume ONE source (cards, lifecycle
// actions, helpers) and can never drift. Shell-only surface — imported only by
// /app/* pages, which are served exclusively to the native shell (+ preview).

import Link from 'next/link';

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
  status: string; // lowercase
  duration: number;
}

export const LIFECYCLE_ACTION: Record<string, { label: string; next: string } | undefined> = {
  accepted: { label: "I'm on my way", next: 'EN_ROUTE' },
  confirmed: { label: "I'm on my way", next: 'EN_ROUTE' },
  en_route: { label: 'Start', next: 'IN_PROGRESS' },
  in_progress: { label: 'Complete', next: 'COMPLETED' },
};

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
}: {
  job: AppJob;
  now: number;
  processing: boolean;
  onAdvance: () => void;
}) {
  const action = LIFECYCLE_ACTION[job.status];
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
    <div
      className={`rounded-2xl bg-primary p-5 text-white shadow-sm ${
        warm ? 'ring-2 ring-warning/80' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
          Next · {job.status.replace(/_/g, ' ')}
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
            {serviceLabel(job.serviceType)} · {job.duration}h
          </p>
        </div>
        <p className="shrink-0 font-newsreader text-[28px] font-medium leading-none">
          £{pay(job).toFixed(2)}
        </p>
      </div>

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
    </div>
  );
}

// ── Later / week job: white surface card with hairline ──
export function JobCard({
  job,
  now,
  processing,
  onAdvance,
}: {
  job: AppJob;
  now: number;
  processing: boolean;
  onAdvance: () => void;
}) {
  const action = LIFECYCLE_ACTION[job.status];
  void now;
  const mapsHref = `https://maps.apple.com/?q=${encodeURIComponent(job.fullAddress || job.address)}`;

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
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
            {serviceLabel(job.serviceType)} · {job.duration}h
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-newsreader text-lg font-medium text-ink">£{pay(job).toFixed(2)}</p>
          <span className="mt-1 inline-block rounded-full bg-primary-soft px-2 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">
            {job.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

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
            {serviceLabel(job.serviceType)} · {job.duration}h
          </p>
        </div>
        <p className="shrink-0 font-newsreader text-xl font-medium text-primary">
          £{pay(job).toFixed(2)}
        </p>
      </div>
    </Link>
  );
}
