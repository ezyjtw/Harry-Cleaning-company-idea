'use client';

// R12 Lane 4 (James-ruled, approved mockup binding): the checklist IS the
// unverified cleaner's homepage in the Pro shell. State 1 (pre-submission):
// done items quiet with green ticks, blocking items navy-ringed with UPLOAD
// and SET UP doors into the existing upload and Stripe rooms, plus the
// optional Bring your reviews with you row. State 2 (everything submitted):
// the same checklist in place, items wearing Reviewing, with the
// while-you-wait doors. A declined item returns to needs-action with the
// admin's reason where one exists, never a dead end. Availability and Rates
// stay fully live throughout; only successful verification replaces this
// room with the real Today.

import Link from 'next/link';
import { useEffect, useState } from 'react';

type DocStatus = 'missing' | 'reviewing' | 'approved' | 'declined';

interface ChecklistData {
  documents: Record<string, DocStatus>;
  rejectedDocuments: { type: string; reason: string | null }[];
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  profileComplete: boolean;
  importedReviewCount: number;
  verified: boolean;
  insuranceVerified: boolean;
}

type ItemState = 'done' | 'reviewing' | 'action';

interface Item {
  key: string;
  title: string;
  state: ItemState;
  doorLabel: string;
  doorHref: string;
  reason?: string | null;
  sub?: string;
}

function Tick() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15">
      <svg
        className="h-3.5 w-3.5 text-success"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  );
}

