'use client';

// Pro "Download my data" (James-ruled rider on the deletion door): GDPR
// Article 20 parity for the account type that holds the most data. Same
// export engine as the customer settings page, byte-untouched: GET
// /api/gdpr/export (session-scoped to the caller; the export is audit-logged
// server-side). Delivery differs honestly: the customer modal builds a blob
// and clicks an <a download>, which does nothing inside the shell's WebView
// (the shell's native download machinery is statement-only). So this room
// renders the export on screen, then offers the system share sheet with the
// JSON as a file (Save to Files, AirDrop, Mail) where Web Share supports
// files, and a copy-to-clipboard fallback everywhere else. L2 by
// construction: no website chrome exists here.

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import AccountMenu from '@/components/app/AccountMenu';
import InboxBell from '@/components/app/InboxBell';
import { haptic } from '@/components/app/job-cards';

type Json = Record<string, unknown>;

interface ExportPayload {
  personalInfo?: Json;
  addresses?: Json[];
  bookings?: Json[];
  cleanerProfile?: Json | null;
  exportedAt?: string;
}

const LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  createdAt: 'Account created',
  bio: 'Bio',
  hourlyRateRegular: 'Regular hourly rate',
  specialties: 'Specialties',
  tier: 'Tier',
  location: 'Area',
  postcode: 'Postcode',
  radius: 'Travel radius',
  verified: 'Verified',
  verificationStatus: 'Verification status',
  backgroundCheckPassed: 'Background check passed',
  dbsCertNumber: 'DBS certificate number',
  dbsCertVerified: 'DBS verified',
  dbsCertIssueDate: 'DBS issue date',
  rightToWorkStatus: 'Right to work status',
  rightToWorkDocType: 'Right to work document',
  rightToWorkExpiresAt: 'Right to work expires',
  identityVerifiedAt: 'Identity verified',
  rating: 'Rating',
  completedJobs: 'Completed jobs',
};

