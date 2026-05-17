'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import AddToCalendar from '@/components/AddToCalendar';
import AvailableNowBadge from '@/components/AvailableNowBadge';
import BackupCleanerSlider from '@/components/BackupCleanerSlider';
import CleaningEstimator from '@/components/CleaningEstimator';
import StarRating from '@/components/StarRating';
import VerificationBadge from '@/components/VerificationBadge';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { useCleanersApi } from '@/lib/hooks/useCleanersApi';
import { getPriceBreakdown, getListedRate, SERVICE_FEE_PERCENT } from '@/lib/pricing';
import type { ServiceCategory } from '@/lib/types';

const SERVICE_TYPES = [
  {
    value: 'regular',
    label: 'Regular Cleaning',
    multiplier: 1,
    description: 'Routine upkeep — dusting, hoovering, mopping, and surface cleaning.',
  },
  {
    value: 'same-day',
    label: 'Same Day Cleaning',
    multiplier: 1.3,
    description: 'Need it today? Book before 12 pm for same-day service.',
  },
  {
    value: 'deep',
    label: 'Deep Cleaning',
    multiplier: 1.45,
    description: 'A thorough top-to-bottom clean including behind appliances and inside cupboards.',
  },
  {
    value: 'end-of-tenancy',
    label: 'End of Tenancy Cleaning',
    multiplier: 1.45, // Fixed-price service — uses deep rate for cleaner payout
    description: 'Professional move-out clean to get your deposit back or prepare for new tenants.',
  },
  {
    value: 'airbnb',
    label: 'Airbnb Cleaning',
    multiplier: 1.45, // Fixed-price service — uses deep rate for cleaner payout
    description:
      'Quick turnaround cleans between guests — fresh linen, restocked supplies, spotless spaces.',
  },
];

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpress = searchParams.get('express') === 'true';
  const { cleaners: allCleaners, getCleanerById } = useCleanersApi();
  const cleaner = getCleanerById(params.id);

  // Fetch saved addresses and past bookings from API
  const [savedAddresses, setSavedAddresses] = useState<
    Array<{ id: string; label?: string; address: string; isDefault: boolean }>
  >([]);
  const [pastBookings, setPastBookings] = useState<
    Array<{
      id: string;
      date: string;
      address: string;
      serviceType: string;
      cleanerName: string;
      duration: number;
      totalPrice: number;
    }>
  >([]);

  useEffect(() => {
    fetch('/api/addresses')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<Record<string, unknown>>) => {
        setSavedAddresses(
          data.map((a) => ({
            id: a.id as string,
            label: a.label as string | undefined,
            address: `${a.line1}${a.line2 ? `, ${a.line2}` : ''}, ${a.city}, ${a.postcode}`,
            isDefault: (a.isDefault as boolean) || false,
          }))
        );
      })
      .catch(() => {});

    fetch('/api/bookings?status=COMPLETED')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((result: { data: Array<Record<string, unknown>> }) => {
        setPastBookings(
          (result.data || []).slice(0, 5).map((b) => ({
            id: b.id as string,
            date: new Date(b.date as string).toLocaleDateString(),
            address: ((b.address as Record<string, unknown>)?.line1 as string) || '',
            serviceType: b.serviceType as string,
            cleanerName: ((b.cleaner as Record<string, unknown>)?.name as string) || '',
            duration: Number(b.duration) || 2,
            totalPrice: Number(b.totalPrice) || 0,
          }))
        );
      })
      .catch(() => {});
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    selectedSavedAddress: '',
    date: isExpress ? today : '',
    time: '',
    duration: 2,
    serviceType: isExpress ? 'regular' : 'regular',
    notes: '',
  });
  const [step, setStep] = useState<'service' | 'details'>(isExpress ? 'details' : 'service');
  const [submitted, setSubmitted] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentStep, setPaymentStep] = useState(false);
  const [bookingData, setBookingData] = useState<{
    id: string;
    payment: { sessionId: string; clientSecret: string } | null;
  } | null>(null);
  const [showRebook, setShowRebook] = useState(false);
  const [bookingMode, setBookingMode] = useState<'guest' | 'account' | null>(null);
  const [abandonmentCaptured, setAbandonmentCaptured] = useState(false);
  const [backupCleanerIds, setBackupCleanerIds] = useState<string[]>([]);
  const [autoAssignBackup, setAutoAssignBackup] = useState(false);
  const { trackStep, trackConversion } = useAnalytics('booking');

  // Track initial page view and service selection step
  useEffect(() => {
    trackStep(
      step === 'service' ? 1 : 2,
      step === 'service' ? 'service_selected' : 'booking_details',
      { cleanerId: params.id }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cleaner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <h1 className="font-cormorant text-2xl font-light text-ink">Cleaner not found</h1>
      </div>
    );
  }

  const isLastMinute = isExpress;
  const rate = isLastMinute ? cleaner.sameDayRate : cleaner.hourlyRate;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const selectedService = SERVICE_TYPES.find((s) => s.value === form.serviceType)!;
  const priceBreakdown = getPriceBreakdown(rate, form.duration, selectedService.multiplier);

  // Other cleaners available on the selected date (exclude the currently selected cleaner)
  const getDayAbbreviation = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(`${dateStr}T00:00:00`);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  };
  const selectedDay = getDayAbbreviation(form.date);
  const availableBackupCleaners = allCleaners.filter(
    (c) => c.id !== cleaner.id && (!selectedDay || c.availability.includes(selectedDay))
  );

  const handleBackupToggle = (cleanerId: string) => {
    setBackupCleanerIds((prev) =>
      prev.includes(cleanerId)
        ? prev.filter((id) => id !== cleanerId)
        : prev.length < 3
          ? [...prev, cleanerId]
          : prev
    );
  };

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
        'Regular Cleaning': 'regular',
        'Same Day Cleaning': 'same-day',
        'Deep Cleaning': 'deep',
        'End of Tenancy Cleaning': 'end-of-tenancy',
        'Airbnb Cleaning': 'airbnb',
      };
      setForm({
        ...form,
        address: booking.address,
        duration: booking.duration,
        serviceType: serviceMap[booking.serviceType] || 'regular',
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
      trackStep(8, 'contact_info', { field: 'email' });
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
    setPaymentPending(true);
    trackStep(9, 'payment_started', { serviceType: form.serviceType });

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: cleaner.id,
          ...form,
          totalPrice: priceBreakdown.total,
          isLastMinute,
          isGuest: bookingMode === 'guest',
          backupCleanerIds: backupCleanerIds.length > 0 ? backupCleanerIds : undefined,
          autoAssignBackup,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBookingData(data.booking ? { id: data.booking.id, payment: data.payment } : null);

        trackConversion({
          cleanerId: cleaner.id,
          serviceType: form.serviceType,
          totalPrice: priceBreakdown.total,
        });

        // If we have a real Ryft payment session, show the payment step
        if (data.payment?.clientSecret && !data.payment.clientSecret.startsWith('cs_mock_')) {
          setPaymentStep(true);
        } else {
          // Mock/dev mode — skip payment, go straight to confirmation
          setSubmitted(true);
        }
      }
    } catch {
      // Handle error
    } finally {
      setPaymentPending(false);
    }
  };

  // ─── Ryft Payment Step ─────────────────────────────────────
  if (paymentStep && bookingData?.payment) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-cream">
        <h1 className="font-cormorant text-3xl font-light text-ink text-center">
          Complete Payment
        </h1>
        <p className="mt-2 font-jost text-sm font-light text-ink-2 text-center">
          Secure payment powered by Ryft. Your funds are held in escrow until the job is complete.
        </p>

        {/* Booking summary */}
        <div className="mt-6 bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <div className="grid gap-2 font-jost text-sm font-light">
            <div className="flex justify-between">
              <span className="text-ink-3">Cleaner</span>
              <span className="font-normal text-ink">{cleaner.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Service</span>
              <span className="font-normal text-ink">{selectedService.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Date &amp; Time</span>
              <span className="font-normal text-ink">
                {form.date} at {form.time}
              </span>
            </div>
            <div
              className="flex justify-between pt-2 mt-2"
              style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
            >
              <span className="font-normal text-ink">Total</span>
              <span className="font-cormorant text-2xl font-light text-gold">
                &pound;{priceBreakdown.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Ryft Drop-in container */}
        <div className="mt-6">
          <div
            id="ryft-dropin"
            className="min-h-[200px] bg-white p-6"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            ref={(el) => {
              if (!el || el.dataset.mounted === 'true') return;
              el.dataset.mounted = 'true';

              const publicKey = process.env.NEXT_PUBLIC_RYFT_PUBLIC_KEY;
              if (!publicKey) {
                el.innerHTML =
                  '<p class="text-center text-ink-3 font-jost text-sm">Payment provider not configured</p>';
                return;
              }

              const script = document.createElement('script');
              script.src = 'https://embedded.ryftpay.com/v1/dropin.js';
              script.onload = () => {
                const Ryft = window.Ryft;
                if (!Ryft) return;

                Ryft.init({
                  publicApiKey: publicKey,
                  environment: publicKey.startsWith('pk_sandbox') ? 'sandbox' : 'production',
                });

                if (!bookingData.payment?.clientSecret) return;

                Ryft.renderDropIn(el, {
                  clientSecret: bookingData.payment.clientSecret,
                  appearance: {
                    theme: 'minimal',
                    variables: {
                      fontFamily: 'Jost, sans-serif',
                      colorPrimary: '#0e0e0c',
                      borderRadius: '0px',
                    },
                  },
                  onPaymentResult: (result: { status: string }) => {
                    if (result.status === 'Captured' || result.status === 'Approved') {
                      setPaymentStep(false);
                      setSubmitted(true);
                    }
                  },
                  onPaymentError: (error: { message: string }) => {
                    // eslint-disable-next-line no-console
                    console.error('[Ryft] Payment error:', error.message);
                  },
                });
              };
              document.head.appendChild(script);
            }}
          />
        </div>

        {/* Security notice */}
        <div className="mt-4 flex items-start gap-2.5">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="#b8975a" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clipRule="evenodd"
            />
          </svg>
          <p className="font-jost text-xs font-light text-ink-2">
            Your payment is encrypted and processed securely by Ryft, an FCA-regulated payment
            provider. Funds are held in escrow and only released when the job is confirmed complete.
          </p>
        </div>

        <button
          onClick={() => {
            setPaymentStep(false);
            setPaymentPending(false);
          }}
          className="mt-6 w-full py-2 font-jost text-sm font-light text-ink-3 hover:text-ink transition"
        >
          &larr; Back to booking details
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-cream">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-cream-2 text-3xl text-gold">
          &#10003;
        </div>
        <h1 className="mt-6 font-cormorant text-3xl font-light text-ink">
          {isLastMinute ? 'Express Booking Sent!' : 'Booking Confirmed!'}
        </h1>
        <p className="mt-4 font-jost font-light text-ink-2">
          {isLastMinute ? (
            <>
              Your last-minute booking request has been sent to {cleaner.name}. They typically
              respond within{' '}
              <strong className="font-normal text-ink">{cleaner.responseTime}</strong>. You&apos;ll
              receive a confirmation at {form.email}.
            </>
          ) : (
            <>
              Your booking with {cleaner.name} has been submitted. You&apos;ll receive a
              confirmation email shortly at {form.email}.
            </>
          )}
        </p>
        <div
          className="mt-6 bg-cream-2 p-6 text-left"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <div className="grid gap-2 font-jost text-sm font-light">
            <div className="flex justify-between">
              <span className="text-ink-3">Cleaner</span>
              <span className="font-normal text-ink">{cleaner.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Service</span>
              <span className="font-normal text-ink">{selectedService.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Date</span>
              <span className="font-normal text-ink">{form.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Time</span>
              <span className="font-normal text-ink">{form.time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Duration</span>
              <span className="font-normal text-ink">{form.duration} hours</span>
            </div>
            <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}>
              <div className="flex justify-between">
                <span className="font-normal text-ink">Total</span>
                <span className="font-cormorant text-lg font-light text-gold">
                  &pound;{priceBreakdown.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <AddToCalendar
          title={`${selectedService.label} - ${cleaner.name}`}
          description={`Cleaning with ${cleaner.name} via Rena. Booking ref: ${bookingData?.id || 'TBC'}`}
          location={form.address}
          date={form.date}
          time={form.time}
          durationHours={form.duration}
        />

        <button
          onClick={() => router.push('/cleaners')}
          className="mt-8 bg-ink px-6 py-3 font-jost font-normal text-cream hover:bg-ink/90"
        >
          Browse More Cleaners
        </button>
      </div>
    );
  }

  if (step === 'service') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 bg-cream">
        {/* Cleaner summary at top */}
        <div
          className="flex items-center gap-4 bg-cream-2 p-4"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <div className="flex h-14 w-14 items-center justify-center bg-ink font-cormorant text-xl font-light text-cream">
            {cleaner.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="font-jost font-normal text-ink">{cleaner.name}</h2>
            <div className="flex items-center gap-2 font-jost text-sm font-light text-ink-3">
              <StarRating rating={cleaner.rating} />
              <span>
                {cleaner.rating} ({cleaner.reviewCount} reviews)
              </span>
              <span>&middot; &pound;{getListedRate(cleaner.hourlyRate)}/hr</span>
            </div>
          </div>
        </div>

        <h1 className="mt-8 font-cormorant text-3xl font-light text-ink">
          What kind of cleaning do you need?
        </h1>
        <p className="mt-2 font-jost text-sm font-light text-ink-2">
          Choose a service to continue booking with {cleaner.name}.
        </p>

        <div className="mt-6 grid gap-3">
          {SERVICE_TYPES.filter((s) => {
            // Same-day is available if the cleaner is available now
            if (s.value === 'same-day') return cleaner.availableNow;
            // Match service label to cleaner specialties
            return cleaner.specialties.some(
              (sp) =>
                s.label.toLowerCase().includes(sp.toLowerCase()) ||
                sp.toLowerCase().includes(s.label.toLowerCase())
            );
          }).map((s) => {
            const isSameDayPastDeadline = s.value === 'same-day' && new Date().getHours() >= 12;
            return (
              <button
                key={s.value}
                disabled={isSameDayPastDeadline}
                onClick={() => {
                  if (!isSameDayPastDeadline) {
                    router.push(`/services/${s.value}?cleaner=${params.id}`);
                  }
                }}
                className={`group/card flex items-center justify-between p-5 text-left transition ${
                  isSameDayPastDeadline ? 'cursor-not-allowed opacity-45' : 'hover:bg-cream-2'
                }`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-jost text-[15px] font-medium text-ink">{s.label}</h3>
                  <p className="mt-1 font-jost text-[13px] font-light text-ink-2">
                    {s.description}
                  </p>
                  {isSameDayPastDeadline && (
                    <p className="mt-1 font-jost text-[12px] font-medium text-red-400">
                      Same-day booking is closed for today
                    </p>
                  )}
                </div>
                <svg
                  className={`ml-3 h-5 w-5 shrink-0 transition ${
                    isSameDayPastDeadline
                      ? 'text-ink-3'
                      : 'text-ink-3 group-hover/card:translate-x-0.5 group-hover/card:text-ink'
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:max-w-6xl lg:px-8 bg-cream">
      {!isExpress && (
        <button
          onClick={() => setStep('service')}
          className="flex items-center gap-1.5 font-jost text-[13px] font-light text-ink-3 hover:text-ink transition"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Change service type
        </button>
      )}
      <h1 className="mt-2 font-cormorant text-3xl font-light text-ink">
        {isExpress ? 'Express Booking' : 'Book a Cleaning'}
      </h1>

      {/* Express banner */}
      {isExpress && cleaner.availableNow && (
        <div className="mt-4 bg-cream-2 p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          <div className="flex items-center gap-3">
            <AvailableNowBadge responseTime={cleaner.responseTime} />
            <span className="font-jost text-sm font-light text-ink-2">
              Same-day rate:{' '}
              <strong className="font-normal text-ink">${cleaner.sameDayRate}/hr</strong>
            </span>
          </div>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            {cleaner.name} is available now and typically responds within {cleaner.responseTime}.
            Your booking will be prioritized.
          </p>
        </div>
      )}

      {/* Cleaner summary */}
      <div
        className="mt-6 flex items-center gap-4 bg-cream-2 p-4"
        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
      >
        <div className="flex h-14 w-14 items-center justify-center bg-ink font-cormorant text-xl font-light text-cream">
          {cleaner.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="font-jost font-normal text-ink">{cleaner.name}</h2>
          <div className="flex items-center gap-2 font-jost text-sm font-light text-ink-3">
            <StarRating rating={cleaner.rating} />
            <span>
              {cleaner.rating} ({cleaner.reviewCount} reviews)
            </span>
            <span>&middot; &pound;{getListedRate(cleaner.hourlyRate)}/hr</span>
            {isLastMinute && (
              <span className="text-gold font-normal">
                &middot; &pound;{getListedRate(cleaner.sameDayRate)}/hr today
              </span>
            )}
          </div>
        </div>
        <div className="text-right font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
          Trusted &amp; verified
        </div>
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
            className="font-jost text-sm font-normal text-gold hover:text-gold/80"
          >
            {showRebook ? 'Hide past bookings' : 'Quick rebook from a past booking'}
          </button>
          {showRebook && (
            <div className="mt-3 space-y-2">
              {pastBookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => handleRebook(booking.id)}
                  className="w-full text-left p-3 hover:bg-cream-2 transition"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <div className="flex justify-between">
                    <span className="font-jost text-sm font-normal text-ink">
                      {booking.serviceType} with {booking.cleanerName}
                    </span>
                    <span className="font-jost text-sm font-light text-ink-3">{booking.date}</span>
                  </div>
                  <div className="mt-1 font-jost text-xs font-light text-ink-3">
                    {booking.address} &middot; {booking.duration}h &middot; ${booking.totalPrice}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[1fr,380px] lg:gap-10 lg:items-start">
        {/* Left column — form */}
        <div>
          {/* Guest / Account selection */}
          {bookingMode === null && (
            <div className="mt-8 p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <h3 className="font-cormorant text-lg font-light text-ink mb-4">
                How would you like to book?
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setBookingMode('guest')}
                  className="p-4 text-left hover:bg-cream-2 transition"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <p className="font-jost font-normal text-ink">Continue as Guest</p>
                  <p className="font-jost text-sm font-light text-ink-3 mt-1">
                    No account needed. We&apos;ll email you a link to manage your booking.
                  </p>
                </button>
                <button
                  onClick={() => setBookingMode('account')}
                  className="bg-cream-2 p-4 text-left hover:bg-cream-2/80 transition"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  <p className="font-jost font-normal text-ink">Sign in / Create Account</p>
                  <p className="font-jost text-sm font-light text-ink-3 mt-1">
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
              <h3 className="font-cormorant text-lg font-light text-ink">
                Your Information
                {bookingMode === 'guest' && (
                  <span className="ml-2 font-jost text-sm font-light text-ink-3">
                    (Guest checkout)
                  </span>
                )}
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    onBlur={handleEmailBlur}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Phone
                  </label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Address
                  </label>
                  {savedAddresses.length > 0 && (
                    <div className="mt-1 mb-2 flex flex-wrap gap-2">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => handleSavedAddress(addr.id)}
                          className={`px-3 py-1 font-jost text-xs font-light transition ${
                            form.selectedSavedAddress === addr.id
                              ? 'bg-ink text-cream'
                              : 'bg-cream-2 text-ink-2 hover:bg-cream-2/80'
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
                    className="w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
              </div>
            </div>

            {/* Service details */}
            <div>
              <h3 className="font-cormorant text-lg font-light text-ink">Service Details</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Service Type
                  </label>
                  <select
                    value={form.serviceType}
                    onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Duration (hours)
                  </label>
                  <select
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((h) => (
                      <option key={h} value={h}>
                        {h} hour{h !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Preferred Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Special Notes / Instructions
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any special requests, access instructions, or areas to focus on..."
                className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
            </div>

            {/* Backup cleaner slider */}
            <div className="p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <BackupCleanerSlider
                cleaners={availableBackupCleaners}
                selectedIds={backupCleanerIds}
                onToggle={handleBackupToggle}
                maxSelections={3}
                autoAssign={autoAssignBackup}
                onAutoAssignChange={setAutoAssignBackup}
                serviceCategory={form.serviceType as ServiceCategory}
              />
            </div>

            {/* Verification badge */}
            <div
              className="flex items-center justify-between bg-cream-2 px-4 py-3"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <div className="flex items-center gap-2">
                <VerificationBadge
                  identityVerified={cleaner.identityVerified}
                  backgroundChecked={cleaner.backgroundChecked}
                  size="md"
                />
              </div>
              {cleaner.identityVerified && (
                <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Arrival photo will confirm identity
                </span>
              )}
            </div>

            {/* Mobile-only booking summary (hidden on lg+) */}
            <div className="lg:hidden">
              <div className="bg-cream-2 p-4" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                <h4 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
                  Booking Summary
                </h4>
                <div className="space-y-2 font-jost text-sm font-light">
                  <div className="flex justify-between">
                    <span className="text-ink-3">
                      Cleaning ({form.duration}h
                      {selectedService.multiplier !== 1 && (
                        <>
                          {' '}
                          &times; {selectedService.multiplier}x {selectedService.label}
                        </>
                      )}
                      )
                    </span>
                    <span className="font-normal text-ink">
                      &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {isLastMinute && (
                    <div className="font-jost text-xs font-light text-gold">
                      Same-day rate applied
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-ink-3">Service fee ({SERVICE_FEE_PERCENT}%)</span>
                    <span className="font-normal text-ink">
                      &pound;{priceBreakdown.serviceFee.toFixed(2)}
                    </span>
                  </div>
                  <div
                    className="flex justify-between pt-2"
                    style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                  >
                    <span className="font-normal text-ink">Total</span>
                    <span className="font-cormorant text-2xl font-light text-gold">
                      &pound;{priceBreakdown.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Exact price shown. No hidden charges, ever.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={paymentPending}
              className={`w-full py-3 font-jost text-lg font-normal text-cream disabled:opacity-60 ${
                isLastMinute ? 'bg-gold hover:bg-gold/90' : 'bg-ink hover:bg-ink/90'
              } lg:hidden`}
            >
              {paymentPending
                ? 'Processing...'
                : isLastMinute
                  ? 'Send Express Booking'
                  : 'Confirm & Pay'}
            </button>
          </form>
        </div>
        {/* End left column */}

        {/* Right column — sticky booking summary (desktop only) */}
        <div className="hidden lg:block">
          <div className="sticky top-8 space-y-4">
            <div className="bg-cream-2 p-5" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <h4 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-4">
                Booking Summary
              </h4>

              {/* Cleaner info */}
              <div
                className="flex items-center gap-3 mb-4 pb-4"
                style={{ borderBottom: '0.5px solid rgba(14,14,12,0.06)' }}
              >
                <div className="flex h-10 w-10 items-center justify-center bg-ink font-cormorant text-sm font-light text-cream">
                  {cleaner.name.charAt(0)}
                </div>
                <div>
                  <p className="font-jost text-sm font-normal text-ink">{cleaner.name}</p>
                  <p className="font-jost text-xs font-light text-ink-3">
                    &pound;{getListedRate(cleaner.hourlyRate)}/hr
                  </p>
                </div>
              </div>

              <div className="space-y-2 font-jost text-sm font-light">
                <div className="flex justify-between">
                  <span className="text-ink-3">
                    Cleaning ({form.duration}h
                    {selectedService.multiplier !== 1 && (
                      <>
                        {' '}
                        &times; {selectedService.multiplier}x {selectedService.label}
                      </>
                    )}
                    )
                  </span>
                  <span className="font-normal text-ink">
                    &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
                  </span>
                </div>
                {isLastMinute && (
                  <div className="font-jost text-xs font-light text-gold">
                    Same-day rate applied
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-ink-3">Service fee ({SERVICE_FEE_PERCENT}%)</span>
                  <span className="font-normal text-ink">
                    &pound;{priceBreakdown.serviceFee.toFixed(2)}
                  </span>
                </div>
                <div
                  className="flex justify-between pt-3 mt-2"
                  style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
                >
                  <span className="font-normal text-ink">Total</span>
                  <span className="font-cormorant text-2xl font-light text-gold">
                    &pound;{priceBreakdown.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="mt-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Exact price shown. No hidden charges, ever.
              </p>

              {/* Escrow notice */}
              <div
                className="mt-3 pt-3 flex items-start gap-2.5"
                style={{ borderTop: '0.5px solid rgba(14,14,12,0.06)' }}
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="#b8975a" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="font-jost text-xs font-light text-ink-2 leading-relaxed">
                  <p>
                    Your payment is held in escrow until the job is confirmed complete.
                    {(backupCleanerIds.length > 0 || autoAssignBackup) && (
                      <>
                        {' '}
                        If the cleaner changes, your payment will be updated to reflect the new
                        rate.
                      </>
                    )}
                    {autoAssignBackup && (
                      <> Any cleaner we assign will be the same price or lower.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const formEl = document.querySelector('form');
                if (formEl) formEl.requestSubmit();
              }}
              disabled={paymentPending || bookingMode === null}
              className={`w-full py-3 font-jost text-lg font-normal text-cream disabled:opacity-60 ${
                isLastMinute ? 'bg-gold hover:bg-gold/90' : 'bg-ink hover:bg-ink/90'
              }`}
            >
              {paymentPending
                ? 'Processing...'
                : isLastMinute
                  ? 'Send Express Booking'
                  : 'Confirm & Pay'}
            </button>
          </div>
        </div>
        {/* End right column */}
      </div>
      {/* End two-column grid */}
    </div>
  );
}
