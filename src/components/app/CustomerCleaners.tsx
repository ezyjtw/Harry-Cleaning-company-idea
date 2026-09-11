'use client';

// Cleaners tab, in-shell (Phase 2, James-ruled: option A's row layout with
// photo avatars — real profile photo fills the 36px circle, coloured
// initials only as the no-photo fallback; no portrait cards anywhere).
// The switch renders the browser directory untouched unless the customer
// shell (or preview cookie) is present — SSR output is byte-identical.

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CustomerAvatar } from '@/components/app/customer';
import { isCustomerShellUA } from '@/lib/shell';

export function CustomerCleanersSwitch({ children }: { children: React.ReactNode }) {
  const [inShell, setInShell] = useState(false);
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (isCustomerShellUA() || preview) setInShell(true);
  }, []);
  if (!inShell) return <>{children}</>;
  return <CustomerCleanersView />;
}

interface DirCleaner {
  id: string;
  name: string;
  photo: string | null;
  rating: number;
  reviewCount: number;
  location: string;
  verified: boolean;
  fromRate: number | null;
}

interface MyCleaner {
  id: string;
  name: string;
  image: string | null;
  cleans: number;
  rating: number | null;
}

function Tick() {
  return (
    <svg
      className="ml-1 inline h-3.5 w-3.5 text-trust"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function CustomerCleanersView() {
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<MyCleaner[]>([]);
  const [near, setNear] = useState<DirCleaner[]>([]);
  const [areaLabel, setAreaLabel] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        // Silent area seed: default saved address first, most recent
        // booking's address second, unseeded (rating order) last.
        const [addresses, myBookings] = await Promise.all([
          fetch('/api/addresses')
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
          fetch('/api/bookings?status=COMPLETED,REVIEWED&pageSize=100')
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        const addrList: Record<string, unknown>[] = Array.isArray(addresses)
          ? addresses
          : (addresses?.data ?? []);
        const def = addrList.find((a) => a.isDefault) ?? addrList[0];
        const rawBookings: Record<string, unknown>[] = myBookings?.data || [];
        const bookingAddr = rawBookings
          .map((b) => (b.address as { postcode?: string; city?: string } | null) ?? null)
          .find((a) => a?.postcode);
        const postcode =
          (def?.postcode as string | undefined) || bookingAddr?.postcode || undefined;
        const city = (def?.city as string | undefined) || bookingAddr?.city || '';
        if (postcode) setAreaLabel(city || String(postcode).trim().split(/\s+/)[0].toUpperCase());

        // Her cleaners, from her completed cleans (newest first).
        const byCleaner = new Map<string, MyCleaner>();
        for (const b of rawBookings) {
          const c = b.cleaner as {
            id?: string;
            name?: string | null;
            image?: string | null;
          } | null;
          if (!c?.id || !c.name) continue;
          const ex = byCleaner.get(c.id);
          if (ex) ex.cleans += 1;
          else
            byCleaner.set(c.id, {
              id: c.id,
              name: c.name,
              image: c.image ?? null,
              cleans: 1,
              rating: null,
            });
        }

        // The directory, area-seeded when we can.
        const params = new URLSearchParams({ limit: '50' });
        if (postcode) params.set('postcode', postcode);
        let dirRaw: Record<string, unknown>[] = [];
        const res = await fetch(`/api/cleaners?${params.toString()}`);
        if (res.ok) {
          const d = await res.json();
          dirRaw = d.cleaners || d.data || [];
        }
        if (postcode && dirRaw.length === 0) {
          // No cleaners matched her area (or the postcode errored) — never a
          // blank tab, and never a false area claim: fall back to the whole
          // directory under the honest unseeded header.
          const res2 = await fetch('/api/cleaners?limit=50');
          if (res2.ok) {
            const d2 = await res2.json();
            dirRaw = d2.cleaners || d2.data || [];
            setAreaLabel('');
          }
        }
        const dir: DirCleaner[] = dirRaw.map((c) => ({
          id: String(c.id || ''),
          name: String(c.name || ''),
          photo: (c.photo || c.image || null) as string | null,
          rating: Number(c.rating || 0),
          reviewCount: Number(c.reviewCount || 0),
          location: String(c.location || ''),
          verified: !!(c.verified || c.identityVerified),
          fromRate: c.hourlyRateRegular ? Number(c.hourlyRateRegular) : null,
        }));
        for (const d of dir) {
          const m = byCleaner.get(d.id);
          if (m && d.rating > 0) m.rating = d.rating;
        }
        setMine(Array.from(byCleaner.values()).sort((a, b) => b.cleans - a.cleans));
        setNear(dir.filter((d) => !byCleaner.has(d.id)));
      } catch {
        /* states below handle empty */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">
      <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">Cleaners</h1>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="skeleton-pulse h-16 rounded-xl" />
          <div className="skeleton-pulse h-64 rounded-xl" />
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {mine.length > 0 && (
            <section data-testid="your-cleaners">
              <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Your Cleaners
              </p>
              <div className="mt-2.5 divide-y divide-line/60 rounded-xl border border-line bg-surface">
                {mine.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
                    <CustomerAvatar photo={c.image} name={c.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-jost text-[15px] font-medium text-ink">
                        {c.name}
                        <Tick />
                      </span>
                      <span className="block font-jost text-[12.5px] text-ink-3">
                        {c.rating ? `★ ${c.rating.toFixed(1)} · ` : ''}
                        {c.cleans} {c.cleans === 1 ? 'clean' : 'cleans'} for you
                      </span>
                    </span>
                    <Link
                      href={`/book/${c.id}`}
                      className="shrink-0 font-jost text-[13px] font-semibold text-primary"
                    >
                      Book ›
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section data-testid="cleaners-near-you">
            <p className="font-jost text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              {areaLabel ? `Cleaners Near You · ${areaLabel}` : 'Cleaners On Rena'}
            </p>
            {near.length === 0 ? (
              <p className="py-8 text-center font-jost text-sm text-ink-3">
                No more cleaners to show just yet.
              </p>
            ) : (
              <div className="mt-2.5 divide-y divide-line/60 rounded-xl border border-line bg-surface">
                {near.map((c) => (
                  <Link
                    key={c.id}
                    href={`/cleaners/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 active:bg-page"
                  >
                    <CustomerAvatar photo={c.photo} name={c.name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-jost text-[15px] font-medium text-ink">
                        {c.name}
                        {c.verified && <Tick />}
                      </span>
                      <span className="block truncate font-jost text-[12.5px] text-ink-3">
                        {c.rating > 0 ? `★ ${c.rating.toFixed(1)}` : 'New'}
                        {c.location ? ` · ${c.location}` : ''}
                        {c.fromRate ? ` · from £${c.fromRate}/hr` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-jost text-[13px] font-semibold text-primary">
                      View ›
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