function labelOf(key: string): string {
  return LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'Not set';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.map(show).join(', ') : 'None';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB');
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Rows({ data }: { data: Json }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="font-jost text-[13px] text-ink-3">Nothing recorded.</p>;
  }
  return (
    <dl className="divide-y divide-line/60">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-start justify-between gap-4 py-2">
          <dt className="shrink-0 font-jost text-[13px] text-ink-3">{labelOf(k)}</dt>
          <dd className="min-w-0 break-words text-right font-jost text-[13px] text-ink">
            {show(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function MyDataRoom() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading');
  const [data, setData] = useState<ExportPayload | null>(null);
  const [raw, setRaw] = useState<string>('');
  const [canShareFile, setCanShareFile] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch('/api/gdpr/export');
      if (res.status === 401 || res.status === 403) {
        setState('denied');
        return;
      }
      const body = res.ok ? await res.json().catch(() => null) : null;
      if (!body?.data) {
        setState('error');
        return;
      }
      setData(body.data as ExportPayload);
      setRaw(JSON.stringify(body.data, null, 2));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Web Share Level 2 (files) is a capability check, not a UA guess.
    try {
      const n = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof n.share === 'function' && typeof n.canShare === 'function') {
        const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
        setCanShareFile(n.canShare({ files: [probe] }));
      }
    } catch {
      setCanShareFile(false);
    }
  }, []);

  const fileName = () => `rena-my-data-${new Date().toISOString().split('T')[0]}.json`;

  const shareFile = async () => {
    haptic('light');
    try {
      const file = new File([raw], fileName(), { type: 'application/json' });
      await navigator.share({ files: [file], title: 'My Rena data' });
    } catch (e) {
      // AbortError is the user closing the sheet, not a failure.
      if (!(e instanceof Error && e.name === 'AbortError')) {
        setFlash('Sharing is not available here. Copy as text instead.');
        setTimeout(() => setFlash(null), 3000);
      }
    }
  };

  const copyText = async () => {
    haptic('light');
    try {
      await navigator.clipboard.writeText(raw);
      setFlash('Copied to your clipboard.');
    } catch {
      setFlash('Copy is not available here. Your data is shown below.');
    }
    setTimeout(() => setFlash(null), 3000);
  };

  return (
    <div data-testid="my-data-room">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface"
          data-testid="my-data-back"
        >
          <svg
            className="h-4 w-4 text-ink"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Your data
          </p>
          <h1 className="font-jost text-[22px] font-semibold leading-tight text-ink">
            Download my data
          </h1>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <AccountMenu />
          <InboxBell />
        </div>
      </header>

      {state === 'denied' && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-4 font-jost text-[14px] text-ink-2">
          Please sign in again to view your data.
        </p>
      )}
      {state === 'error' && (
        <div className="rounded-2xl border border-line bg-surface px-4 py-4">
          <p className="font-jost text-[14px] text-ink-2">
            We couldn&rsquo;t prepare your data just now. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      )}
      {state === 'loading' && (
        <div className="space-y-3" data-testid="my-data-loading">
          <div className="h-24 animate-pulse rounded-2xl bg-line" />
          <div className="h-40 animate-pulse rounded-2xl bg-line" />
        </div>
      )}

      {state === 'ready' && data && (
        <>
          <section className="rounded-2xl border border-line bg-surface px-4 py-4">
            <p className="font-jost text-[13px] leading-relaxed text-ink-2">
              This is everything we hold about you, prepared{' '}
              {data.exportedAt ? `on ${show(data.exportedAt)}` : 'just now'}, as the GDPR right to
              data portability requires. Save it with the share sheet, or copy it as text.
            </p>
            <div className="mt-4 space-y-1.5">
              {canShareFile && (
                <button
                  type="button"
                  onClick={shareFile}
                  className="w-full rounded-[10px] bg-primary py-3 font-jost text-sm font-medium text-white active:opacity-90"
                  data-testid="my-data-share"
                >
                  Save or share as a file
                </button>
              )}
              <button
                type="button"
                onClick={copyText}
                className={
                  canShareFile
                    ? 'w-full py-3 font-jost text-sm font-medium text-ink-2 active:opacity-70'
                    : 'w-full rounded-[10px] bg-primary py-3 font-jost text-sm font-medium text-white active:opacity-90'
                }
                data-testid="my-data-copy"
              >
                Copy as text
              </button>
            </div>
            {flash && (
              <p
                className="mt-3 rounded-[10px] bg-page px-3 py-2 text-center font-jost text-[13px] text-ink-2"
                data-testid="my-data-flash"
              >
                {flash}
              </p>
            )}
          </section>

          <section
            className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4"
            data-testid="my-data-personal"
          >
            <h2 className="font-jost text-[15px] font-semibold text-ink">Personal information</h2>
            <div className="mt-2">
              <Rows data={data.personalInfo ?? {}} />
            </div>
          </section>

          <section
            className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4"
            data-testid="my-data-cleaner"
          >
            <h2 className="font-jost text-[15px] font-semibold text-ink">Cleaner profile</h2>
            <div className="mt-2">
              {data.cleanerProfile ? (
                <Rows data={data.cleanerProfile} />
              ) : (
                <p className="font-jost text-[13px] text-ink-3">
                  No cleaner profile on this account.
                </p>
              )}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4">
            <h2 className="font-jost text-[15px] font-semibold text-ink">Saved addresses</h2>
            <div className="mt-2 space-y-3">
              {data.addresses && data.addresses.length > 0 ? (
                data.addresses.map((a, i) => (
                  <div key={i} className="rounded-[10px] bg-page px-3 py-2">
                    <Rows data={a} />
                  </div>
                ))
              ) : (
                <p className="font-jost text-[13px] text-ink-3">None saved.</p>
              )}
            </div>
          </section>

          <section className="mt-3 rounded-2xl border border-line bg-surface px-4 py-4">
            <h2 className="font-jost text-[15px] font-semibold text-ink">
              Bookings you made as a customer
            </h2>
            <p className="mt-1 font-jost text-[12px] text-ink-3">
              Cleans you carried out as a cleaner live in your Earnings statements, not here.
            </p>
            <div className="mt-2 space-y-3">
              {data.bookings && data.bookings.length > 0 ? (
                data.bookings.map((b, i) => (
                  <div key={String(b.id ?? i)} className="rounded-[10px] bg-page px-3 py-2">
                    <Rows data={b} />
                  </div>
                ))
              ) : (
                <p className="font-jost text-[13px] text-ink-3">None.</p>
              )}
            </div>
          </section>

          <details className="mt-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-4">
            <summary className="cursor-pointer font-jost text-[14px] font-medium text-ink">
              Raw export (JSON)
            </summary>
            <pre
              className="mt-3 max-h-80 overflow-auto rounded-[10px] bg-page p-3 font-mono text-[11px] leading-relaxed text-ink-2"
              data-testid="my-data-raw"
            >
              {raw}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}
