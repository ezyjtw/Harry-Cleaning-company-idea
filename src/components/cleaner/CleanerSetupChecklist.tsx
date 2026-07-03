import Link from 'next/link';

/**
 * Consolidated "Complete your profile" setup checklist for the cleaner dashboard.
 *
 * Replaces the scattered individual banners (service area, payouts, EoT/Airbnb
 * pricing) and the sidebar completion widget with one panel. Every item
 * auto-completes from REAL underlying state (no manual ticks) — the same
 * conditions the old banners used. REQUIRED items drive the "N of M" progress and
 * 100%; OPTIONAL items (import reviews) are shown separately and never block 100%.
 *
 * Shows in BOTH verified and awaiting-verification states so cleaners can do
 * productive setup during the verification wait. Hidden once all REQUIRED items
 * are done (the optional import-reviews item remains reachable via the sidebar).
 */
export interface SetupChecklistProfile {
  acknowledgmentComplete: boolean;
  profileComplete: boolean;
  insuranceVerified: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  homePostcode: string | null;
  maxTravelMinutes: number | null;
  hourlyRateRegular: number | null;
  serviceTypes: string[];
  eotPrices: Record<string, unknown> | null;
  airbnbPrices: Record<string, unknown> | null;
  availabilitySlotsCount: number;
  importedReviewCount: number;
}

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

function isMapFilled(m: Record<string, unknown> | null): boolean {
  return !!m && Object.keys(m).length > 0;
}

function buildItems(p: SetupChecklistProfile): {
  required: ChecklistItem[];
  optional: ChecklistItem[];
} {
  // Pricing is complete when the base hourly rate is set AND — only for the
  // service types the cleaner actually offers — the EoT/Airbnb price maps are set.
  const pricingDone =
    !!p.hourlyRateRegular &&
    p.hourlyRateRegular > 0 &&
    (!p.serviceTypes.includes('end_of_tenancy') || isMapFilled(p.eotPrices)) &&
    (!p.serviceTypes.includes('airbnb') || isMapFilled(p.airbnbPrices));

  const required: ChecklistItem[] = [
    {
      key: 'acknowledgment',
      label: 'Acknowledge self-employment',
      description: 'Confirm you understand you work with Rena as a self-employed cleaner',
      done: p.acknowledgmentComplete,
      href: '/cleaner/agreement',
    },
    {
      key: 'profile',
      label: 'Complete your profile details',
      description: 'Bio, postcode and specialties',
      done: p.profileComplete,
      href: '/cleaner/profile',
    },
    {
      key: 'payouts',
      label: 'Set up payouts',
      description: 'Connect your payment account so customers can book you',
      done: p.stripeChargesEnabled && p.stripePayoutsEnabled,
      href: '/cleaner/stripe/connect',
    },
    {
      key: 'insurance',
      label: 'Upload public liability insurance',
      description: 'Add your public liability cover so you can take bookings',
      done: p.insuranceVerified,
      href: '/cleaner/profile',
    },
    {
      key: 'area',
      label: 'Set your service area',
      description: 'Home postcode and maximum travel time',
      done: !!p.homePostcode && p.maxTravelMinutes !== null,
      href: '/cleaner/profile',
    },
    {
      key: 'pricing',
      label: 'Complete your pricing',
      description: 'Your hourly rate, plus EoT/Airbnb prices for services you offer',
      done: pricingDone,
      href: '/cleaner/pricing',
    },
    {
      key: 'availability',
      label: 'Set your availability',
      description: 'Add the times you can work',
      done: p.availabilitySlotsCount > 0,
      href: '/cleaner/availability',
    },
  ];

  const optional: ChecklistItem[] = [
    {
      key: 'imports',
      label: 'Import your reviews',
      description: 'Bring reviews from Google, Checkatrade or a personal reference',
      done: p.importedReviewCount > 0,
      href: '/cleaner/imported-reviews',
    },
  ];

  return { required, optional };
}

function ItemRow({ item }: { item: ChecklistItem }) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl bg-cream px-5 py-3.5"
      style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          item.done ? 'bg-green-50 text-green-600' : 'bg-ink/5 text-ink-3'
        }`}
      >
        {item.done ? (
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="h-2 w-2 rounded-full bg-ink-3/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-jost text-[14px] ${item.done ? 'text-ink-3' : 'font-medium text-ink'}`}>
          {item.label}
        </p>
        <p className="font-jost text-[12px] font-light text-ink-3">{item.description}</p>
      </div>
      {!item.done && (
        <Link
          href={item.href}
          className="shrink-0 rounded-full bg-ink px-4 py-2 font-jost text-[11px] uppercase tracking-[0.1em] text-cream transition hover:bg-ink/90"
        >
          Set up
        </Link>
      )}
    </div>
  );
}

export default function CleanerSetupChecklist({ profile }: { profile: SetupChecklistProfile }) {
  const { required, optional } = buildItems(profile);
  const doneCount = required.filter((i) => i.done).length;
  const total = required.length;
  const allRequiredDone = doneCount === total;
  const percent = Math.round((doneCount / total) * 100);

  // Once all REQUIRED setup is done, collapse the required list to a single
  // "all set" line but KEEP the panel so the OPTIONAL import-reviews nudge stays
  // visible (the optional row still reflects its own done/not-done state).
  if (allRequiredDone) {
    return (
      <section
        className="mb-6 rounded-xl bg-white p-5 lg:p-6"
        style={{ border: '1px solid rgba(14,14,12,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <h2 className="font-newsreader text-[18px] font-semibold text-ink">
              You&rsquo;re all set
            </h2>
            <p className="font-jost text-[12px] font-light text-ink-3">
              Your essentials are complete. Optionally, strengthen your profile:
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          {optional.map((item) => (
            <ItemRow key={item.key} item={item} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-6 rounded-xl bg-white p-5 lg:p-6"
      style={{ border: '1px solid rgba(14,14,12,0.08)' }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-newsreader text-[20px] font-semibold text-ink">
            Complete your profile
          </h2>
          <p className="font-jost text-[12px] font-light text-ink-3">
            Finish these to start receiving bookings.
          </p>
        </div>
        <span className="shrink-0 font-jost text-[12px] font-medium text-ink-2">
          {doneCount} of {total} complete
        </span>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-cream-2">
        <div
          className="h-full rounded-full bg-gold transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {required.map((item) => (
          <ItemRow key={item.key} item={item} />
        ))}
      </div>

      <div className="mt-5">
        <p className="mb-2 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">Optional</p>
        <div className="space-y-2.5">
          {optional.map((item) => (
            <ItemRow key={item.key} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
