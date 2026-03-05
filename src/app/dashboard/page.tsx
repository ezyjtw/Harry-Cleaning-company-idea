"use client";

import { useState } from "react";
import StarRating from "@/components/StarRating";
import CategoryRatingBar from "@/components/CategoryRatingBar";

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
    isLastMinute: false,
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
    isLastMinute: true,
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
    isLastMinute: false,
    customerRating: null as number | null,
  },
];

const MOCK_REVIEWS_FROM_CUSTOMERS = [
  {
    id: "rv1",
    customer: "Sarah M.",
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 5, communication: 5, value: 5 },
    comment: "Maria is absolutely fantastic! My apartment has never looked this clean.",
    date: "2026-02-28",
    replied: true,
    reply: "Thank you so much, Sarah! It was a pleasure working in your home.",
  },
  {
    id: "rv2",
    customer: "Linda R.",
    rating: 4,
    categoryRatings: { thoroughness: 4, punctuality: 5, communication: 4, value: 4 },
    comment: "Great cleaning overall. Only reason for 4 stars is I wish she had spent a bit more time on the windows.",
    date: "2026-02-10",
    replied: false,
    reply: "",
  },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<
    "upcoming" | "past" | "reviews" | "profile"
  >("upcoming");
  const [availableNow, setAvailableNow] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [customerRating, setCustomerRating] = useState<Record<string, number>>({});

  const upcoming = MOCK_BOOKINGS.filter(
    (b) => b.status === "confirmed" || b.status === "pending"
  );
  const past = MOCK_BOOKINGS.filter((b) => b.status === "completed");

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Cleaner Dashboard</h1>
        {/* Available Now toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Available Now</span>
          <button
            onClick={() => setAvailableNow(!availableNow)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              availableNow ? "bg-green-500" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={availableNow}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition transform ${
                availableNow ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          {availableNow && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
          )}
        </div>
      </div>

      {availableNow && (
        <div className="mt-3 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">
          You are visible to customers looking for same-day cleaning. Last-minute bookings will use your same-day rate.
        </div>
      )}

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

      {/* Category rating summary */}
      <div className="mt-6 rounded-lg bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700">Your Detailed Ratings</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <CategoryRatingBar label="Thoroughness" value={4.9} />
          <CategoryRatingBar label="Punctuality" value={5.0} />
          <CategoryRatingBar label="Communication" value={4.8} />
          <CategoryRatingBar label="Value for Money" value={4.9} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-4 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "upcoming" as const, label: "Upcoming Bookings" },
          { key: "past" as const, label: "Past Jobs" },
          { key: "reviews" as const, label: "Reviews" },
          { key: "profile" as const, label: "My Profile" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {booking.customer}
                      </span>
                      {booking.isLastMinute && (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
                          Same-day
                        </span>
                      )}
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
                    {booking.status === "pending" && (
                      <div className="mt-2 flex gap-2">
                        <button className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700">
                          Accept
                        </button>
                        <button className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300">
                          Decline
                        </button>
                      </div>
                    )}
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
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between">
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
                  {/* Rate customer (two-way rating) */}
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-sm font-medium text-gray-700">
                      Rate this customer:
                    </p>
                    <div className="mt-2 flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() =>
                            setCustomerRating({
                              ...customerRating,
                              [booking.id]: star,
                            })
                          }
                          className={`text-2xl transition ${
                            (customerRating[booking.id] || 0) >= star
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                        >
                          &#9733;
                        </button>
                      ))}
                      {customerRating[booking.id] && (
                        <span className="ml-2 self-center text-sm text-gray-500">
                          {customerRating[booking.id]}/5
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Reviews from verified customers who completed a booking with you.
              You can reply to any review.
            </p>
            {MOCK_REVIEWS_FROM_CUSTOMERS.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {review.customer}
                    </span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                      Verified
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{review.date}</span>
                </div>
                <div className="mt-1">
                  <StarRating rating={review.rating} />
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Thoroughness: {review.categoryRatings.thoroughness}/5</span>
                  <span>Punctuality: {review.categoryRatings.punctuality}/5</span>
                  <span>Communication: {review.categoryRatings.communication}/5</span>
                  <span>Value: {review.categoryRatings.value}/5</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{review.comment}</p>

                {/* Existing reply */}
                {review.replied && review.reply && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">
                      Your reply:
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{review.reply}</p>
                  </div>
                )}

                {/* Reply form */}
                {!review.replied && (
                  <div className="mt-3">
                    <textarea
                      rows={2}
                      placeholder="Write a professional reply..."
                      value={replyText[review.id] || ""}
                      onChange={(e) =>
                        setReplyText({ ...replyText, [review.id]: e.target.value })
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                    <button className="mt-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      Post Reply
                    </button>
                  </div>
                )}
              </div>
            ))}
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
                  Same-Day Rate ($)
                </label>
                <input
                  type="number"
                  defaultValue={50}
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
