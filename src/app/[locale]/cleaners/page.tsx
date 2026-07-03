'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense, useCallback } from 'react';

import CleanerCard from '@/components/CleanerCard';
import CleanerProfileModal from '@/components/CleanerProfileModal';
import {
  BEDROOMS_TO_EOT_SIZE,
  BEDROOMS_TO_AIRBNB_SIZE,
  eotSizeLabel,
  airbnbSizeLabel,
} from '@/lib/constants/services';
import type { Cleaner } from '@/lib/types';

const FILTER_LABEL_TO_SERVICE_SLUG: Record<string, string> = {
  'Regular Cleaning': 'regular',
  'Deep Cleaning': 'deep',
  'End of Tenancy': 'end_of_tenancy',
  'Airbnb / Short-Let': 'airbnb',
};

// A cleaner only "offers" a service if they have a USABLE price for it. A service
// listed in serviceTypes with no price (e.g. end_of_tenancy in serviceTypes but
// empty eotPrices) is a profile data-integrity mismatch and must NOT appear under
// that service's filter.
function serviceHasUsablePrice(c: Cleaner, slug: string): boolean {
  switch (slug) {
    case 'regular':
      return typeof c.hourlyRateRegular === 'number' && c.hourlyRateRegular > 0;
    case 'deep':
      return typeof c.hourlyRateDeep === 'number' && c.hourlyRateDeep > 0;
    case 'same_day':
      return typeof c.hourlyRateSameDay === 'number' && c.hourlyRateSameDay > 0;
    case 'end_of_tenancy':
      return (
        !!c.eotPrices && Object.values(c.eotPrices).some((p) => typeof p === 'number' && p > 0)
      );
    case 'airbnb':
      return (
        !!c.airbnbPrices && Object.values(c.airbnbPrices).some((p) => typeof p === 'number' && p > 0)
      );
    default:
      return true;
  }
}

// Curated filter row (change order): services + the three cleaner specialties.
// No Same-Day / Available-Now filters — that UI is removed pending relaunch.
const SERVICE_FILTERS = [
  'All',
  'Regular Cleaning',
  'Deep Cleaning',
  'End of Tenancy',
  'Airbnb / Short-Let',
  'Pet-Friendly',
  'Eco-Friendly',
  'Elderly-Friendly',
];

type SortOption = 'rating' | 'price-low' | 'price-high' | 'reviews' | 'available-now' | 'distance';

export default function CleanersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-5 py-20 text-center font-jost font-light text-ink-3 md:px-14">
          Loading cleaners...
        </div>
      }
    >
      <CleanersContent />
    </Suspense>
  );
}

