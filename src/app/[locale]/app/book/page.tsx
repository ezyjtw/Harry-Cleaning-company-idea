'use client';

// RENA customer app — Book (Phase 2, James-ruled: option A, the concierge
// landing; the approved format mockup is the spec). Purpose-built in-shell
// page: QUICKEST — her known cleaners as one-tap cards feeding the existing
// cleaner-first flow (/book/[id]) · OR START FRESH — service rows feeding
// the existing quote flow (/services/[slug]). /services itself is untouched
// for browsers.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CustomerAvatar, fmtPounds } from '@/components/app/customer';
import { serviceLabelFromSlug } from '@/lib/constants/services';

interface KnownCleaner {
  id: string;
  name: string;
  image: string | null;
  cleans: number;
  lastService: string;
  lastDuration: number;
  lastPrice: number;
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
  const [known, setKnown] = useState<KnownCleaner[]>([]);

  useEffect(() => {
    fetch('/api/bookings?status=COMPLETED,REVIEWED&pageSize=100')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const raw: Record<string, unknown>[] = data?.data || [];
        const byCleaner = new Map<string, KnownCleaner>();
        // Newest-first API order: the first booking seen per cleaner is her
        // latest clean with them — that's the card's one-tap shape.
        for (const b of raw) {
          const c = b.cleaner as {
            id?: string;
            name?: string | null;
            image?: string | null;
          } | null;
          if (!c?.id || !c.name) continue;
          const existing = byCleaner.get(c.id);
          if (existing) {
            existing.cleans += 1;
          } else {
            byCleaner.set(c.id, {
              id: c.id,
              name: c.name,
              image: c.image ?? null,
              cleans: 1,
              lastService: String(b.serviceType || 'cleaning'),
              lastDuration: Number(b.duration || 0),
              lastPrice: Number(b.totalPrice || 0),
            });
          }
        }
        setKnown(Array.from(byCleaner.values()).sort((a, b) => b.cleans - a.cleans));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          {known.length > 0 && (
            <section data-testid="known-cleaners">
              <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Quickest — Book Someone You Know
              </p>
              <div className="mt-2.5 space-y-2.5">
                {known.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/book/${c.id}`}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-page"
                  >
                    <CustomerAvatar photo={c.image} name={c.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-jost text-[15px] font-semibold text-ink">
                        {c.name}
                        <span className="ml-2 font-jost text-[12px] font-medium text-primary">
                          {i === 0 ? 'Your usual' : `${c.cleans} cleans with you`}
                        </span>
                      </span>
                      <span className="block truncate font-jost text-[13px] text-ink-3">
                        {serviceLabelFromSlug(c.lastService)}
                        {c.lastDuration > 0 &&
                          ` · ${c.lastDuration} ${c.lastDuration === 1 ? 'hour' : 'hours'}`}
                        {c.lastPrice > 0 && ` · ${fmtPounds(c.lastPrice)}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-jost text-[13px] font-semibold text-primary">
                      Book ›
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section data-testid="service-rows">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              {known.length > 0 ? 'Or Start Fresh' : 'What Kind Of Clean?'}
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
        </div>
      )}
    </div>
  );
}
