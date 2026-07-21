'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import BookingStatusChip from '@/components/BookingStatusChip';
import { serviceLabelFromSlug } from '@/lib/constants/services';

// H104 item 5: the job's home — every cleaner job row/card clicks through to
// here. Built ENTIRELY from the portal's existing vocabulary: surface cards
// (rounded-xl border-line), Newsreader headings, Jost body, the shared
// BookingStatusChip, and brand-navy primary actions (Mark complete stays
// navy — the banked ruling). Guidance renders post-accept only; the API is
// the authz (assigned-cleaner-only fields), this page just draws what it gets.

interface JobDetail {
  id: string;
  status: string;
  assigned: boolean;
  clientName: string;
  address: string;
  fullAddress?: string;
  postcode: string | null;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  cleanerEarnings: number;
  notes?: string | null;
  keyAccess?: string;
  keyAccessNote?: string;
  bedrooms?: number;
  extras: string[];
}

const KEY_ACCESS_LABELS: Record<string, string> = {
  'i-will-be-home': 'The customer will be home to let you in',
  'key-under-mat': 'Key left out (under mat)',
  lockbox: 'Lockbox on site',
  'with-concierge': 'Key with concierge/reception',
  other: 'Other arrangement — see note',
};

// H104: the focus line rides Booking.notes as a "Focus: …" line — split it
// back out so "What to focus on" and "Notes" section cleanly.
function splitNotes(notes: string | null | undefined): {
  focus: string | null;
  rest: string | null;
} {
  if (!notes) return { focus: null, rest: null };
  const lines = notes.split('\n');
  const focusIdx = lines.findIndex((l) => l.trim().startsWith('Focus:'));
  if (focusIdx === -1) return { focus: null, rest: notes.trim() || null };
  const focus = lines[focusIdx].trim().replace(/^Focus:\s*/, '');
  const rest = [...lines.slice(0, focusIdx), ...lines.slice(focusIdx + 1)].join('\n').trim();
  return { focus: focus || null, rest: rest || null };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="font-jost text-sm font-light text-ink-3">{label}</span>
      <span className="font-jost text-sm text-ink text-right">{value}</span>
    </div>
  );
}

export default function CleanerJobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cleaner/jobs/${params.id}`);
    if (!res.ok) {
      setError(res.status === 404 ? 'Job not found.' : 'Could not load this job.');
      return;
    }
    setJob(await res.json());
  }, [params.id]);

  useEffect(() => {
    load().catch(() => setError('Could not load this job.'));
  }, [load]);

  async function transition(status: string) {
    setActing(true);
    try {
      const res = await fetch(`/api/cleaner/jobs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
      else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Action failed — try again.');
      }
    } finally {
      setActing(false);
    }
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="rounded-xl border border-danger/20 bg-danger/[0.06] p-8 text-center">
          <p className="font-jost text-sm text-danger">{error}</p>
        </div>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-56 rounded-lg bg-ink/5" />
          <div className="h-40 rounded-xl bg-ink/5" />
          <div className="h-40 rounded-xl bg-ink/5" />
        </div>
      </div>
    );
  }

  const { focus, rest } = splitNotes(job.notes);
  const dateLabel = new Date(`${job.date}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  // 4.6 three-action law: Accept → On my way → Mark complete. Navy, always.
  const action =
    job.status === 'CONFIRMED' || job.status === 'AWAITING_CLEANER'
      ? { label: 'Accept job', to: 'ACCEPTED' }
      : job.status === 'ACCEPTED'
        ? { label: 'On my way', to: 'EN_ROUTE' }
        : job.status === 'EN_ROUTE' || job.status === 'IN_PROGRESS'
          ? { label: 'Mark complete', to: 'COMPLETED' }
          : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="font-jost text-[12px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink transition"
      >
        ← Back
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">
          {serviceLabelFromSlug(job.serviceType)} for {job.clientName}
        </h1>
        <BookingStatusChip rawStatus={job.status} />
      </div>

      <div className="mt-5 space-y-4">
        <Section title="When">
          <Row label="Date" value={dateLabel} />
          <Row label="Time" value={job.time} />
          <Row label="Duration" value={`${job.duration} hours`} />
        </Section>

        <Section title="Where">
          <p className="font-jost text-sm text-ink">
            {job.assigned && job.fullAddress ? job.fullAddress : (job.postcode ?? job.address)}
          </p>
          {!job.assigned && (
            <p className="mt-1 font-jost text-[12px] font-light text-ink-3">
              Full address is shown once you accept.
            </p>
          )}
        </Section>

        <Section title="What">
          <Row label="Service" value={serviceLabelFromSlug(job.serviceType)} />
          {typeof job.bedrooms === 'number' && (
            <Row label="Property" value={`${job.bedrooms} bed`} />
          )}
          {job.extras.length > 0 && <Row label="Extras" value={job.extras.join(', ')} />}
        </Section>

        {job.assigned ? (
          (job.keyAccess || focus || rest) && (
            <Section title="Customer guidance">
              {job.keyAccess && (
                <div className="rounded-lg bg-page p-3">
                  <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                    Getting in
                  </p>
                  <p className="mt-1 font-jost text-sm text-ink">
                    {KEY_ACCESS_LABELS[job.keyAccess] ?? job.keyAccess}
                  </p>
                  {job.keyAccessNote && (
                    <p className="mt-1 font-jost text-sm text-ink-2">{job.keyAccessNote}</p>
                  )}
                </div>
              )}
              {focus && (
                <div className="mt-3 rounded-lg bg-page p-3">
                  <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                    What to focus on
                  </p>
                  <p className="mt-1 font-jost text-sm text-ink-2">{focus}</p>
                </div>
              )}
              {rest && (
                <div className="mt-3 rounded-lg bg-page p-3">
                  <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                    Notes
                  </p>
                  <p className="mt-1 font-jost text-sm text-ink-2 whitespace-pre-line">{rest}</p>
                </div>
              )}
            </Section>
          )
        ) : (
          <Section title="Customer guidance">
            <p className="font-jost text-sm font-light text-ink-3">
              Customer notes and entry details are shown once you accept.
            </p>
          </Section>
        )}

        <Section title="Your earnings">
          {/* Net-first law: the cleaner's OWN figure, never the customer total. */}
          <p className="font-newsreader text-2xl font-semibold text-ink">
            You earn £{job.cleanerEarnings.toFixed(2)}
          </p>
        </Section>

        {action && (
          <button
            onClick={() => transition(action.to)}
            disabled={acting}
            className="w-full rounded-[10px] bg-primary py-3 font-jost text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {acting ? 'Working…' : action.label}
          </button>
        )}
      </div>
    </div>
  );
}
