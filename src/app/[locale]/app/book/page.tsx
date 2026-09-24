'use client';

// RENA customer app — Book (Phase 2, James-ruled: option A, the concierge
// landing; the approved format mockup is the spec). Purpose-built in-shell
// page: QUICKEST — her known cleaners as one-tap cards feeding the existing
// cleaner-first flow (/book/[id]) · OR START FRESH — service rows feeding
// the existing quote flow (/services/[slug]). /services itself is untouched
// for browsers.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CustomerAvatar } from '@/components/app/customer';
import { serviceLabelFromSlug } from '@/lib/constants/services';

interface RecentCleaner {
  id: string;
  name: string;
  image: string | null;
  lastService: string;
  lastDate: string;
}

// The website's service catalogue, in row voice (label · one line · from-price).
// Same-day carries the settled ruling: "coming soon", no price, no door.
const SERVICE_ROWS = [
  {
    slug: 'regular',
    label: 'Regular Cleaning',
    line: 'Weekly or fortnightly — the same trusted face every visit.',
    from: 'From £14/hr',
  },
  {
    slug: 'deep',
    label: 'Deep Cleaning',
    line: 'A top-to-bottom reset for kitchens, bathrooms and beyond.',
    from: 'From £16/hr',
  },
  {
    slug: 'end-of-tenancy',
    label: 'End of Tenancy',
    line: 'Deposit-ready cleaning to a full agency checklist.',
    from: 'From £120',
  },
  {
    slug: 'airbnb',
    label: 'Airbnb Turnaround',
    line: 'Guest-ready between stays — beds, linens and reset.',
    from: 'From £35',
  },
  {
    slug: 'same-day',
    label: 'Same Day Cleaning',
    line: 'Short-notice cleans with the same vetted standards.',
    from: 'Coming soon',
  },
] as const;

export default function CustomerBookPage() {
  const [loading, setLoading] = useState(true);
  // LANE 3 (James-ruled): the concierge's top slot is ONE card — the cleaner
  // from the most recent COMPLETED booking (most recent wins, not most
  // frequent). No completed history, no card.
  const [recent, setRecent] = useState<RecentCleaner | null>(null);
  // A hidden most-recent cleaner renders the quiet non-bookable state,
  // consistent with YOUR CLEANERS (no Book door, the honest line).
  const [recentHidden, setRecentHidden] = useState(false);

  useEffect(() => {
    fetch('/api/bookings?status=COMPLETED,REVIEWED&pageSize=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const raw: Record<string, unknown>[] = data?.data || [];
        // Newest-first API order: the first row with a cleaner IS the most
        // recent completed clean.
        for (const b of raw) {
          const c = b.cleaner as {
            id?: string;
            name?: string | null;
            image?: string | null;
          } | null;
          if (!c?.id || !c.name) continue;
          setRecent({
            id: c.id,
            name: c.name,
            image: c.image ?? null,
            lastService: String(b.serviceType || 'cleaning'),
            lastDate: String(b.date || ''),
          });
          // Visibility ride-along: the same flag map YOUR CLEANERS reads.
          fetch('/api/account/my-cleaners')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              const vis = d?.visibility as Record<string, boolean> | undefined;
              if (vis && c.id && vis[c.id] === false) setRecentHidden(true);
            })
            .catch(() => {});
          break;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const lastWhen = (() => {
    if (!recent?.lastDate) return null;
    const d = new Date(recent.lastDate);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  })();

  return (
    <div>
      <header className="mb-5">
        <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">Book A Clean</h1>
      </header>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton-pulse h-24 rounded-xl" />
          <div className="skeleton-pulse h-64 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {recent && (
            <section data-testid="recent-cleaner">
              <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Quickest — Book Again
              </p>
              <div className="mt-2.5">
                {recentHidden ? (
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 opacity-60">
                    <CustomerAvatar photo={recent.image} name={recent.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-jost text-[15px] font-semibold text-ink">
                        {recent.name}
                      </span>
                      <span className="block truncate font-jost text-[13px] text-ink-3">
                        Not currently taking bookings
                      </span>
                    </span>
                  </div>
                ) : (
                  <Link
                    href={`/book/${recent.id}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-page"
                  >
                    <CustomerAvatar photo={recent.image} name={recent.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-jost text-[15px] font-semibold text-ink">
                        Book {recent.name.split(' ')[0]} again
                      </span>
                      <span className="block truncate font-jost text-[13px] text-ink-3">
                        {serviceLabelFromSlug(recent.lastService)}
                        {lastWhen && ` · ${lastWhen}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-jost text-[13px] font-semibold text-primary">
                      Book ›
                    </span>
                  </Link>
                )}
              </div>
            </section>
          )}

          <section data-testid="service-rows">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              {recent ? 'Or Start Fresh' : 'What Kind Of Clean?'}
            </p>
            <div className="mt-2.5 divide-y divide-line/60 rounded-xl border border-line bg-surface">
              {SERVICE_ROWS.map((s) => {
                const comingSoon = s.from === 'Coming soon';
                const row = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block font-jost text-[15px] font-medium text-ink">
                        {s.label}
                      </span>
                      <span className="block truncate font-jost text-[12.5px] text-ink-3">
                        {s.line}
                      </span>
                    </span>
                    <span className="ml-3 shrink-0 text-right">
                      <span
                        className={`block font-jost text-[13px] font-semibold ${
                          comingSoon ? 'text-ink-3' : 'text-ink'
                        }`}
                      >
                        {s.from}
                      </span>
                    </span>
                    {!comingSoon && (
                      <span className="ml-2 shrink-0 font-jost text-[15px] font-semibold text-primary">
                        ›
                      </span>
                    )}
                  </>
                );
                return comingSoon ? (
                  <div key={s.slug} className="flex items-center px-4 py-3.5 opacity-80">
                    {row}
                  </div>
                ) : (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    className="flex items-center px-4 py-3.5 active:bg-page"
                  >
                    {row}
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Book-tab option A (James-ruled): one quiet cross-link — the
              cleaner-first road, no fork cards, no new screens. The shell's
              cross-tab intercept lands this on the Cleaners tab. */}
          <p className="pb-2 pt-1 text-center">
            <Link
              href="/cleaners"
              data-testid="book-browse-cleaners"
              className="font-jost text-[13px] text-ink-3 active:text-ink"
            >
              Prefer to choose your cleaner first?{' '}
              <span className="font-semibold text-primary">Browse cleaners ›</span>
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
