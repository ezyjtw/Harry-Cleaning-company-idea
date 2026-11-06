'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import { CustomerBackLink, FlowStep } from '@/components/app/customer';
import CleanerIdentity from '@/components/CleanerIdentity';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { mapApiCleaner, useCleanersApi } from '@/lib/hooks/useCleanersApi';
import { isCustomerShellUA } from '@/lib/shell';

const URL_SLUG_TO_DB_SLUG: Record<string, string> = {
  regular: 'regular',
  'same-day': 'same_day',
  deep: 'deep',
  'end-of-tenancy': 'end_of_tenancy',
  airbnb: 'airbnb',
};

const SERVICE_TYPES = [
  {
    value: 'regular',
    label: 'Regular Cleaning',
    description: 'Routine upkeep — dusting, hoovering, mopping, and surface cleaning.',
  },
  {
    value: 'same-day',
    label: 'Same Day Cleaning',
    rateName: 'same-day',
    description: 'Need it today? Book before 12 pm for same-day service.',
  },
  {
    value: 'deep',
    label: 'Deep Cleaning',
    rateName: 'deep',
    description: 'A thorough top-to-bottom clean including behind appliances and inside cupboards.',
  },
  {
    value: 'end-of-tenancy',
    label: 'End of Tenancy Cleaning',
    description: 'Professional move-out clean to get your deposit back or prepare for new tenants.',
  },
  {
    value: 'airbnb',
    label: 'Airbnb Cleaning',
    description:
      'Quick turnaround cleans between guests — fresh linen, restocked supplies, spotless spaces.',
  },
];

// The homepage services-section (S3) photography, reused verbatim per service
// so the booking ledger reads the same as the marketing site.
const SERVICE_IMAGES: Record<string, string> = {
  regular: '/images/Regular cleaning.webp',
  'same-day': '/images/Same day cleaning.webp',
  deep: '/images/Deep cleaning.webp',
  'end-of-tenancy': '/images/End of Tenancy.webp',
  airbnb: '/images/Air BnB cleaning.webp',
};