function CleanersContent() {
  const searchParams = useSearchParams();
  const [postcode, setPostcode] = useState(searchParams.get('postcode') || '');
  const [postcodeSearch, setPostcodeSearch] = useState(searchParams.get('postcode') || '');
  const [postcodeError, setPostcodeError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>(postcode ? 'distance' : 'rating');
  const [cleanerCount, setCleanerCount] = useState<number | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState<Cleaner | null>(null);
  const [allCleaners, setAllCleaners] = useState<Cleaner[]>([]);
  const [loading, setLoading] = useState(true);

  const [propertySize, setPropertySize] = useState<number | null>(null);

  const fetchCleaners = useCallback(async (postcodeFilter?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (postcodeFilter) params.set('postcode', postcodeFilter);
      params.set('limit', '50');
      const res = await fetch(`/api/cleaners?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Map API response to match Cleaner type (fill defaults for missing fields)
        const mapped: Cleaner[] = data.cleaners.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: (c.name as string) || '',
          photo: (c.photo || c.image || '') as string,
          rating: (c.rating as number) || 0,
          reviewCount: (c.reviewCount as number) || 0,
          hourlyRateRegular: (c.hourlyRateRegular as number) || null,
          hourlyRateDeep: (c.hourlyRateDeep as number) || null,
          hourlyRateSameDay: (c.hourlyRateSameDay as number) || null,
          serviceTypes: (c.serviceTypes as string[]) || [],
          bio: (c.bio as string) || '',
          specialties: (c.specialties as string[]) || [],
          languages: (c.languages as string[]) || [],
          tier: (c.tier as string) || 'starter',
          location: (c.location as string) || '',
          postcodeAreas: [],
          verified: (c.verified as boolean) || false,
          identityVerified: (c.identityVerified as boolean) || false,
          backgroundChecked: (c.backgroundChecked as boolean) || false,
          yearsExperience: (c.yearsExperience as number) || 0,
          completedJobs: (c.completedJobs as number) || 0,
          availability: (c.availability as string[]) || [],
          timeSlots: (c.timeSlots as Record<string, string[]>) || {},
          availableNow: (c.availableNow as boolean) || false,
          responseTime: (c.responseTime as string) || '~15 min',
          categoryRatings: { thoroughness: 0, punctuality: 0, communication: 0, value: 0 },
          bringsProducts: false,
          productFee: 0,
          eotPrices: (c.eotPrices as Record<string, number>) || undefined,
          airbnbPrices: (c.airbnbPrices as Record<string, number>) || undefined,
          distance: (c.distance as number) ?? null,
        }));
        setAllCleaners(mapped);
        if (postcodeFilter) {
          setCleanerCount(data.count);
        }
      }
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCleaners(postcode || undefined);
  }, [fetchCleaners, postcode]);

  useEffect(() => {
    const serviceType = searchParams.get('serviceType');
    const bedrooms = searchParams.get('bedrooms');
    if (serviceType) {
      const filterMap: Record<string, string> = {
        regular: 'Regular Cleaning',
        deep: 'Deep Cleaning',
        'end-of-tenancy': 'End of Tenancy',
        eot: 'End of Tenancy',
        airbnb: 'Airbnb / Short-Let',
      };
      const mapped = filterMap[serviceType];
      if (mapped) setFilters([mapped]);
    }
    if (bedrooms !== null && bedrooms !== undefined) {
      const n = parseInt(bedrooms, 10);
      if (!isNaN(n)) setPropertySize(n);
    }
  }, [searchParams]);

  const isEotFilter = filters.includes('End of Tenancy');
  const isAirbnbFilter = filters.includes('Airbnb / Short-Let');

  const handlePostcodeSearch = () => {
    if (!postcodeSearch.trim()) {
      setPostcode('');
      setCleanerCount(null);
      setPostcodeError('');
      return;
    }
    const trimmed = postcodeSearch.trim();
    if (!/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i.test(trimmed)) {
      setPostcodeError('Please enter a valid UK postcode');
      return;
    }
    setPostcodeError('');
    setPostcode(trimmed.toUpperCase());
    setSort('distance');
  };

  const filtered = allCleaners
    .filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.specialties.some((s) => s.toLowerCase().includes(q));
      const matchesFilter =
        filters.length === 0 ||
        filters.every((f) => {
          const serviceSlug = FILTER_LABEL_TO_SERVICE_SLUG[f];
          if (serviceSlug)
            return c.serviceTypes.includes(serviceSlug) && serviceHasUsablePrice(c, serviceSlug);
          return c.specialties.some((s) => s.toLowerCase().includes(f.toLowerCase()));
        });
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sort === 'available-now') {
        if (a.availableNow !== b.availableNow) return a.availableNow ? -1 : 1;
        return b.rating - a.rating;
      }
      switch (sort) {
        case 'rating':
          return b.rating - a.rating;
        case 'price-low':
          return (a.hourlyRateRegular ?? 0) - (b.hourlyRateRegular ?? 0);
        case 'price-high':
          return (b.hourlyRateRegular ?? 0) - (a.hourlyRateRegular ?? 0);
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        case 'distance':
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        default:
          return 0;
      }
    });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header */}
      <section className="relative bg-ink px-5 py-12 md:px-14 md:py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink to-[#243656]" />
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-newsreader text-3xl font-semibold text-white sm:text-4xl">
            Browse cleaners
          </h1>
          <p className="mt-3 max-w-xl font-jost text-[15px] font-light leading-[1.7] text-white/70 md:text-[16px]">
            Browse our network of trusted, independent cleaning professionals — vetted, reviewed,
            and ready to help.
          </p>

          {/* Postcode search */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:max-w-lg">
            <div
              className="flex flex-1 overflow-hidden rounded-md bg-white"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <input
                type="text"
                placeholder="Enter your postcode"
                value={postcodeSearch}
                onChange={(e) => {
                  setPostcodeSearch(e.target.value);
                  if (postcodeError) setPostcodeError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSearch()}
                className="flex-1 bg-transparent px-4 py-3.5 font-jost text-[14px] text-ink placeholder:text-ink-3 focus:outline-none"
              />
              <button
                onClick={handlePostcodeSearch}
                className="bg-gold px-7 font-jost text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Search
              </button>
            </div>
          </div>
          {postcodeError && (
            <p className="mt-2 font-jost text-xs font-light text-red-400">{postcodeError}</p>
          )}

          {postcode && cleanerCount !== null && (
            <div className="mt-4 flex items-center gap-3">
              <span className="font-jost text-[13px] font-normal text-white">
                Searching near {postcode}
              </span>
              <span className="font-jost text-[13px] font-light text-white/50">
                {cleanerCount} cleaners found
              </span>
              <button
                onClick={() => {
                  setPostcode('');
                  setPostcodeSearch('');
                  setCleanerCount(null);
                }}
                className="font-jost text-[11px] uppercase tracking-[0.1em] text-white/50 underline hover:text-white"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Filters & sort */}
      <div className="border-b border-ink/5 bg-white px-5 py-5 md:px-14">
        <div className="mx-auto max-w-7xl">
          {/* Search + sort row */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Search by name or specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-b border-ink/10 bg-transparent px-1 py-2 font-jost text-[14px] font-light text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="border-b border-ink/10 bg-transparent px-1 py-2 font-jost text-[14px] font-light text-ink focus:border-ink focus:outline-none"
            >
              <option value="rating">Highest rated</option>
              {postcode && <option value="distance">Nearest first</option>}
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="reviews">Most reviews</option>
            </select>
          </div>

          {/* Filter tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setFilters([])}
              className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium tracking-wide transition ${
                filters.length === 0
                  ? 'bg-primary text-white'
                  : 'border border-line text-ink hover:border-ink-3/40'
              }`}
            >
              All
            </button>
            {SERVICE_FILTERS.filter((f) => f !== 'All').map((f) => {
              const isActive = filters.includes(f);
              return (
                <button
                  key={f}
                  onClick={() =>
                    setFilters((prev) => (isActive ? prev.filter((x) => x !== f) : [...prev, f]))
                  }
                  className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium tracking-wide transition ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'border border-line text-ink hover:border-ink-3/40'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>

          {/* Property size selector for EOT/Airbnb */}
          {(isEotFilter || isAirbnbFilter) && (
            <div className="mt-4 flex items-center gap-3">
              <span className="font-jost text-[12px] font-medium text-ink">Property size:</span>
              <div className="flex flex-wrap gap-1.5">
                {(isEotFilter
                  ? [
                      { n: 0, label: 'Studio' },
                      { n: 1, label: '1 Bed' },
                      { n: 2, label: '2 Bed' },
                      { n: 3, label: '3 Bed' },
                      { n: 4, label: '4 Bed' },
                      { n: 5, label: '5+ Bed' },
                    ]
                  : [
                      { n: 0, label: 'Studio' },
                      { n: 1, label: '1 Bed' },
                      { n: 2, label: '2 Bed' },
                      { n: 3, label: '3 Bed' },
                      { n: 4, label: '4+ Bed' },
                    ]
                ).map(({ n, label }) => (
                  <button
                    key={n}
                    onClick={() => setPropertySize(n)}
                    className={`rounded-full px-3 py-1 font-jost text-[11px] font-medium tracking-wide transition ${
                      (propertySize ?? 2) === n
                        ? 'bg-gold text-white'
                        : 'border border-ink/15 text-ink hover:border-ink/30'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <section className="px-5 py-10 md:px-14 md:py-14">
        <div className="mx-auto max-w-7xl">
          {loading ? (
            <p className="py-16 text-center font-jost text-[14px] font-light text-ink-3">
              Loading cleaners...
            </p>
          ) : (
            <>
              <p className="mb-6 font-jost text-[13px] font-light text-ink-3">
                {filtered.length} cleaner{filtered.length !== 1 ? 's' : ''} found
              </p>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((cleaner) => {
                  const bedroomKey = propertySize ?? 2;
                  let fixedPrice: number | null = null;
                  let fixedLabel: string | undefined;

                  if (isEotFilter && cleaner.eotPrices) {
                    const slug = BEDROOMS_TO_EOT_SIZE[bedroomKey];
                    if (slug) {
                      fixedPrice = cleaner.eotPrices[slug] ?? null;
                      fixedLabel = `${eotSizeLabel(slug)} EOT`;
                    }
                  } else if (isAirbnbFilter && cleaner.airbnbPrices) {
                    const slug = BEDROOMS_TO_AIRBNB_SIZE[bedroomKey];
                    if (slug) {
                      fixedPrice = cleaner.airbnbPrices[slug] ?? null;
                      fixedLabel = `${airbnbSizeLabel(slug)} Airbnb`;
                    }
                  }

                  return (
                    <CleanerCard
                      key={cleaner.id}
                      cleaner={cleaner}
                      onViewProfile={() => setSelectedCleaner(cleaner)}
                      fixedServicePrice={fixedPrice}
                      fixedServiceLabel={fixedLabel}
                      distance={cleaner.distance}
                      postcode={postcode || undefined}
                    />
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <p className="font-jost text-[16px] font-light text-ink-3">
                    No cleaners found matching your criteria.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Profile Modal */}
      {selectedCleaner && (
        <CleanerProfileModal
          cleaner={selectedCleaner}
          onClose={() => setSelectedCleaner(null)}
          postcode={postcode || undefined}
        />
      )}
    </div>
  );
}
