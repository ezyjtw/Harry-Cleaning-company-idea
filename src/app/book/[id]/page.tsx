'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import AvailableNowBadge from '@/components/AvailableNowBadge';
import CleaningEstimator from '@/components/CleaningEstimator';
import StarRating from '@/components/StarRating';
import VerificationBadge from '@/components/VerificationBadge';
import { getCleanerById, savedAddresses, pastBookings } from '@/lib/mock-data';
import { getPriceBreakdown } from '@/lib/pricing';
import { shouldUseEscrow } from '@/lib/trust';

const SERVICE_TYPES = [
  { value: 'standard', label: 'Standard Cleaning', multiplier: 1 },
  { value: 'deep', label: 'Deep Cleaning', multiplier: 1.5 },
  { value: 'move-in-out', label: 'Move In/Out Cleaning', multiplier: 2 },
  { value: 'office', label: 'Office Cleaning', multiplier: 1.3 },
  { value: 'last-minute', label: 'Last-Minute Cleaning', multiplier: 1.0 },
];

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpress = searchParams.get('express') === 'true';
  const cleaner = getCleanerById(params.id);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: savedAddresses.find((a) => a.isDefault)?.address ?? '',
    selectedSavedAddress: savedAddresses.find((a) => a.isDefault)?.id ?? '',
    date: isExpress ? today : '',
    time: '',
    duration: 2,
    serviceType: isExpress ? 'last-minute' : 'standard',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [showRebook, setShowRebook] = useState(false);
  const [bookingMode, setBookingMode] = useState<'guest' | 'account' | null>(null);
  const [abandonmentCaptured, setAbandonmentCaptured] = useState(false);

  if (!cleaner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Cleaner not found</h1>
      </div>
    );
  }

  const isLastMinute = form.serviceType === 'last-minute' || isExpress;
  const rate = isLastMinute ? cleaner.sameDayRate : cleaner.hourlyRate;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const selectedService = SERVICE_TYPES.find((s) => s.value === form.serviceType)!;
  const priceBreakdown = getPriceBreakdown(rate, form.duration, selectedService.multiplier);

  // Check if this is a first-time booking with this cleaner (for escrow)
  const hasBookedBefore = pastBookings.some((b) => b.cleanerId === cleaner.id);
  const useEscrow = shouldUseEscrow(!hasBookedBefore);

  const handleSavedAddress = (addressId: string) => {
    const saved = savedAddresses.find((a) => a.id === addressId);
    if (saved) {
      setForm({ ...form, address: saved.address, selectedSavedAddress: addressId });
    }
  };

  const handleRebook = (bookingId: string) => {
    const booking = pastBookings.find((b) => b.id === bookingId);
    if (booking) {
      const serviceMap: Record<string, string> = {
        'Deep Cleaning': 'deep',
        'Standard Cleaning': 'standard',
        'Move In/Out Cleaning': 'move-in-out',
        'Office Cleaning': 'office',
      };
      setForm({
        ...form,
        address: booking.address,
        duration: booking.duration,
        serviceType: serviceMap[booking.serviceType] || 'standard',
      });
      setShowRebook(false);
    }
  };

  const handleEstimateApply = (duration: number, serviceType: string) => {
    setForm({ ...form, duration, serviceType });
  };

  // Silently capture email for abandonment tracking
  const handleEmailBlur = () => {
    if (form.email && !abandonmentCaptured) {
      setAbandonmentCaptured(true);
      fetch('/api/abandonment/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          cleanerId: cleaner.id,
          postcode: form.address,
          step: 1,
        }),
      }).catch(() => {}); // silent
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cleanerId: cleaner.id,
        ...form,
        totalPrice: priceBreakdown.total,
        isLastMinute,
      }),
    });

    if (response.ok) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          &#10003;
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          {isLastMinute ? 'Express Booking Sent!' : 'Booking Confirmed!'}
        </h1>
        <p className="mt-4 text-gray-600">
          {isLastMinute ? (
            <>
              Your last-minute booking request has been sent to {cleaner.name}. They typically
              respond within <strong>{cleaner.responseTime}</strong>. You&apos;ll receive a
              confirmation at {form.email}.
            </>
          ) : (
            <>
              Your booking with {cleaner.name} has been submitted. You&apos;ll receive a
              confirmation email shortly at {form.email}.
            </>
          )}
        </p>
        <div className="mt-6 rounded-lg bg-gray-50 p-6 text-left">
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Cleaner</span>
              <span className="font-medium">{cleaner.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Service</span>
              <span className="font-medium">{selectedService.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium">{form.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{form.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium">{form.duration} hours</span>
            </div>
            <div className="mt-2 border-t pt-2">
              <div className="flex justify-between">
                <span className="font-medium text-gray-900">Total</span>
                <span className="text-lg font-bold text-brand-600">
                  &pound;{priceBreakdown.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/cleaners')}
          className="mt-8 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Browse More Cleaners
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">
        {isExpress ? 'Express Booking' : 'Book a Cleaning'}
      </h1>

      {/* Express banner */}
      {isExpress && cleaner.availableNow && (
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-3">
            <AvailableNowBadge responseTime={cleaner.responseTime} />
            <span className="text-sm text-green-700">
              Same-day rate: <strong>${cleaner.sameDayRate}/hr</strong>
            </span>
          </div>
          <p className="mt-2 text-sm text-green-600">
            {cleaner.name} is available now and typically responds within {cleaner.responseTime}.
            Your booking will be prioritized.
          </p>
        </div>
      )}

      {/* Cleaner summary */}
      <div className="mt-6 flex items-center gap-4 rounded-lg bg-gray-50 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {cleaner.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">{cleaner.name}</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StarRating rating={cleaner.rating} />
            <span>
              {cleaner.rating} ({cleaner.reviewCount} reviews)
            </span>
            <span>&middot; ${cleaner.hourlyRate}/hr</span>
            {isLastMinute && (
              <span className="text-green-600 font-medium">
                &middot; ${cleaner.sameDayRate}/hr today
              </span>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-400">Trusted &amp; verified</div>
      </div>

      {/* AI Estimator */}
      <div className="mt-6">
        <CleaningEstimator
          cleanerRate={cleaner.hourlyRate}
          sameDayRate={cleaner.sameDayRate}
          isLastMinute={isLastMinute}
          onEstimateApply={handleEstimateApply}
        />
      </div>

      {/* Quick rebook */}
      {pastBookings.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowRebook(!showRebook)}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            {showRebook ? 'Hide past bookings' : 'Quick rebook from a past booking'}
          </button>
          {showRebook && (
            <div className="mt-3 space-y-2">
              {pastBookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => handleRebook(booking.id)}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:border-brand-300 hover:bg-brand-50 transition"
                >
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {booking.serviceType} with {booking.cleanerName}
                    </span>
                    <span className="text-sm text-gray-500">{booking.date}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {booking.address} &middot; {booking.duration}h &middot; ${booking.totalPrice}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guest / Account selection */}
      {bookingMode === null && (
        <div className="mt-8 rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How would you like to book?</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => setBookingMode('guest')}
              className="rounded-lg border-2 border-gray-200 p-4 text-left hover:border-brand-400 hover:bg-brand-50 transition"
            >
              <p className="font-semibold text-gray-900">Continue as Guest</p>
              <p className="text-sm text-gray-500 mt-1">
                No account needed. We&apos;ll email you a link to manage your booking.
              </p>
            </button>
            <button
              onClick={() => setBookingMode('account')}
              className="rounded-lg border-2 border-brand-200 bg-brand-50 p-4 text-left hover:border-brand-400 transition"
            >
              <p className="font-semibold text-brand-700">Sign in / Create Account</p>
              <p className="text-sm text-gray-500 mt-1">
                Save your details, rebook easily, and track all your bookings.
              </p>
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={`mt-8 space-y-6 ${bookingMode === null ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Contact info */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Your Information
            {bookingMode === 'guest' && (
              <span className="ml-2 text-sm font-normal text-gray-500">(Guest checkout)</span>
            )}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={handleEmailBlur}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              {savedAddresses.length > 0 && (
                <div className="mt-1 mb-2 flex flex-wrap gap-2">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => handleSavedAddress(addr.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        form.selectedSavedAddress === addr.id
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {addr.label}
                    </button>
                  ))}
                </div>
              )}
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value, selectedSavedAddress: '' })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        </div>

        {/* Service details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Service Details</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Service Type</label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {SERVICE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Duration (hours)</label>
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Preferred Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Preferred Time</label>
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Special Notes / Instructions
          </label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Any special requests, access instructions, or areas to focus on..."
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        {/* Price summary */}
        <div className="rounded-lg bg-gray-50 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Price Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">
                &pound;{rate}/hr &times; {form.duration}h
                {selectedService.multiplier !== 1 && (
                  <>
                    {' '}
                    &times; {selectedService.multiplier}x ({selectedService.label})
                  </>
                )}
              </span>
              <span className="font-medium text-gray-700">
                &pound;{priceBreakdown.total.toFixed(2)}
              </span>
            </div>
            {isLastMinute && <div className="text-xs text-green-600">Same-day rate applied</div>}
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-brand-600">
                &pound;{priceBreakdown.total.toFixed(2)}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">Exact price shown. No hidden charges, ever.</p>
        </div>

        {/* Escrow info for first-time bookings */}
        {useEscrow && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-amber-800">
                  Escrow Protection — First Booking
                </h4>
                <p className="mt-1 text-xs text-amber-700">
                  Since this is your first time booking with {cleaner.name}, your payment will be
                  held in secure escrow. It&apos;s only released after you confirm the job is
                  complete (or automatically after 24 hours). This protects you from scams and
                  protects the cleaner from non-payment.
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs text-amber-600">
                  <span>&#10003; Payment held safely</span>
                  <span>&#10003; You confirm before release</span>
                  <span>&#10003; Dispute option available</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verification badge */}
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <VerificationBadge
              identityVerified={cleaner.identityVerified}
              backgroundChecked={cleaner.backgroundChecked}
              size="md"
            />
          </div>
          {cleaner.identityVerified && (
            <span className="text-xs text-gray-500">Arrival photo will confirm identity</span>
          )}
        </div>

        <button
          type="submit"
          className={`w-full rounded-lg py-3 text-lg font-semibold text-white ${
            isLastMinute ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {isLastMinute ? 'Send Express Booking' : 'Confirm Booking'}
        </button>
      </form>
    </div>
  );
}