// Lowest set price in a fixed-price map (EoT / Airbnb), for the "from £X" row —
// same derivation as CleanerProfileModal.
function minPrice(map?: Record<string, number>): number | null {
  if (!map) return null;
  const vals = Object.values(map).filter((n) => typeof n === 'number' && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

// James-ruled short-notice grace, shown BEFORE payment with the customer's
// ACTUAL deadline: 6h from booking time, hard-capped at 3h before start —
// whichever comes first. Mirrors BookingLifecycleService.graceDeadline.

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Carry the up-front postcode (cleaner card / profile pass ?postcode=) into the
  // address step so it auto-looks-up on mount instead of a manual "Find address".
  // Captured once; empty when absent (direct nav) → the manual path is preserved.
  const seededPostcode = (searchParams.get('postcode') ?? '').trim().toUpperCase();
  // B3: property context entered upstream (quote widget / directory) seeds the
  // form so the customer never re-enters it. Clamped to the select's range.
  const seededBedrooms = (() => {
    const n = parseInt(searchParams.get('bedrooms') ?? '', 10);
    return Number.isInteger(n) && n >= 0 && n <= 5 ? n : null;
  })();
  const { getCleanerById, loading: cleanersLoading } = useCleanersApi();
  // Truth-before-data law (ROUND 4 lane 2): "Cleaner not found" may only render
  // on a CONFIRMED 404 — never while the list is still loading, and never
  // because the cleaner fell outside the list's 50-cap. When the loaded list
  // lacks the id, a direct /api/cleaners/[id] fetch settles it: 404 confirms
  // not-found, ok resolves the cleaner, anything else offers retry.
  const listCleaner = getCleanerById(params.id);
  const [resolved, setResolved] = useState<{
    state: 'idle' | 'found' | 'notfound' | 'error';
    cleaner?: ReturnType<typeof mapApiCleaner>;
  }>({ state: 'idle' });
  const [resolveAttempt, setResolveAttempt] = useState(0);
  useEffect(() => {
    if (cleanersLoading || listCleaner) return;
    let cancelled = false;
    setResolved({ state: 'idle' });
    fetch(`/api/cleaners/${encodeURIComponent(params.id)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setResolved({ state: 'notfound' });
        } else if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>;
          setResolved({ state: 'found', cleaner: mapApiCleaner(data) });
        } else {
          setResolved({ state: 'error' });
        }
      })
      .catch(() => {
        if (!cancelled) setResolved({ state: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [cleanersLoading, listCleaner, params.id, resolveAttempt]);
  const cleaner = listCleaner ?? (resolved.state === 'found' ? resolved.cleaner : undefined);

  // Customer-shell step-frame law (mount-gated; browsers byte-identical).
  const [inCustomerShell, setInCustomerShell] = useState(false);
  useEffect(() => {
    const preview = document.cookie.split('; ').includes('rena-customer-preview=1');
    if (isCustomerShellUA() || preview) setInCustomerShell(true);
  }, []);
  useEffect(() => {
    if (!inCustomerShell) return;
    document.body.classList.add('rena-cflow');
    return () => document.body.classList.remove('rena-cflow');
  }, [inCustomerShell]);
  const { trackStep } = useAnalytics('booking');

  // Track initial page view and service selection step
  useEffect(() => {
    trackStep(1, 'service_selected', { cleanerId: params.id });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cleaner) {
    // Skeleton while anything is still in flight; the words "not found" are
    // earned only by the API's own 404.
    if (resolved.state === 'notfound') {
      return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-page" data-testid="cleaner-404">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">Cleaner not found</h1>
        </div>
      );
    }
    if (resolved.state === 'error') {
      return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-page">
          <h1 className="font-newsreader text-2xl font-semibold text-ink">
            Couldn&apos;t load this cleaner
          </h1>
          <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => setResolveAttempt((n) => n + 1)}
            className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-10" data-testid="cleaner-loading">
        <div className="skeleton-pulse h-24 rounded-xl" />
        <div className="skeleton-pulse h-48 rounded-xl" />
        <div className="skeleton-pulse h-32 rounded-xl" />
      </div>
    );
  }

  const hourly = cleaner.hourlyRateRegular ?? cleaner.hourlyRateDeep ?? cleaner.hourlyRateSameDay;
  const fixedMin = minPrice(cleaner.eotPrices) ?? minPrice(cleaner.airbnbPrices);
  const headlineMeta =
    typeof hourly === 'number'
      ? `from £${hourly.toFixed(2)}/hr`
      : typeof fixedMin === 'number'
        ? `from £${fixedMin.toFixed(2)}`
        : undefined;

  const priceFor = (value: string): string | null => {
    switch (value) {
      case 'regular':
        return typeof cleaner.hourlyRateRegular === 'number'
          ? `£${cleaner.hourlyRateRegular.toFixed(2)}/hr`
          : null;
      case 'deep':
        return typeof cleaner.hourlyRateDeep === 'number'
          ? `£${cleaner.hourlyRateDeep.toFixed(2)}/hr`
          : null;
      case 'same-day':
        return typeof cleaner.hourlyRateSameDay === 'number'
          ? `£${cleaner.hourlyRateSameDay.toFixed(2)}/hr`
          : null;
      case 'end-of-tenancy': {
        const m = minPrice(cleaner.eotPrices);
        return m !== null ? `from £${m.toFixed(2)}` : null;
      }
      case 'airbnb': {
        const m = minPrice(cleaner.airbnbPrices);
        return m !== null ? `from £${m.toFixed(2)}` : null;
      }
      default:
        return null;
    }
  };

  // Only services this cleaner offers (same gating as before), minus Same Day —
  // which always renders last as a muted, non-tappable SOON row.
  const offered = SERVICE_TYPES.filter((s) => {
    if (s.value === 'same-day') return false;
    const dbSlug = URL_SLUG_TO_DB_SLUG[s.value];
    if (!dbSlug || !cleaner.serviceTypes.includes(dbSlug)) return false;
    if (dbSlug === 'regular')
      return cleaner.hourlyRateRegular !== null && cleaner.hourlyRateRegular !== undefined;
    if (dbSlug === 'deep')
      return cleaner.hourlyRateDeep !== null && cleaner.hourlyRateDeep !== undefined;
    if (dbSlug === 'end_of_tenancy')
      return (
        cleaner.eotPrices !== null &&
        cleaner.eotPrices !== undefined &&
        Object.keys(cleaner.eotPrices).length > 0
      );
    if (dbSlug === 'airbnb')
      return (
        cleaner.airbnbPrices !== null &&
        cleaner.airbnbPrices !== undefined &&
        Object.keys(cleaner.airbnbPrices).length > 0
      );
    return true;
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const sameDay = SERVICE_TYPES.find((s) => s.value === 'same-day')!;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 bg-page">
      {/* R4 lane 1: the flow's first room previously had no visible way out
          in-shell — the standing back link walks history to whichever door
          opened it (Book tab or a cleaner profile). */}
      {inCustomerShell && (
        <div className="mb-3">
          <CustomerBackLink />
        </div>
      )}
      {inCustomerShell && <FlowStep n={1} total={5} />}
      {/* Cleaner header (S-C) */}
      <CleanerIdentity
        photo={cleaner.photo}
        name={cleaner.name}
        verified={cleaner.identityVerified || cleaner.verified}
        rating={cleaner.rating}
        reviewCount={cleaner.reviewCount}
        meta={headlineMeta}
      />

      <h1 className="mt-8 font-newsreader text-3xl font-semibold text-ink">
        What kind of cleaning do you need?
      </h1>
      <p className="mt-2 font-jost text-sm font-light text-ink-2">
        Choose a service to continue booking with {cleaner.name}.
      </p>

      {/* Service ledger — hairline rows with S3 imagery + the cleaner's real price */}
      <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {offered.map((s) => (
          <button
            key={s.value}
            onClick={() => {
              // B3/B4: keep the property context on the hand-off — this push
              // used to drop postcode + bedrooms, forcing re-entry.
              const qs = new URLSearchParams({ cleaner: params.id });
              if (seededPostcode) qs.set('postcode', seededPostcode);
              if (seededBedrooms !== null) qs.set('bedrooms', String(seededBedrooms));
              router.push(`/services/${s.value}?${qs.toString()}`);
            }}
            className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-page"
          >
            {/* ROUND 3 LANE 4 (James-ruled): consistency by removal — the
                service imagery is the website's; in-shell the rows are
                text-and-selection, matching Route 1's plain rows. */}
            {!inCustomerShell && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={SERVICE_IMAGES[s.value]}
                alt=""
                className="h-12 w-16 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-jost text-[15px] font-medium text-ink">{s.label}</h3>
              <p className="mt-0.5 font-jost text-[13px] font-light text-ink-2">{s.description}</p>
            </div>
            {priceFor(s.value) && (
              <span className="ml-3 shrink-0 font-newsreader text-[15px] font-semibold text-ink">
                {priceFor(s.value)}
              </span>
            )}
          </button>
        ))}

        {/* Same Day — muted, greyscale, SOON, non-tappable (unchanged behaviour) */}
        <div className="flex w-full items-center gap-4 px-4 py-3.5 opacity-60">
          {!inCustomerShell && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={SERVICE_IMAGES['same-day']}
              alt=""
              className="h-12 w-16 shrink-0 rounded-lg object-cover grayscale"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-jost text-[15px] font-medium text-ink-2">{sameDay.label}</h3>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.08em] text-ink-3">
                Soon
              </span>
            </div>
            <p className="mt-0.5 font-jost text-[13px] font-light text-ink-3">
              {sameDay.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