function ItemRow({ item }: { item: Item }) {
  if (item.state === 'done') {
    return (
      <div
        className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5"
        data-testid={`vc-${item.key}`}
      >
        <Tick />
        <span className="font-jost text-[14px] text-ink-2">{item.title}</span>
      </div>
    );
  }
  if (item.state === 'reviewing') {
    return (
      <div
        className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5"
        data-testid={`vc-${item.key}`}
      >
        <span className="font-jost text-[14px] font-medium text-ink">{item.title}</span>
        <span className="rounded-full bg-page px-2.5 py-1 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          Reviewing
        </span>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl border-2 border-primary/50 bg-surface px-4 py-3.5"
      data-testid={`vc-${item.key}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-jost text-[14px] font-semibold text-ink">{item.title}</span>
        <Link
          href={item.doorHref}
          className="rounded-[10px] bg-primary px-3.5 py-1.5 font-jost text-[12px] font-semibold text-white"
          data-testid={`vc-${item.key}-door`}
        >
          {item.doorLabel}
        </Link>
      </div>
      {item.reason && (
        <p className="mt-2 font-jost text-[12px] text-danger">Not accepted: {item.reason}</p>
      )}
      {item.sub && !item.reason && (
        <p className="mt-2 font-jost text-[12px] text-ink-3">{item.sub}</p>
      )}
    </div>
  );
}

export default function VerificationChecklist({ firstName }: { firstName: string | null }) {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/cleaner/dashboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.profile) return setFailed(true);
        const p = d.profile;
        setData({
          documents: p.documents || {},
          rejectedDocuments: p.rejectedDocuments || [],
          stripeChargesEnabled: !!p.stripeChargesEnabled,
          stripePayoutsEnabled: !!p.stripePayoutsEnabled,
          profileComplete: !!p.profileComplete,
          importedReviewCount: p.importedReviewCount || 0,
          verified: !!p.verified,
          insuranceVerified: !!p.insuranceVerified,
        });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="font-jost text-sm text-ink-2">
          Could not load your setup status. Check your connection and pull to refresh.
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const reason = (type: string) =>
    data.rejectedDocuments.find((r) => r.type === type)?.reason ?? null;

  const docState = (s: DocStatus | undefined): ItemState =>
    s === 'approved' ? 'done' : s === 'reviewing' ? 'reviewing' : 'action';

  const idWorst: DocStatus = data.verified
    ? 'approved'
    : ((['declined', 'missing', 'reviewing'] as DocStatus[]).find(
        (s) => data.documents.photo_id === s || data.documents.right_to_work === s
      ) ?? 'approved');

  const items: Item[] = [
    {
      key: 'identity',
      title: 'Identity documents',
      state: data.verified ? 'done' : docState(idWorst),
      doorLabel: 'UPLOAD',
      doorHref: '/app/documents',
      reason: reason('photo_id') || reason('right_to_work'),
      sub: 'Photo ID and right to work',
    },
    {
      key: 'insurance',
      title: 'Public liability insurance',
      state: data.insuranceVerified ? 'done' : docState(data.documents.insurance),
      doorLabel: 'UPLOAD',
      doorHref: '/app/documents',
      reason: reason('insurance'),
    },
    {
      key: 'payments',
      title: 'Getting paid',
      state: data.stripeChargesEnabled && data.stripePayoutsEnabled ? 'done' : 'action',
      doorLabel: 'SET UP',
      doorHref: '/cleaner/stripe/connect',
      sub: 'Connect your payout account',
    },
    {
      key: 'profile',
      title: 'Your profile',
      state: data.profileComplete ? 'done' : 'action',
      doorLabel: 'SET UP',
      doorHref: '/cleaner/complete-profile',
      sub: 'Photo and bio customers will see',
    },
  ];

  const anyAction = items.some((i) => i.state === 'action');

  return (
    <div data-testid="verification-checklist">
      <header className="mb-5">
        <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {anyAction ? 'Getting you set up' : 'Almost there'}
        </p>
        <h1 className="mt-1 font-jost text-[26px] font-semibold leading-tight text-ink">
          {anyAction
            ? `Welcome${firstName ? `, ${firstName}` : ''}`
            : 'We are checking your details'}
        </h1>
        <p className="mt-2 font-jost text-[14px] font-light text-ink-2">
          {anyAction
            ? 'Finish these steps and our team reviews everything, usually within one working day.'
            : 'Everything is in. Our team is reviewing it, usually within one working day. You can get ahead while you wait.'}
        </p>
      </header>

      <div className="space-y-3">
        {items.map((i) => (
          <ItemRow key={i.key} item={i} />
        ))}

        {/* R13 Lane 1 (James-ruled): DBS is OPTIONAL — never navy-ringed,
            never in the blocking set or the Reviewing summary. Same grammar
            as the reviews row; the door is the dressed documents room. */}
        <Link
          href="/app/documents"
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-3.5"
          data-testid="vc-dbs-optional"
        >
          <span>
            <span className="block font-jost text-[14px] font-medium text-ink">DBS check</span>
            <span className="mt-0.5 block font-jost text-[12px] text-ink-3">
              {data.documents.dbs_certificate === 'approved'
                ? 'Approved. The DBS badge is on your profile.'
                : data.documents.dbs_certificate === 'reviewing'
                  ? 'Uploaded and in review.'
                  : 'Optional. Earn the DBS badge on your profile.'}
            </span>
          </span>
          <svg
            className="h-3.5 w-3.5 shrink-0 text-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>

        {/* Optional row: bring your reviews with you (R12 Lane 6 door 1) */}
        <Link
          href="/cleaner/imported-reviews"
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-3.5"
          data-testid="vc-import-reviews"
        >
          <span>
            <span className="block font-jost text-[14px] font-medium text-ink">
              Bring your reviews with you
            </span>
            <span className="mt-0.5 block font-jost text-[12px] text-ink-3">
              {data.importedReviewCount > 0
                ? `${data.importedReviewCount} imported so far`
                : 'Optional. Show new customers your track record.'}
            </span>
          </span>
          <svg
            className="h-3.5 w-3.5 shrink-0 text-ink-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* While you wait: the two fully live rooms, both states. */}
      <p className="mt-6 font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
        Ready when you are
      </p>
      <Link
        href="/app/availability"
        className="mt-3 block rounded-2xl border border-line bg-surface px-5 py-4"
        data-testid="vc-availability-door"
      >
        <span className="flex items-center justify-between">
          <span className="font-jost text-[15px] font-medium text-ink">My Availability</span>
          <span className="font-jost text-[13px] text-ink-3">Set your week</span>
        </span>
      </Link>
      <Link
        href="/app/rates"
        className="mt-3 block rounded-2xl border border-line bg-surface px-5 py-4"
        data-testid="vc-rates-door"
      >
        <span className="flex items-center justify-between">
          <span className="font-jost text-[15px] font-medium text-ink">My Rates</span>
          <span className="font-jost text-[13px] text-ink-3">Set your prices</span>
        </span>
      </Link>
    </div>
  );
}
