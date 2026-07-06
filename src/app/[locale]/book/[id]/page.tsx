'use client';

import { Elements } from '@stripe/react-stripe-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';

import AddToCalendar from '@/components/AddToCalendar';
import AvailableNowBadge from '@/components/AvailableNowBadge';
import BackupCleanerSlider from '@/components/BackupCleanerSlider';
import AddressAutocomplete from '@/components/booking/AddressAutocomplete';
import DateTimePicker from '@/components/booking/DateTimePicker';
import type { DateTimeSelection } from '@/components/booking/DateTimePicker';
import StripeCheckoutForm from '@/components/booking/StripeCheckoutForm';
import CleanerAvatar from '@/components/CleanerAvatar';
import CleanerIdentity from '@/components/CleanerIdentity';
import CleaningEstimator from '@/components/CleaningEstimator';
import VerificationBadge from '@/components/VerificationBadge';
import {
  bedroomIndexToPropertySize,
  BEDROOMS_TO_EOT_SIZE,
  BEDROOMS_TO_AIRBNB_SIZE,
  eotSizeLabel,
  airbnbSizeLabel,
} from '@/lib/constants/services';
import { useAnalytics } from '@/lib/hooks/useAnalytics';
import { useCleanersApi } from '@/lib/hooks/useCleanersApi';
import { SERVICE_FEE_PERCENT } from '@/lib/pricing';
import stripePromise, { stripeAppearance } from '@/lib/stripe-client';
import type { ServiceCategory } from '@/lib/types';
import { formatDate } from '@/lib/utils/formatting';

const URL_SLUG_TO_DB_SLUG: Record<string, string> = {
  regular: 'regular',
  'same-day': 'same_day',
  deep: 'deep',
  'end-of-tenancy': 'end_of_tenancy',
  airbnb: 'airbnb',
};

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

const isFixedPriceService = (svc: string) => svc === 'end-of-tenancy' || svc === 'airbnb';

// The homepage services-section (S3) photography, reused verbatim per service
// so the booking ledger reads the same as the marketing site.
const SERVICE_IMAGES: Record<string, string> = {
  regular: '/images/Regular cleaning.webp',
  'same-day': '/images/Same day cleaning.webp',
  deep: '/images/Deep cleaning.webp',
  'end-of-tenancy': '/images/End of Tenancy.webp',
  airbnb: '/images/Air BnB cleaning.webp',
};

// Lowest set price in a fixed-price map (EoT / Airbnb), for the "from £X" row —
// same derivation as CleanerProfileModal.
function minPrice(map?: Record<string, number>): number | null {
  if (!map) return null;
  const vals = Object.values(map).filter((n) => typeof n === 'number' && n > 0);
  return vals.length ? Math.min(...vals) : null;
}

