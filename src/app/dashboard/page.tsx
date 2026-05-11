'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import CategoryRatingBar from '@/components/CategoryRatingBar';
import StarRating from '@/components/StarRating';
import { useAuth } from '@/hooks/useAuth';
import { PLATFORM_COMMISSION_PERCENT } from '@/lib/pricing';

// Types for API data
interface Booking {
  id: string;
  customer: string;
  address: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  status: 'confirmed' | 'pending' | 'completed';
  total: number;
  cleanerEarnings: number;
  isLastMinute: boolean;
}

interface ReviewFromCustomer {
  id: string;
  customer: string;
  rating: number;
  categoryRatings: {
    thoroughness: number;
    punctuality: number;
    communication: number;
    value: number;
  };
  comment: string;
  date: string;
  replied: boolean;
  reply: string;
}

interface TaxData {
  yearToDate: {
    totalEarnings: number;
    platformFees: number;
    netEarnings: number;
    estimatedTax: number;
    quarterlyPayment: number;
    deductibleExpenses: number;
  };
  monthlyEarnings: { month: string; amount: number }[];
  expenses: { id: string; category: string; amount: number; date: string }[];
}

// Reputation tiers
function getReputationTier(completedJobs: number, rating: number) {
  if (completedJobs >= 500 && rating >= 4.8)
    return {
      tier: 'Gold',
      color: 'text-yellow-600 bg-yellow-50 ring-yellow-200',
      progress: 100,
      nextTier: null,
      jobsNeeded: 0,
    };
  if (completedJobs >= 200 && rating >= 4.5)
    return {
      tier: 'Silver',
      color: 'text-gray-600 bg-gray-50 ring-gray-200',
      progress: Math.round((completedJobs / 500) * 100),
      nextTier: 'Gold',
      jobsNeeded: 500 - completedJobs,
    };
  if (completedJobs >= 50 && rating >= 4.0)
    return {
      tier: 'Bronze',
      color: 'text-orange-600 bg-orange-50 ring-orange-200',
      progress: Math.round((completedJobs / 200) * 100),
      nextTier: 'Silver',
      jobsNeeded: 200 - completedJobs,
    };
  return {
    tier: 'Starter',
    color: 'text-brand-600 bg-brand-50 ring-brand-200',
    progress: Math.round((completedJobs / 50) * 100),
    nextTier: 'Bronze',
    jobsNeeded: 50 - completedJobs,
  };
}

// Calendar helpers
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Component ───────────────────────────────────────────────

type DashboardTab = 'upcoming' | 'calendar' | 'earnings' | 'reviews' | 'profile';

