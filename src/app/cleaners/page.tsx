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
        <div className="mx-auto max-w-7xl px-4 py-12 text-center text-gray-500">
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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Find a Cleaner</h1>
      <p className="mt-2 text-gray-600">
        Browse our network of trusted, independent cleaning professionals.
      </p>

      {/* Last-minute banner */}
      {availableNowCount > 0 && (
        <div className="mt-6 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
                </span>
                <h2 className="text-lg font-bold text-green-800">Need a cleaner today?</h2>
              </div>
              <p className="mt-1 text-sm text-green-700">
                {availableNowCount} cleaner{availableNowCount !== 1 ? 's' : ''} available for
                same-day booking right now.
              </p>
            </div>
            <button
              onClick={() => {
                setAvailableNowOnly(true);
                setSort('available-now');
              }}
              className="shrink-0 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Show Available Now
            </button>
          </div>
        </div>
      )}

      {/* Postcode search — primary input */}
      <div className="mt-8 rounded-xl bg-brand-50 border border-brand-200 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Find cleaners near you</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            placeholder="Enter your postcode (e.g. NW4 3BT)"
            value={postcodeSearch}
            onChange={(e) => setPostcodeSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePostcodeSearch()}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          <button
            onClick={handlePostcodeSearch}
            className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Search
          </button>
        </div>
        {postcode && cleanerCount !== null && (
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-700">
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
            <span className="text-sm text-gray-600">{cleanerCount} cleaners found</span>
            <button
              onClick={() => {
                setPostcode('');
                setPostcodeSearch('');
                setCleanerCount(null);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-2"
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
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
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
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            availableNowOnly
              ? 'bg-green-600 text-white'
              : 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200 hover:bg-green-100'
          }`}
        >
          Available Now ({availableNowCount})
        </button>
        <span className="w-px bg-gray-200" />
        {SERVICE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
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
          <p className="text-lg text-gray-500">
            No cleaners found matching your criteria. Try adjusting your search or filters.
          </p>
          {availableNowOnly && (
            <button
              onClick={() => setAvailableNowOnly(false)}
              className="mt-4 text-brand-600 font-medium hover:text-brand-700"
            >
              Show all cleaners instead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
