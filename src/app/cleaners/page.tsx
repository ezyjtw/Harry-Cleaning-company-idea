"use client";

import { useState } from "react";
import Link from "next/link";
import CleanerCard from "@/components/CleanerCard";
import { cleaners } from "@/lib/mock-data";

const SERVICE_FILTERS = [
  "All",
  "Deep Cleaning",
  "Eco-Friendly",
  "Office Cleaning",
  "Move-In/Out",
  "Pet-Friendly",
];

type SortOption = "rating" | "price-low" | "price-high" | "reviews" | "available-now";

export default function CleanersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<SortOption>("rating");
  const [availableNowOnly, setAvailableNowOnly] = useState(false);

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
        filter === "All" ||
        c.specialties.some((s) => s.toLowerCase().includes(filter.toLowerCase()));
      const matchesAvailability = !availableNowOnly || c.availableNow;
      return matchesSearch && matchesFilter && matchesAvailability;
    })
    .sort((a, b) => {
      if (sort === "available-now") {
        if (a.availableNow !== b.availableNow) return a.availableNow ? -1 : 1;
        return b.rating - a.rating;
      }
      switch (sort) {
        case "rating":
          return b.rating - a.rating;
        case "price-low":
          return a.hourlyRate - b.hourlyRate;
        case "price-high":
          return b.hourlyRate - a.hourlyRate;
        case "reviews":
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
                <h2 className="text-lg font-bold text-green-800">
                  Need a cleaner today?
                </h2>
              </div>
              <p className="mt-1 text-sm text-green-700">
                {availableNowCount} cleaner{availableNowCount !== 1 ? "s" : ""} available
                for same-day booking right now.
              </p>
            </div>
            <button
              onClick={() => {
                setAvailableNowOnly(true);
                setSort("available-now");
              }}
              className="shrink-0 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Show Available Now
            </button>
          </div>
        </div>
      )}

      {/* Search & Sort */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <input
          type="text"
          placeholder="Search by name, location, or specialty..."
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
              ? "bg-green-600 text-white"
              : "bg-green-50 text-green-700 ring-1 ring-inset ring-green-200 hover:bg-green-100"
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
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
            No cleaners found matching your criteria. Try adjusting your search
            or filters.
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
