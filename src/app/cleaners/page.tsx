'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

import CleanerCard from '@/components/CleanerCard';
import CleanerProfileModal from '@/components/CleanerProfileModal';
import { cleaners } from '@/lib/mock-data';
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

  useEffect(() => {
    const serviceType = searchParams.get('serviceType');
    if (serviceType) {
      const filterMap: Record<string, string> = {
        regular: 'Regular Cleaning',
        deep: 'Deep Cleaning',
        'end-of-tenancy': 'End of Tenancy',
        airbnb: 'Airbnb Cleaning',
      };
      const mapped = filterMap[serviceType];
      if (mapped) setFilters([mapped]);
    }
  }, [searchParams]);

  const handlePostcodeSearch = () => {
    if (!postcodeSearch.trim()) {
      setPostcode('');
      setCleanerCount(null);
      return;
    }
    setPostcode(postcodeSearch.trim().toUpperCase());
    setCleanerCount(Math.floor(Math.random() * 5) + 4);
    setSort('distance');
  };

  const availableNowCount = cleaners.filter((c) => c.availableNow).length;

  const filtered = cleaners
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
        default:
          return 0;
      }
    });

  return (
    <div className="min-h-screen bg-white">
      {/* Hero header */}
      <section className="bg-cream px-5 py-6 md:px-14 md:py-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="font-cormorant text-[28px] font-light leading-tight text-ink md:text-[36px]">
            Find a cleaner
          </h1>
          <p className="mt-1.5 max-w-xl font-jost text-[14px] font-light leading-relaxed text-ink-2">
            Browse our network of trusted, independent cleaning professionals — vetted, reviewed,
            and ready to help.
          </p>

          {/* Postcode search */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:max-w-lg">
            <input
              type="text"
              placeholder="Enter your postcode"
              value={postcodeSearch}
              onChange={(e) => setPostcodeSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSearch()}
              className="flex-1 border-b border-ink/15 bg-transparent px-1 py-3 font-jost text-[15px] font-light text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            />
            <button
              onClick={handlePostcodeSearch}
              className="rounded-md bg-ink px-6 py-3 font-jost text-[13px] font-medium tracking-wide text-cream transition-opacity hover:opacity-90"
            >
              Search
            </button>
          </div>

          {postcode && cleanerCount !== null && (
            <div className="mt-4 flex items-center gap-3">
              <span className="font-jost text-[13px] font-normal text-ink">
                Searching near {postcode}
              </span>
              <span className="font-jost text-[13px] font-light text-ink-3">
                {cleanerCount} cleaners found
              </span>
              <button
                onClick={() => {
                  setPostcode('');
                  setPostcodeSearch('');
                  setCleanerCount(null);
                }}
                className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 underline hover:text-ink"
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
        </div>
      </div>

      {/* Results */}
      <section className="px-5 py-10 md:px-14 md:py-14">
        <div className="mx-auto max-w-7xl">
          <p className="mb-6 font-jost text-[13px] font-light text-ink-3">
            {filtered.length} cleaner{filtered.length !== 1 ? 's' : ''} found
          </p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((cleaner) => (
              <CleanerCard
                key={cleaner.id}
                cleaner={cleaner}
                onViewProfile={() => setSelectedCleaner(cleaner)}
              />
            ))}
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
        </div>
      </section>

      {/* Profile Modal */}
      {selectedCleaner && (
        <CleanerProfileModal cleaner={selectedCleaner} onClose={() => setSelectedCleaner(null)} />
      )}
    </div>
  );
}
