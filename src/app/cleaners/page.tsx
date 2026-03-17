'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

import CleanerCard from '@/components/CleanerCard';
import { cleaners } from '@/lib/mock-data';

const SERVICE_FILTERS = [
  'All',
  'Deep Cleaning',
  'Eco-Friendly',
  'Office Cleaning',
  'Move-In/Out',
  'Pet-Friendly',
];

type SortOption = 'rating' | 'price-low' | 'price-high' | 'reviews' | 'available-now' | 'distance';

export default function CleanersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-12 text-center font-jost font-light text-ink-3">
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
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState<SortOption>(postcode ? 'distance' : 'rating');
  const [availableNowOnly, setAvailableNowOnly] = useState(false);
  const [cleanerCount, setCleanerCount] = useState<number | null>(null);

  // Read URL params on mount
  useEffect(() => {
    const serviceType = searchParams.get('serviceType');
    if (serviceType) {
      const filterMap: Record<string, string> = {
        regular: 'All',
        deep: 'Deep Cleaning',
        'end-of-tenancy': 'All',
        airbnb: 'All',
      };
      setFilter(filterMap[serviceType] || 'All');
    }
  }, [searchParams]);

  const handlePostcodeSearch = () => {
    if (!postcodeSearch.trim()) {
      setPostcode('');
      setCleanerCount(null);
      return;
    }
    setPostcode(postcodeSearch.trim().toUpperCase());
    // Simulate finding cleaners near the postcode
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
        filter === 'All' ||
        c.specialties.some((s) => s.toLowerCase().includes(filter.toLowerCase()));
      const matchesAvailability = !availableNowOnly || c.availableNow;
      return matchesSearch && matchesFilter && matchesAvailability;
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
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="font-cormorant text-3xl font-light text-ink">Find a Cleaner</h1>
        <p className="mt-2 font-jost font-light text-ink-2">
          Browse our network of trusted, independent cleaning professionals.
        </p>

        {/* Last-minute banner */}
        {availableNowCount > 0 && (
          <div
            className="mt-6 bg-cream-2 p-4 sm:p-6"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping bg-gold opacity-75" />
                    <span className="relative inline-flex h-3 w-3 bg-gold" />
                  </span>
                  <h2 className="font-cormorant text-lg font-light text-ink">
                    Need a cleaner today?
                  </h2>
                </div>
                <p className="mt-1 font-jost text-sm font-light text-ink-2">
                  {availableNowCount} cleaner{availableNowCount !== 1 ? 's' : ''} available for
                  same-day booking right now.
                </p>
              </div>
              <button
                onClick={() => {
                  setAvailableNowOnly(true);
                  setSort('available-now');
                }}
                className="shrink-0 bg-ink px-5 py-2.5 font-jost text-sm font-normal text-cream transition hover:opacity-90"
              >
                Show Available Now
              </button>
            </div>
          </div>
        )}

        {/* Postcode search — primary input */}
        <div
          className="mt-8 bg-cream-2 p-4 sm:p-6"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink">Find cleaners near you</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Enter your postcode (e.g. NW4 3BT)"
              value={postcodeSearch}
              onChange={(e) => setPostcodeSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSearch()}
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              className="flex-1 bg-cream px-4 py-2.5 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
            />
            <button
              onClick={handlePostcodeSearch}
              className="bg-ink px-6 py-2.5 font-jost text-sm font-normal text-cream transition hover:opacity-90"
            >
              Search
            </button>
          </div>
          {postcode && cleanerCount !== null && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 bg-cream px-3 py-1 font-jost text-sm font-normal text-ink"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Searching near {postcode}
              </span>
              <span className="font-jost text-sm font-light text-ink-2">
                {cleanerCount} cleaners found
              </span>
              <button
                onClick={() => {
                  setPostcode('');
                  setPostcodeSearch('');
                  setCleanerCount(null);
                }}
                className="ml-2 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink underline"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Name/specialty search & Sort */}
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            placeholder="Search by name or specialty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            className="flex-1 bg-cream px-4 py-2 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            className="bg-cream px-4 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink"
          >
            <option value="rating">Highest Rated</option>
            {postcode && <option value="distance">Nearest First</option>}
            <option value="available-now">Available Now First</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="reviews">Most Reviews</option>
          </select>
        </div>

        {/* Filter tags */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setAvailableNowOnly(!availableNowOnly)}
            className={`px-4 py-1.5 font-jost text-sm font-normal transition ${
              availableNowOnly ? 'bg-ink text-cream' : 'bg-cream text-ink'
            }`}
            style={availableNowOnly ? undefined : { border: '0.5px solid #0e0e0c' }}
          >
            Available Now ({availableNowCount})
          </button>
          <span className="w-px bg-cream-2" />
          {SERVICE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 font-jost text-sm font-normal transition ${
                filter === f ? 'bg-ink text-cream' : 'bg-cream text-ink'
              }`}
              style={filter === f ? undefined : { border: '0.5px solid #0e0e0c' }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cleaner) => (
            <CleanerCard key={cleaner.id} cleaner={cleaner} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center">
            <p className="font-jost text-lg font-light text-ink-3">
              No cleaners found matching your criteria. Try adjusting your search or filters.
            </p>
            {availableNowOnly && (
              <button
                onClick={() => setAvailableNowOnly(false)}
                className="mt-4 font-jost font-normal text-gold hover:underline"
              >
                Show all cleaners instead
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
