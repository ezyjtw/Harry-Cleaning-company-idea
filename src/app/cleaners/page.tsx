"use client";

import { useState } from "react";
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

type SortOption = "rating" | "price-low" | "price-high" | "reviews";

export default function CleanersPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState<SortOption>("rating");

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
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
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
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="reviews">Most Reviews</option>
        </select>
      </div>

      {/* Filter tags */}
      <div className="mt-4 flex flex-wrap gap-2">
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
        </div>
      )}
    </div>
  );
}