const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  { value: 1, label: '1 Bedroom' },
  { value: 2, label: '2 Bedrooms' },
  { value: 3, label: '3 Bedrooms' },
  { value: 4, label: '4 Bedrooms' },
  { value: 5, label: '5+ Bedrooms' },
];

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpress = searchParams.get('express') === 'true';
  // Carry the up-front postcode (cleaner card / profile pass ?postcode=) into the
  // address step so it auto-looks-up on mount instead of a manual "Find address".
  // Captured once; empty when absent (direct nav) → the manual path is preserved.
  const seededPostcode = (searchParams.get('postcode') ?? '').trim().toUpperCase();
  const { cleaners: allCleaners, getCleanerById } = useCleanersApi();
  const cleaner = getCleanerById(params.id);

  // Fetch saved addresses and past bookings from API
  const [savedAddresses, setSavedAddresses] = useState<
    Array<{
      id: string;
      label?: string;
      address: string;
      line1: string;
      line2: string;
      city: string;
      postcode: string;
      isDefault: boolean;
    }>
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
            line1: (a.line1 as string) || '',
            line2: (a.line2 as string) || '',
            city: (a.city as string) || '',
            postcode: (a.postcode as string) || '',
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
            date: formatDate(b.date as string, 'full'),
            address:
              (b.addressLine1 as string) ||
              ((b.address as Record<string, unknown>)?.line1 as string) ||
              '',
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
    // A12: structured address (replaces the old single free-text `address`).
    addressLine1: '',
    addressLine2: '',
    addressCity: '',
    addressPostcode: seededPostcode,
    addressId: '', // set when a saved address is selected (else copied from columns)
    date: isExpress ? today : '',
    time: '',
    duration: 2,
    serviceType: isExpress ? 'regular' : 'regular',
    notes: '',
    bedrooms: 2,
  });
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [step, setStep] = useState<'service' | 'details'>(isExpress ? 'details' : 'service');
  const [submitted] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  // A16b-1: synchronous double-submit guard — fires before React re-renders the
  // disabled button. The idempotency key that dedups the booking + PaymentIntent
  // is derived SERVER-SIDE from the validated request, so the client sends none.
  const submittingRef = useRef(false);
  const [paymentStep, setPaymentStep] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(true);
  const [bookingData, setBookingData] = useState<{
    id: string;
    guestToken: string | null;
  } | null>(null);
  const [showRebook, setShowRebook] = useState(false);
  const [bookingMode, setBookingMode] = useState<'guest' | 'account' | null>(null);
  const [abandonmentCaptured, setAbandonmentCaptured] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [backupCleanerIds, setBackupCleanerIds] = useState<string[]>([]);
  const [autoAssignBackup, setAutoAssignBackup] = useState(false);
  const [serverQuote, setServerQuote] = useState<{
    cleanerListedPrice: number;
    customerPlatformFee: number;
    customerTotal: number;
  } | null>(null);
  const { trackStep, trackConversion } = useAnalytics('booking');

  const handleSaveCardToggle = useCallback((checked: boolean) => {
    setSaveCard(checked);
  }, []);

  // Track initial page view and service selection step
  useEffect(() => {
    trackStep(
      step === 'service' ? 1 : 2,
      step === 'service' ? 'service_selected' : 'booking_details',
      { cleanerId: params.id }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the submit-time error banner when the user moves between steps, so a
  // stale error from a previous attempt doesn't linger after they navigate.
  useEffect(() => {
    setBookingError(null);
  }, [step, paymentStep]);

  // Fetch server-side quote when service/duration/cleaner/bedrooms changes
  useEffect(() => {
    if (!params.id) return;
    const serviceSlugMap: Record<string, string> = {
      regular: 'regular',
      'same-day': 'same-day',
      deep: 'deep',
      'end-of-tenancy': 'eot',
      airbnb: 'airbnb',
    };
    const serviceSlug = serviceSlugMap[form.serviceType] || 'regular';
    const propertySize = isFixedPriceService(form.serviceType)
      ? bedroomIndexToPropertySize(form.bedrooms, form.serviceType)
      : undefined;
    const controller = new AbortController();
    fetch('/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cleanerId: params.id,
        serviceSlug,
        hours: form.duration,
        propertySize: propertySize || undefined,
      }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setServerQuote({
            cleanerListedPrice: data.cleanerListedPrice,
            customerPlatformFee: data.customerPlatformFee,
            customerTotal: data.customerTotal,
          });
        } else {
          setServerQuote(null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [params.id, form.serviceType, form.duration, form.bedrooms]);

  if (!cleaner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-page">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">Cleaner not found</h1>
      </div>
    );
  }

  const isLastMinute = isExpress;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const selectedService = SERVICE_TYPES.find((s) => s.value === form.serviceType)!;
  const priceBreakdown = serverQuote
    ? {
        listedSubtotal: serverQuote.cleanerListedPrice,
        serviceFee: serverQuote.customerPlatformFee,
        total: serverQuote.customerTotal,
      }
    : { listedSubtotal: 0, serviceFee: 0, total: 0 };

  // Booking Summary cleaner-rate line. Fixed-price services (EoT / Airbnb) don't
  // have an hourly rate — read the cleaner's per-size fixed price instead of
  // showing £0/hr. Hourly services show the service-correct £X/hr.
  const cleanerRateLabel = (() => {
    if (form.serviceType === 'end-of-tenancy') {
      const slug = BEDROOMS_TO_EOT_SIZE[form.bedrooms];
      if (!slug) return null;
      const price = cleaner.eotPrices?.[slug];
      return typeof price === 'number' ? `£${price.toFixed(2)} (${eotSizeLabel(slug)})` : null;
    }
    if (form.serviceType === 'airbnb') {
      const slug = BEDROOMS_TO_AIRBNB_SIZE[form.bedrooms];
      if (!slug) return null;
      const price = cleaner.airbnbPrices?.[slug];
      return typeof price === 'number' ? `£${price.toFixed(2)} (${airbnbSizeLabel(slug)})` : null;
    }
    const hourly =
      form.serviceType === 'deep'
        ? cleaner.hourlyRateDeep
        : form.serviceType === 'same-day'
          ? cleaner.hourlyRateSameDay
          : cleaner.hourlyRateRegular;
    return typeof hourly === 'number' ? `£${hourly.toFixed(2)}/hr` : null;
  })();

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
      setForm({
        ...form,
        addressLine1: saved.line1,
        addressLine2: saved.line2,
        addressCity: saved.city,
        addressPostcode: saved.postcode,
        addressId,
      });
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
        // pastBookings only carries line1; the user confirms the rest in the address field.
        addressLine1: booking.address,
        addressId: '',
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
  // A basic but effective email-format check — the confirmation + reminders all
  // depend on this address being real, so we validate client-side (inline) and
  // the API validates again server-side.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateEmail = (): boolean => {
    const ok = EMAIL_RE.test(form.email.trim());
    setEmailError(form.email.trim() && !ok ? 'Please enter a valid email address.' : null);
    return ok;
  };

  const handleEmailBlur = () => {
    validateEmail();
    if (form.email && !abandonmentCaptured) {
      setAbandonmentCaptured(true);
      trackStep(8, 'contact_info', { field: 'email' });
      fetch('/api/abandonment/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          cleanerId: cleaner.id,
          postcode: form.addressPostcode,
          step: 1,
        }),
      }).catch(() => {}); // silent
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A16b-1: block a rapid second submit synchronously (button-disable is async).
    if (submittingRef.current) return;

    // Guest checkout depends on a real email for confirmation + reminders.
    if (bookingMode === 'guest' && !validateEmail()) {
      return;
    }

    submittingRef.current = true;
    setPaymentPending(true);
    setBookingError(null);
    trackStep(9, 'payment_started', { serviceType: form.serviceType });

    const propertySize = isFixedPriceService(form.serviceType)
      ? bedroomIndexToPropertySize(form.bedrooms, form.serviceType)
      : undefined;

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: cleaner.id,
          ...form,
          propertySize,
          totalPrice: priceBreakdown.total,
          isLastMinute,
          isGuest: bookingMode === 'guest',
          backupCleanerIds: backupCleanerIds.length > 0 ? backupCleanerIds : undefined,
          autoAssignBackup,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBookingData(
          data.booking
            ? { id: data.booking.id, guestToken: data.booking.guestToken ?? null }
            : null
        );

        trackConversion({
          cleanerId: cleaner.id,
          serviceType: form.serviceType,
          totalPrice: priceBreakdown.total,
        });

        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setStripePaymentIntentId(data.booking?.stripePaymentIntentId || null);
          setPaymentStep(true);
        }
      } else {
        const data = await response.json().catch(() => null);
        setBookingError(data?.error || `Something went wrong (${response.status})`);
      }
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Network error — please try again.');
    } finally {
      setPaymentPending(false);
      submittingRef.current = false;
    }
  };

  // ─── Stripe Payment Step ────────────────────────────────────
  if (paymentStep && clientSecret) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 bg-page">
        <h1 className="font-newsreader text-3xl font-semibold text-ink text-center">
          Complete Payment
        </h1>
        <p className="mt-2 font-jost text-sm font-light text-ink-2 text-center">
          Secure payment powered by Stripe.
        </p>

        {/* Booking summary */}
        <div className="mt-6 bg-primary-soft p-5" style={{ border: '0.5px solid #E4E9F0' }}>
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
              style={{ borderTop: '0.5px solid #E4E9F0' }}
            >
              <span className="text-ink-3">Booking total</span>
              <span className="font-normal text-ink">
                &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">Service fee</span>
              <span className="font-normal text-ink">
                &pound;{priceBreakdown.serviceFee.toFixed(2)}
              </span>
            </div>
            <div
              className="flex justify-between pt-2 mt-2"
              style={{ borderTop: '0.5px solid #E4E9F0' }}
            >
              <span className="font-normal text-ink">Total</span>
              <span className="font-newsreader text-2xl font-medium text-primary">
                &pound;{priceBreakdown.total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Stripe Payment Element */}
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
          <StripeCheckoutForm
            total={priceBreakdown.total}
            bookingId={bookingData?.id || ''}
            paymentIntentId={stripePaymentIntentId || ''}
            saveCard={saveCard}
            onSaveCardChange={handleSaveCardToggle}
            isGuest={bookingMode === 'guest'}
            guestToken={bookingData?.guestToken ?? null}
            onBack={() => {
              setPaymentStep(false);
              setPaymentPending(false);
            }}
          />
        </Elements>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center bg-page">
        <div className="mx-auto flex h-16 w-16 items-center justify-center bg-primary-soft text-3xl text-primary">
          &#10003;
        </div>
        <h1 className="mt-6 font-newsreader text-3xl font-semibold text-ink">
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
          className="mt-6 bg-primary-soft p-6 text-left"
          style={{ border: '0.5px solid #E4E9F0' }}
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
            <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid #E4E9F0' }}>
              <div className="flex justify-between">
                <span className="font-normal text-ink">Total</span>
                <span className="font-newsreader text-lg font-medium text-primary">
                  &pound;{priceBreakdown.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
        <AddToCalendar
          title={`${selectedService.label} - ${cleaner.name}`}
          description={`Cleaning with ${cleaner.name} via Rena. Booking ref: ${bookingData?.id || 'TBC'}`}
          location={[form.addressLine1, form.addressCity, form.addressPostcode]
            .filter(Boolean)
            .join(', ')}
          date={form.date}
          time={form.time}
          durationHours={form.duration}
        />

        <button
          onClick={() => router.push('/cleaners')}
          className="mt-8 bg-primary px-6 py-3 font-jost font-normal text-white hover:bg-primary-hover"
        >
          Browse More Cleaners
        </button>
      </div>
    );
  }

  if (step === 'service') {
    const hourly =
      cleaner.hourlyRateRegular ?? cleaner.hourlyRateDeep ?? cleaner.hourlyRateSameDay;
    const fixedMin = minPrice(cleaner.eotPrices) ?? minPrice(cleaner.airbnbPrices);
    const headlineMeta =
      typeof hourly === 'number'
        ? `from £${hourly.toFixed(2)}/hr`
        : typeof fixedMin === 'number'
          ? `from £${fixedMin.toFixed(2)}`
          : undefined;

    const priceFor = (value: string): string | null => {
      switch (value) {
        case 'regular':
          return typeof cleaner.hourlyRateRegular === 'number'
            ? `£${cleaner.hourlyRateRegular.toFixed(2)}/hr`
            : null;
        case 'deep':
          return typeof cleaner.hourlyRateDeep === 'number'
            ? `£${cleaner.hourlyRateDeep.toFixed(2)}/hr`
            : null;
        case 'same-day':
          return typeof cleaner.hourlyRateSameDay === 'number'
            ? `£${cleaner.hourlyRateSameDay.toFixed(2)}/hr`
            : null;
        case 'end-of-tenancy': {
          const m = minPrice(cleaner.eotPrices);
          return m !== null ? `from £${m.toFixed(2)}` : null;
        }
        case 'airbnb': {
          const m = minPrice(cleaner.airbnbPrices);
          return m !== null ? `from £${m.toFixed(2)}` : null;
        }
        default:
          return null;
      }
    };

    // Only services this cleaner offers (same gating as before), minus Same Day —
    // which always renders last as a muted, non-tappable SOON row.
    const offered = SERVICE_TYPES.filter((s) => {
      if (s.value === 'same-day') return false;
      const dbSlug = URL_SLUG_TO_DB_SLUG[s.value];
      if (!dbSlug || !cleaner.serviceTypes.includes(dbSlug)) return false;
      if (dbSlug === 'regular')
        return cleaner.hourlyRateRegular !== null && cleaner.hourlyRateRegular !== undefined;
      if (dbSlug === 'deep')
        return cleaner.hourlyRateDeep !== null && cleaner.hourlyRateDeep !== undefined;
      if (dbSlug === 'end_of_tenancy')
        return (
          cleaner.eotPrices !== null &&
          cleaner.eotPrices !== undefined &&
          Object.keys(cleaner.eotPrices).length > 0
        );
      if (dbSlug === 'airbnb')
        return (
          cleaner.airbnbPrices !== null &&
          cleaner.airbnbPrices !== undefined &&
          Object.keys(cleaner.airbnbPrices).length > 0
        );
      return true;
    });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sameDay = SERVICE_TYPES.find((s) => s.value === 'same-day')!;

    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 bg-page">
        {/* Cleaner header (S-C) */}
        <CleanerIdentity
          photo={cleaner.photo}
          name={cleaner.name}
          verified={cleaner.identityVerified || cleaner.verified}
          rating={cleaner.rating}
          reviewCount={cleaner.reviewCount}
          meta={headlineMeta}
        />

        <h1 className="mt-8 font-newsreader text-3xl font-semibold text-ink">
          What kind of cleaning do you need?
        </h1>
        <p className="mt-2 font-jost text-sm font-light text-ink-2">
          Choose a service to continue booking with {cleaner.name}.
        </p>

        {/* Service ledger — hairline rows with S3 imagery + the cleaner's real price */}
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {offered.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                router.push(`/services/${s.value}?cleaner=${params.id}`);
              }}
              className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition hover:bg-page"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SERVICE_IMAGES[s.value]}
                alt=""
                className="h-12 w-16 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-jost text-[15px] font-medium text-ink">{s.label}</h3>
                <p className="mt-0.5 font-jost text-[13px] font-light text-ink-2">{s.description}</p>
              </div>
              {priceFor(s.value) && (
                <span className="ml-3 shrink-0 font-newsreader text-[15px] font-semibold text-ink">
                  {priceFor(s.value)}
                </span>
              )}
            </button>
          ))}

          {/* Same Day — muted, greyscale, SOON, non-tappable (unchanged behaviour) */}
          <div className="flex w-full items-center gap-4 px-4 py-3.5 opacity-60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SERVICE_IMAGES['same-day']}
              alt=""
              className="h-12 w-16 shrink-0 rounded-lg object-cover grayscale"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-jost text-[15px] font-medium text-ink-2">{sameDay.label}</h3>
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.08em] text-ink-3">
                  Soon
                </span>
              </div>
              <p className="mt-0.5 font-jost text-[13px] font-light text-ink-3">
                {sameDay.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:max-w-6xl lg:px-8 bg-page">
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
      <h1 className="mt-2 font-newsreader text-3xl font-semibold text-ink">
        {isExpress ? 'Express Booking' : 'Book a Cleaning'}
      </h1>

      {/* Express banner */}
      {isExpress && cleaner.availableNow && (
        <div className="mt-4 bg-primary-soft p-4" style={{ border: '0.5px solid #E4E9F0' }}>
          <div className="flex items-center gap-3">
            <AvailableNowBadge responseTime={cleaner.responseTime} />
            <span className="font-jost text-sm font-light text-ink-2">
              Same-day rate:{' '}
              <strong className="font-normal text-ink">
                &pound;{(cleaner.hourlyRateSameDay ?? 0).toFixed(2)}/hr
              </strong>
            </span>
          </div>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            {cleaner.name} is available now and typically responds within {cleaner.responseTime}.
            Your booking will be prioritized.
          </p>
        </div>
      )}

      {/* Cleaner summary */}
      <div className="mt-6 flex items-start justify-between gap-4 rounded-[10px] border border-line bg-surface p-4">
        <CleanerIdentity
          photo={cleaner.photo}
          name={cleaner.name}
          verified={cleaner.identityVerified || cleaner.backgroundChecked}
          rating={cleaner.rating}
          reviewCount={cleaner.reviewCount}
          meta={
            <>
              {cleanerRateLabel}
              {isLastMinute && cleaner.hourlyRateSameDay && (
                <span className="text-primary">
                  {' '}
                  &middot; &pound;{cleaner.hourlyRateSameDay.toFixed(2)}/hr today
                </span>
              )}
            </>
          }
        />
        <span className="shrink-0 text-right font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
          Trusted &amp; verified
        </span>
      </div>

      {/* AI Estimator */}
      <div className="mt-6">
        <CleaningEstimator
          cleanerRate={cleaner.hourlyRateRegular ?? 0}
          sameDayRate={cleaner.hourlyRateSameDay ?? cleaner.hourlyRateRegular ?? 0}
          isLastMinute={isLastMinute}
          onEstimateApply={handleEstimateApply}
        />
      </div>

      {/* Quick rebook */}
      {pastBookings.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowRebook(!showRebook)}
            className="font-jost text-sm font-normal text-primary hover:text-primary/80"
          >
            {showRebook ? 'Hide past bookings' : 'Quick rebook from a past booking'}
          </button>
          {showRebook && (
            <div className="mt-3 space-y-2">
              {pastBookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => handleRebook(booking.id)}
                  className="w-full text-left p-3 hover:bg-page transition"
                  style={{ border: '0.5px solid #E4E9F0' }}
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
            <div className="mt-8 p-6" style={{ border: '0.5px solid #E4E9F0' }}>
              <h3 className="font-newsreader text-lg font-semibold text-ink mb-4">
                How would you like to book?
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setBookingMode('guest')}
                  className="p-4 text-left hover:bg-page transition"
                  style={{ border: '0.5px solid #E4E9F0' }}
                >
                  <p className="font-jost font-normal text-ink">Continue as Guest</p>
                  <p className="font-jost text-sm font-light text-ink-3 mt-1">
                    No account needed. We&apos;ll email you a link to manage your booking.
                  </p>
                </button>
                <button
                  onClick={() => setBookingMode('account')}
                  className="bg-primary-soft p-4 text-left hover:bg-page/80 transition"
                  style={{ border: '0.5px solid #E4E9F0' }}
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
              <h3 className="font-newsreader text-lg font-semibold text-ink">
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
                    style={{ border: '0.5px solid #E4E9F0' }}
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
                    onChange={(e) => {
                      setForm({ ...form, email: e.target.value });
                      if (emailError) setEmailError(null);
                    }}
                    onBlur={handleEmailBlur}
                    aria-invalid={!!emailError}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: emailError ? '1px solid #dc2626' : '0.5px solid #E4E9F0' }}
                  />
                  {emailError && (
                    <p className="mt-1 font-jost text-xs text-danger">{emailError}</p>
                  )}
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
                    style={{ border: '0.5px solid #E4E9F0' }}
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
                            form.addressId === addr.id
                              ? 'bg-primary text-white'
                              : 'bg-primary-soft text-ink-2 hover:bg-page/80'
                          }`}
                        >
                          {addr.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <AddressAutocomplete
                    // Auto-look-up the carried-through postcode on mount (dropdown,
                    // no manual "Find address"). Absent → free mode (manual) as before.
                    autoLookupPostcode={seededPostcode || undefined}
                    value={{
                      line1: form.addressLine1,
                      line2: form.addressLine2,
                      city: form.addressCity,
                      postcode: form.addressPostcode,
                    }}
                    onChange={(v) =>
                      setForm({
                        ...form,
                        addressLine1: v.line1,
                        addressLine2: v.line2,
                        addressCity: v.city,
                        addressPostcode: v.postcode,
                        // any manual/autocomplete edit clears the saved-address link
                        addressId: '',
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Service details */}
            <div>
              <h3 className="font-newsreader text-lg font-semibold text-ink">Service Details</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Service Type
                  </label>
                  <select
                    value={form.serviceType}
                    onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                    style={{ border: '0.5px solid #E4E9F0' }}
                  >
                    {SERVICE_TYPES.map((s) => (
                      <option key={s.value} value={s.value} disabled={s.value === 'same-day'}>
                        {s.label}
                        {s.value === 'same-day' ? ' (Coming Soon)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {isFixedPriceService(form.serviceType) ? (
                  <div>
                    <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                      Property Size
                    </label>
                    <select
                      value={form.bedrooms}
                      onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })}
                      className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                      style={{ border: '0.5px solid #E4E9F0' }}
                    >
                      {BEDROOM_OPTIONS.filter((o) =>
                        form.serviceType === 'airbnb' ? o.value <= 4 : true
                      ).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                      Duration (hours)
                    </label>
                    <select
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                      className="mt-1 w-full px-3 py-2 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink/20"
                      style={{ border: '0.5px solid #E4E9F0' }}
                    >
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((h) => (
                        <option key={h} value={h}>
                          {h} hour{h !== 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <DateTimePicker
                    cleanerId={params.id}
                    durationHours={form.duration}
                    value={
                      form.date && form.time
                        ? { date: form.date, time: form.time, time24: form.time }
                        : null
                    }
                    onChange={(sel: DateTimeSelection | null) => {
                      if (sel && sel.date && sel.time24) {
                        setForm((prev) => ({ ...prev, date: sel.date, time: sel.time24 }));
                      } else if (sel && sel.date) {
                        setForm((prev) => ({ ...prev, date: sel.date, time: '' }));
                      } else {
                        setForm((prev) => ({ ...prev, date: '', time: '' }));
                      }
                    }}
                    dateLabel="Preferred Date"
                    timeLabel="Preferred Time"
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
                style={{ border: '0.5px solid #E4E9F0' }}
              />
            </div>

            {/* Backup cleaner slider */}
            <div className="p-5" style={{ border: '0.5px solid #E4E9F0' }}>
              <BackupCleanerSlider
                cleaners={availableBackupCleaners}
                selectedIds={backupCleanerIds}
                onToggle={handleBackupToggle}
                maxSelections={3}
                autoAssign={autoAssignBackup}
                onAutoAssignChange={setAutoAssignBackup}
                serviceCategory={form.serviceType as ServiceCategory}
                propertySize={form.bedrooms}
              />
            </div>

            {/* Verification badge */}
            <div
              className="flex items-center justify-between bg-primary-soft px-4 py-3"
              style={{ border: '0.5px solid #E4E9F0' }}
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
              <div className="bg-primary-soft p-4" style={{ border: '0.5px solid #E4E9F0' }}>
                <h4 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
                  Booking Summary
                </h4>
                <div className="space-y-2 font-jost text-sm font-light">
                  <div className="flex justify-between">
                    <span className="text-ink-3">
                      {isFixedPriceService(form.serviceType) ? (
                        selectedService.label
                      ) : (
                        <>
                          Cleaning ({form.duration}h
                          {selectedService.multiplier !== 1 && (
                            <>
                              {' '}
                              &times; {selectedService.multiplier}x {selectedService.label}
                            </>
                          )}
                          )
                        </>
                      )}
                    </span>
                    <span className="font-normal text-ink">
                      &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {isLastMinute && !isFixedPriceService(form.serviceType) && (
                    <div className="font-jost text-xs font-light text-primary">
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
                    style={{ borderTop: '0.5px solid #E4E9F0' }}
                  >
                    <span className="font-normal text-ink">Total</span>
                    <span className="font-newsreader text-2xl font-medium text-primary">
                      &pound;{priceBreakdown.total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Exact price shown. No hidden charges, ever.
                </p>
              </div>
            </div>

            {bookingError && (
              <div className="p-3 rounded bg-danger/10 font-jost text-sm text-danger">
                {bookingError}
              </div>
            )}

            <button
              type="submit"
              disabled={paymentPending || (isFixedPriceService(form.serviceType) && !serverQuote)}
              className={`w-full py-3 font-jost text-lg font-normal text-white disabled:opacity-60 ${
                isLastMinute ? 'bg-primary hover:bg-primary-hover' : 'bg-primary hover:bg-primary-hover'
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
            <div className="bg-primary-soft p-5" style={{ border: '0.5px solid #E4E9F0' }}>
              <h4 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-4">
                Booking Summary
              </h4>

              {/* Cleaner info */}
              <div
                className="mb-4 flex items-center gap-3 border-b border-line pb-4"
              >
                <CleanerAvatar photo={cleaner.photo} name={cleaner.name} size={40} />
                <div>
                  <p className="font-jost text-sm font-medium text-ink">{cleaner.name}</p>
                  <p className="font-jost text-xs font-light text-ink-3">{cleanerRateLabel}</p>
                </div>
              </div>

              <div className="space-y-2 font-jost text-sm font-light">
                <div className="flex justify-between">
                  <span className="text-ink-3">
                    {isFixedPriceService(form.serviceType) ? (
                      selectedService.label
                    ) : (
                      <>
                        Cleaning ({form.duration}h
                        {selectedService.multiplier !== 1 && (
                          <>
                            {' '}
                            &times; {selectedService.multiplier}x {selectedService.label}
                          </>
                        )}
                        )
                      </>
                    )}
                  </span>
                  <span className="font-normal text-ink">
                    &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
                  </span>
                </div>
                {isLastMinute && !isFixedPriceService(form.serviceType) && (
                  <div className="font-jost text-xs font-light text-primary">
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
                  style={{ borderTop: '0.5px solid #E4E9F0' }}
                >
                  <span className="font-normal text-ink">Total</span>
                  <span className="font-newsreader text-2xl font-medium text-primary">
                    &pound;{priceBreakdown.total.toFixed(2)}
                  </span>
                </div>
              </div>
              <p className="mt-3 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Exact price shown. No hidden charges, ever.
              </p>

              {/* Security notice */}
              <div
                className="mt-3 pt-3 flex items-start gap-2.5"
                style={{ borderTop: '0.5px solid #E4E9F0' }}
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="#7A8A9E" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="font-jost text-xs font-light text-ink-2 leading-relaxed">
                  <p>Your payment is encrypted and processed securely by Stripe.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const formEl = document.querySelector('form');
                if (formEl) formEl.requestSubmit();
              }}
              disabled={
                paymentPending ||
                bookingMode === null ||
                (isFixedPriceService(form.serviceType) && !serverQuote)
              }
              className={`w-full py-3 font-jost text-lg font-normal text-white disabled:opacity-60 ${
                isLastMinute ? 'bg-primary hover:bg-primary-hover' : 'bg-primary hover:bg-primary-hover'
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
