"use client";

import { useState } from "react";
import StarRating from "@/components/StarRating";

const MOCK_BOOKINGS = [
  {
    id: "b1",
    customer: "Sarah M.",
    address: "123 Main St, Apt 4B",
    date: "2026-03-10",
    time: "10:00",
    duration: 3,
    serviceType: "Deep Cleaning",
    status: "confirmed" as const,
    total: 157.5,
  },
  {
    id: "b2",
    customer: "Tom K.",
    address: "456 Oak Ave",
    date: "2026-03-12",
    time: "14:00",
    duration: 2,
    serviceType: "Standard Cleaning",
    status: "pending" as const,
    total: 70,
  },
  {
    id: "b3",
    customer: "Linda R.",
    address: "789 Elm St, Suite 200",
    date: "2026-02-28",
    time: "09:00",
    duration: 4,
    serviceType: "Office Cleaning",
    status: "completed" as const,
    total: 182,
  },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "profile">(
    "upcoming"
  );

  const upcoming = MOCK_BOOKINGS.filter(
    (b) => b.status === "confirmed" || b.status === "pending"
  );
  const past = MOCK_BOOKINGS.filter((b) => b.status === "completed");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Cleaner Dashboard</h1>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">This Month</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">$1,245</div>
          <div className="text-xs text-brand-600">+12% from last month</div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Jobs</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">47</div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Rating</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">4.9</span>
            <StarRating rating={4.9} />
          </div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {upcoming.filter((b) => b.status === "pending").length}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-4 border-b border-gray-200">
        {[
          { key: "upcoming" as const, label: "Upcoming Bookings" },
          { key: "past" as const, label: "Past Jobs" },
          { key: "profile" as const, label: "My Profile" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "upcoming" && (
          <div className="space-y-4">
            {upcoming.length === 0 ? (
              <p className="text-gray-500">No upcoming bookings.</p>
            ) : (
              upcoming.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {booking.customer}
                    </div>
                    <div className="text-sm text-gray-500">
                      {booking.address}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {booking.date} at {booking.time} &middot;{" "}
                      {booking.duration}h &middot; {booking.serviceType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${booking.total.toFixed(2)}
                    </div>
                    <span
                      className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                        booking.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "past" && (
          <div className="space-y-4">
            {past.length === 0 ? (
              <p className="text-gray-500">No completed jobs yet.</p>
            ) : (
              past.map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {booking.customer}
                    </div>
                    <div className="text-sm text-gray-500">
                      {booking.address}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {booking.date} at {booking.time} &middot;{" "}
                      {booking.duration}h &middot; {booking.serviceType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${booking.total.toFixed(2)}
                    </div>
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">
                      completed
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                type="text"
                defaultValue="Maria Santos"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Bio
              </label>
              <textarea
                rows={3}
                defaultValue="Professional cleaner with 8 years of experience..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hourly Rate ($)
                </label>
                <input
                  type="number"
                  defaultValue={35}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Location
                </label>
                <input
                  type="text"
                  defaultValue="Manhattan, NY"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            </div>
            <button className="rounded-lg bg-brand-600 px-6 py-2 font-semibold text-white hover:bg-brand-700">
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