export default function DashboardPage() {
  const router = useRouter();
  const { isCleaner, isAdmin, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('upcoming');
  const [availableNow, setAvailableNow] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (isCleaner) router.replace('/cleaner');
    else if (isAdmin) router.replace('/admin');
  }, [authLoading, isCleaner, isAdmin, router]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [customerRating, setCustomerRating] = useState<Record<string, number>>({});
  const [availability, setAvailability] = useState(
    DAYS_OF_WEEK.reduce(
      (acc, d) => ({ ...acc, [d]: { available: true, start: '09:00', end: '17:00' } }),
      {} as Record<string, { available: boolean; start: string; end: string }>
    )
  );
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<ReviewFromCustomer[]>([]);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [bookingsRes, reviewsRes, taxRes] = await Promise.all([
          fetch('/api/cleaner/bookings').then((r) => (r.ok ? r.json() : { bookings: [] })),
          fetch('/api/cleaner/reviews').then((r) => (r.ok ? r.json() : { reviews: [] })),
          fetch('/api/cleaner/earnings').then((r) => (r.ok ? r.json() : null)),
        ]);
        setBookings(bookingsRes.bookings || []);
        setReviews(reviewsRes.reviews || []);
        setTaxData(taxRes);
      } catch {
        // API not available yet, use empty state
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const upcoming = bookings.filter((b) => b.status === 'confirmed' || b.status === 'pending');
  const past = bookings.filter((b) => b.status === 'completed');
  const reputation = getReputationTier(past.length, 0);
  const tax = taxData || {
    yearToDate: {
      totalEarnings: 0,
      platformFees: 0,
      netEarnings: 0,
      estimatedTax: 0,
      quarterlyPayment: 0,
      deductibleExpenses: 0,
    },
    monthlyEarnings: [],
    expenses: [],
  };

  const toggleDayAvailability = (day: string) => {
    setAvailability({
      ...availability,
      [day]: { ...availability[day], available: !availability[day].available },
    });
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-gray-500">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header with available toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Cleaner Dashboard</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Available Now</span>
          <button
            onClick={() => setAvailableNow(!availableNow)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              availableNow ? 'bg-green-500' : 'bg-gray-300'
            }`}
            role="switch"
            aria-checked={availableNow}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition transform ${
                availableNow ? 'translate-x-6' : 'translate-x-1'
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
          You are visible to customers looking for same-day cleaning. Last-minute bookings will use
          your same-day rate.
        </div>
      )}

      {/* Stats row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-5">
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">This Month</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            $
            {tax.monthlyEarnings.length > 0
              ? tax.monthlyEarnings[tax.monthlyEarnings.length - 1].amount.toLocaleString()
              : '0'}
          </div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Jobs</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{past.length}</div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Rating</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {reviews.length > 0
                ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                : '--'}
            </span>
            <StarRating
              rating={
                reviews.length > 0
                  ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                  : 0
              }
            />
          </div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {upcoming.filter((b) => b.status === 'pending').length}
          </div>
        </div>
        <div className="rounded-lg bg-white border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Reputation</div>
          <div className="mt-1">
            <span
              className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-bold ring-1 ring-inset ${reputation.color}`}
            >
              {reputation.tier}
            </span>
          </div>
        </div>
      </div>

      {/* Reputation progress */}
      <div className="mt-4 rounded-lg bg-white border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700">Reputation Level</h3>
            <p className="mt-1 text-xs text-gray-500">
              {reputation.nextTier
                ? `${reputation.jobsNeeded} more jobs to reach ${reputation.nextTier}. Higher tiers get featured placement, priority in search results, and a trust badge on your profile.`
                : "You've reached the highest tier! You get featured placement and priority in search results."}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Repeat client rate</div>
            <div className="text-lg font-bold text-brand-600">73%</div>
          </div>
        </div>
        {reputation.nextTier && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{reputation.tier}</span>
              <span>{reputation.nextTier}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${reputation.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category ratings */}
      <div className="mt-4 rounded-lg bg-white border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700">Your Detailed Ratings</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <CategoryRatingBar label="Thoroughness" value={4.9} />
          <CategoryRatingBar label="Punctuality" value={5.0} />
          <CategoryRatingBar label="Communication" value={4.8} />
          <CategoryRatingBar label="Value for Money" value={4.9} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 border-b border-gray-200 overflow-x-auto">
        {[
          { key: 'upcoming' as DashboardTab, label: 'Bookings' },
          { key: 'calendar' as DashboardTab, label: 'Calendar' },
          { key: 'earnings' as DashboardTab, label: 'Earnings & Tax' },
          { key: 'reviews' as DashboardTab, label: 'Reviews' },
          { key: 'profile' as DashboardTab, label: 'Profile' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {/* ─── Bookings Tab ─── */}
        {activeTab === 'upcoming' && (
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Upcoming ({upcoming.length})
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-gray-500">No upcoming bookings.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{booking.customer}</span>
                        {booking.isLastMinute && (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
                            Same-day
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{booking.address}</div>
                      <div className="mt-1 text-sm text-gray-500">
                        {booking.date} at {booking.time} &middot; {booking.duration}h &middot;{' '}
                        {booking.serviceType}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        ${booking.cleanerEarnings.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">you earn</div>
                      <span
                        className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${
                          booking.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {booking.status}
                      </span>
                      {booking.status === 'pending' && (
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
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide pt-4">
              Completed ({past.length})
            </h3>
            {past.map((booking) => (
              <div key={booking.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{booking.customer}</div>
                    <div className="text-sm text-gray-500">{booking.address}</div>
                    <div className="mt-1 text-sm text-gray-500">
                      {booking.date} at {booking.time} &middot; {booking.duration}h &middot;{' '}
                      {booking.serviceType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${booking.cleanerEarnings.toFixed(2)}
                    </div>
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600">
                      completed
                    </span>
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-700">Rate this customer:</p>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setCustomerRating({ ...customerRating, [booking.id]: star })}
                        className={`text-2xl transition ${
                          (customerRating[booking.id] || 0) >= star
                            ? 'text-yellow-400'
                            : 'text-gray-300'
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
            ))}
          </div>
        )}

        {/* ─── Calendar Tab ─── */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Weekly Availability</h3>
              <p className="mt-1 text-sm text-gray-500">
                Set your weekly schedule. Customers will only be able to book during your available
                hours. Sync with Google Calendar or Apple Calendar to avoid double-bookings.
              </p>
            </div>

            {/* Calendar sync buttons */}
            <div className="flex gap-3">
              <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Sync Google Calendar
              </button>
              <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Sync Apple Calendar
              </button>
            </div>

            {/* Weekly schedule */}
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className={`flex items-center justify-between rounded-lg border p-4 transition ${
                    availability[day].available
                      ? 'border-brand-200 bg-brand-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleDayAvailability(day)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                        availability[day].available ? 'bg-brand-500' : 'bg-gray-300'
                      }`}
                      role="switch"
                      aria-checked={availability[day].available}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition transform ${
                          availability[day].available ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span
                      className={`w-12 text-sm font-medium ${
                        availability[day].available ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {day}
                    </span>
                  </div>
                  {availability[day].available && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={availability[day].start}
                        onChange={(e) =>
                          setAvailability({
                            ...availability,
                            [day]: { ...availability[day], start: e.target.value },
                          })
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        value={availability[day].end}
                        onChange={(e) =>
                          setAvailability({
                            ...availability,
                            [day]: { ...availability[day], end: e.target.value },
                          })
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  )}
                  {!availability[day].available && (
                    <span className="text-sm text-gray-400">Day off</span>
                  )}
                </div>
              ))}
            </div>

            {/* Upcoming week view */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-gray-700">This Week&apos;s Bookings</h4>
              <div className="mt-3 grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map((day) => {
                  const dayBookings = upcoming.filter((b) => {
                    const bookingDay = new Date(b.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                    });
                    return bookingDay === day;
                  });
                  return (
                    <div
                      key={day}
                      className="rounded-lg border border-gray-100 p-2 text-center min-h-[80px]"
                    >
                      <div className="text-xs font-medium text-gray-500">{day}</div>
                      {dayBookings.map((b) => (
                        <div
                          key={b.id}
                          className="mt-1 rounded bg-brand-100 px-1 py-0.5 text-xs text-brand-700"
                        >
                          {b.time}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <button className="w-full rounded-lg bg-brand-600 py-2 font-semibold text-white hover:bg-brand-700">
              Save Schedule
            </button>
          </div>
        )}

        {/* ─── Earnings & Tax Tab ─── */}
        {activeTab === 'earnings' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Earnings & Tax Management</h3>
              <p className="mt-1 text-sm text-gray-500">
                Track your income, log expenses, and stay on top of your tax obligations. We handle
                the maths so you can focus on cleaning.
              </p>
            </div>

            {/* Year-to-date summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="text-sm text-green-700">Year-to-Date Earnings</div>
                <div className="mt-1 text-2xl font-bold text-green-800">
                  ${tax.yearToDate.netEarnings.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-green-600">
                  After ${tax.yearToDate.platformFees.toLocaleString()} in platform commission (
                  {PLATFORM_COMMISSION_PERCENT}%)
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="text-sm text-amber-700">Estimated Tax Owed</div>
                <div className="mt-1 text-2xl font-bold text-amber-800">
                  ${tax.yearToDate.estimatedTax.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-amber-600">
                  Based on self-employment rate (22.5%)
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="text-sm text-blue-700">Quarterly Payment Due</div>
                <div className="mt-1 text-2xl font-bold text-blue-800">
                  ${tax.yearToDate.quarterlyPayment.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-blue-600">Next due: April 15, 2026</div>
              </div>
            </div>

            {/* Monthly earnings chart */}
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700">Monthly Earnings</h4>
              <div className="mt-4 flex items-end gap-3 h-32">
                {tax.monthlyEarnings.map((m) => {
                  const maxAmount = Math.max(...tax.monthlyEarnings.map((e) => e.amount));
                  const height = (m.amount / maxAmount) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-700">${m.amount}</span>
                      <div
                        className="w-full rounded-t bg-brand-500"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-gray-500">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expense tracker */}
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700">Tax-Deductible Expenses</h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Log your cleaning supplies, transportation, and equipment costs. These reduce
                    your taxable income.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-brand-600">
                    ${tax.yearToDate.deductibleExpenses.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">total deductions</div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {tax.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between rounded bg-gray-50 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-700">{expense.category}</span>
                      <span className="ml-2 text-gray-400">{expense.date}</span>
                    </div>
                    <span className="font-medium text-gray-900">${expense.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAddExpense(!showAddExpense)}
                className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                {showAddExpense ? 'Cancel' : '+ Add Expense'}
              </button>

              {showAddExpense && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3 rounded-lg bg-gray-50 p-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Category</label>
                    <select className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                      <option>Cleaning Supplies</option>
                      <option>Transportation</option>
                      <option>Equipment</option>
                      <option>Insurance</option>
                      <option>Phone / Internet</option>
                      <option>Marketing</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Amount ($)</label>
                    <input
                      type="number"
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button className="w-full rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tax report downloads */}
            <div className="rounded-lg bg-white border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-700">Tax Reports</h4>
              <p className="mt-1 text-xs text-gray-500">
                Download ready-made reports for your accountant or for self-filing.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Q1 2026 Summary
                </button>
                <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Full Year 2025
                </button>
                <button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Export to CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Reviews Tab ─── */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Reviews from verified customers who completed a booking with you. You can reply to any
              review — this builds trust and keeps customers coming back through the platform.
            </p>
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{review.customer}</span>
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

                {review.replied && review.reply && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Your reply:</p>
                    <p className="mt-1 text-sm text-gray-600">{review.reply}</p>
                  </div>
                )}

                {!review.replied && (
                  <div className="mt-3">
                    <textarea
                      rows={2}
                      placeholder="Write a professional reply..."
                      value={replyText[review.id] || ''}
                      onChange={(e) => setReplyText({ ...replyText, [review.id]: e.target.value })}
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

        {/* ─── Profile Tab ─── */}
        {activeTab === 'profile' && (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <input
                type="text"
                defaultValue="Maria Santos"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                rows={3}
                defaultValue="Professional cleaner with 8 years of experience..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Hourly Rate ($)</label>
                <input
                  type="number"
                  defaultValue={35}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Same-Day Rate ($)</label>
                <input
                  type="number"
                  defaultValue={50}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
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
