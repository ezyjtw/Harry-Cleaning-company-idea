'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense, useCallback } from 'react';

import CleanerCard from '@/components/CleanerCard';
import CleanerProfileModal from '@/components/CleanerProfileModal';
import type { Cleaner } from '@/lib/types';

const SERVICE_FILTERS = [
  'All',
  'Regular Cleaning',
  'Deep Cleaning',
  'End of Tenancy',
  'Airbnb Cleaning',
  'Pet-Friendly',
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
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>(postcode ? 'distance' : 'rating');
  const [availableNowOnly, setAvailableNowOnly] = useState(false);
  const [sameDayOnly, setSameDayOnly] = useState(false);
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
          hourlyRate: (c.hourlyRate as number) || 0,
          sameDayRate: (c.sameDayRate as number) || 0,
          bio: (c.bio as string) || '',
          specialties: (c.specialties as string[]) || [],
          languages: [],
          tier: (c.tier as string) || 'standard',
          location: (c.location as string) || '',
          postcodeAreas: [],
          verified: (c.verified as boolean) || false,
          identityVerified: (c.identityVerified as boolean) || false,
          backgroundChecked: (c.backgroundChecked as boolean) || false,
          yearsExperience: 0,
          completedJobs: (c.completedJobs as number) || 0,
          availability: [],
          timeSlots: {},
          availableNow: (c.availableNow as boolean) || false,
          responseTime: (c.responseTime as string) || '~15 min',
          categoryRatings: { thoroughness: 0, punctuality: 0, communication: 0, value: 0 },
          bringsProducts: false,
          productFee: 0,
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
        airbnb: 'Airbnb Cleaning',
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
  const isAirbnbFilter = filters.includes('Airbnb Cleaning');

  const handlePostcodeSearch = () => {
    if (!postcodeSearch.trim()) {
      setPostcode('');
      setCleanerCount(null);
      return;
    }
    setPostcode(postcodeSearch.trim().toUpperCase());
    setSort('distance');
  };

  const availableNowCount = allCleaners.filter((c) => c.availableNow).length;

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
        filters.every((f) => c.specialties.some((s) => s.toLowerCase().includes(f.toLowerCase())));
      const matchesAvailability = !availableNowOnly || c.availableNow;
      const matchesSameDay = !sameDayOnly || c.availableNow;
      return matchesSearch && matchesFilter && matchesAvailability && matchesSameDay;
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
          return a.hourlyRate - b.hourlyRate;
        case 'price-high':
          return b.hourlyRate - a.hourlyRate;
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        case 'distance':
          return (
            (((a as unknown as Record<string, unknown>).distance as number) ?? Infinity) -
            (((b as unknown as Record<string, unknown>).distance as number) ?? Infinity)
          );
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
          <p className="mb-3 font-jost text-[12px] uppercase tracking-[0.2em] text-gold">
            Browse cleaners
          </p>
          <p className="mt-1 max-w-xl font-jost text-[15px] font-light leading-[1.7] text-white/70 md:text-[16px]">
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
                onChange={(e) => setPostcodeSearch(e.target.value)}
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

      {/* Available now banner */}
      {availableNowCount > 0 && (
        <div className="border-b border-ink/5 bg-white px-5 py-4 md:px-14">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal" />
              </span>
              <p className="font-jost text-[14px] font-normal text-ink">
                {availableNowCount} cleaner{availableNowCount !== 1 ? 's' : ''} available for
                same-day booking
              </p>
            </div>
            <button
              onClick={() => {
                setAvailableNowOnly(true);
                setSort('available-now');
              }}
              className="font-jost text-[12px] font-medium uppercase tracking-[0.1em] text-ink underline underline-offset-4 hover:text-ink-2"
            >
              Show available now
            </button>
          </div>
        </div>
      )}

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
              <option value="available-now">Available now first</option>
              <option value="price-low">Price: low to high</option>
              <option value="price-high">Price: high to low</option>
              <option value="reviews">Most reviews</option>
            </select>
          </div>

          {/* Filter tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setAvailableNowOnly(!availableNowOnly)}
              className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium tracking-wide transition ${
                availableNowOnly
                  ? 'bg-ink text-cream'
                  : 'border border-ink/15 text-ink hover:border-ink/30'
              }`}
            >
              Available now
            </button>
            <button
              onClick={() => {
                setSameDayOnly(!sameDayOnly);
              }}
              className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium tracking-wide transition ${
                sameDayOnly
                  ? 'bg-ink text-cream'
                  : 'border border-ink/15 text-ink hover:border-ink/30'
              }`}
            >
              Same Day
            </button>
            <span className="w-px bg-ink/10" />
            <button
              onClick={() => setFilters([])}
              className={`rounded-full px-4 py-1.5 font-jost text-[12px] font-medium tracking-wide transition ${
                filters.length === 0
                  ? 'bg-ink text-cream'
                  : 'border border-ink/15 text-ink hover:border-ink/30'
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
                      ? 'bg-ink text-cream'
                      : 'border border-ink/15 text-ink hover:border-ink/30'
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
                  const sizeLabels: Record<number, string> = {
                    0: 'studio',
                    1: '1-bed',
                    2: '2-bed',
                    3: '3-bed',
                    4: '4-bed',
                    5: '5+ bed',
                  };

                  if (isEotFilter && cleaner.eotPrices) {
                    const key = Math.min(bedroomKey, 5);
                    fixedPrice = cleaner.eotPrices[key] ?? null;
                    fixedLabel = `${sizeLabels[key] ?? `${key}-bed`} EOT`;
                  } else if (isAirbnbFilter && cleaner.airbnbPrices) {
                    const key = Math.min(bedroomKey, 4);
                    fixedPrice = cleaner.airbnbPrices[key] ?? null;
                    fixedLabel = `${sizeLabels[key] ?? `${key}-bed`} Airbnb`;
                  }

                  return (
                    <CleanerCard
                      key={cleaner.id}
                      cleaner={cleaner}
                      onViewProfile={() => setSelectedCleaner(cleaner)}
                      fixedServicePrice={fixedPrice}
                      fixedServiceLabel={fixedLabel}
                      distance={
                        (cleaner as unknown as Record<string, unknown>).distance as number | null
                      }
                    />
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <div className="py-16 text-center">
                  <p className="font-jost text-[16px] font-light text-ink-3">
                    No cleaners found matching your criteria.
                  </p>
                  {availableNowOnly && (
                    <button
                      onClick={() => setAvailableNowOnly(false)}
                      className="mt-4 font-jost text-[13px] font-normal text-ink underline underline-offset-4 hover:text-ink-2"
                    >
                      Show all cleaners instead
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Profile Modal */}
      {selectedCleaner && (
        <CleanerProfileModal cleaner={selectedCleaner} onClose={() => setSelectedCleaner(null)} />
      )}
    </div>
  );
}
