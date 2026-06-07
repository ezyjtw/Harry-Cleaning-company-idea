'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect, useCallback } from 'react';

import AddToCalendar from '@/components/AddToCalendar';
import BackupCleanerSlider from '@/components/BackupCleanerSlider';
import StarRating from '@/components/StarRating';
import VerificationBadge from '@/components/VerificationBadge';
import { isInCatchmentArea } from '@/lib/catchment';
import { useCleanersApi } from '@/lib/hooks/useCleanersApi';
import { SERVICE_FEE_PERCENT } from '@/lib/pricing';
import type { ServiceCategory, KeyAccess, RoomConfig, Cleaner, Review } from '@/lib/types';

/** Given a start time like "8:00 AM" and duration in hours, returns end time string */
function getEndTime(startTime: string, durationHours: number): string {
  const [time, period] = startTime.split(' ');
  const [h, m] = time.split(':').map(Number);
  let totalMinutes = ((h % 12) + (period === 'PM' ? 12 : 0)) * 60 + m;
  totalMinutes += durationHours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  const endPeriod = endH >= 12 ? 'PM' : 'AM';
  const displayH = endH % 12 || 12;
  return `${displayH}:${endM.toString().padStart(2, '0')} ${endPeriod}`;
}

const SERVICE_LABELS: Record<ServiceCategory, string> = {
  regular: 'Regular Cleaning',
  'same-day': 'Same Day Cleaning',
  deep: 'Deep Cleaning',
  airbnb: 'AirBnB Cleaning',
  'end-of-tenancy': 'End of Tenancy Cleaning',
};

const SERVICE_DESCRIPTIONS: Record<ServiceCategory, string> = {
  regular:
    'Weekly or fortnightly visits with your preferred cleaner. Consistent quality at a time that works for you.',
  'same-day':
    'Need a cleaner today? We\u2019ll match you with a vetted, available cleaner near you for a same-day visit.',
  deep: 'Top-to-bottom. Inside appliances, skirting boards, and every corner. A thorough reset for your home.',
  airbnb: 'Fast, reliable turnarounds between guests. Checklist-based, linen-ready, every time.',
  'end-of-tenancy':
    'Landlord-ready cleaning with a satisfaction guarantee. Give yourself the best chance of your deposit back.',
};

/** Minimum cleaner rate (£14) × service multiplier, rounded down to nearest £ */
const MIN_CLEANER_RATE = 14;
const SERVICE_STARTING_RATES: Record<ServiceCategory, number> = {
  regular: MIN_CLEANER_RATE, // £14
  'same-day': Math.floor(MIN_CLEANER_RATE * 1.3), // £18
  deep: Math.floor(MIN_CLEANER_RATE * 1.45), // £20
  airbnb: 0, // fixed-price
  'end-of-tenancy': 0, // fixed-price
};

/** Short label describing the rate type for the current service */
const SERVICE_RATE_LABELS: Record<ServiceCategory, string> = {
  regular: 'hourly rate',
  'same-day': 'same-day rate',
  deep: 'deep clean rate',
  airbnb: 'fixed price',
  'end-of-tenancy': 'fixed price',
};

function getCleanerRateForService(cleaner: Cleaner, cat: ServiceCategory): number {
  if (cat === 'same-day') return cleaner.hourlyRateSameDay ?? cleaner.hourlyRateRegular ?? 0;
  if (cat === 'deep') return cleaner.hourlyRateDeep ?? 0;
  return cleaner.hourlyRateRegular ?? 0;
}

function getServiceListedRate(cleaner: Cleaner, cat: ServiceCategory): number {
  return getCleanerRateForService(cleaner, cat);
}

/** Extract the area prefix from a UK postcode (e.g. "SW1A 1AA" → "SW") */
function getPostcodeArea(postcode: string): string {
  const match = postcode
    .trim()
    .toUpperCase()
    .match(/^([A-Z]{1,2})/);
  return match ? match[1] : '';
}

/** Day abbreviations in order */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function dayAbbrToNextDate(abbr: string): string {
  const idx = DAY_NAMES.indexOf(abbr as (typeof DAY_NAMES)[number]);
  if (idx === -1) return abbr;
  const today = new Date();
  const todayDow = today.getDay();
  let daysAhead = idx - todayDow;
  if (daysAhead <= 0) daysAhead += 7;
  const target = new Date(today);
  target.setDate(target.getDate() + daysAhead);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const _ADDITIONAL_ROOMS = [
  'Conservatory',
  'Utility Room',
  'Garage',
  'Hallway',
  'Study / Office',
  'Dining Room',
  'Basement',
  'Attic Room',
];

const PRODUCT_FEE = 5; // £5 flat rate

// ─── Property size options for fixed-price services (EOT & Airbnb) ─────────
const PROPERTY_SIZES = [
  { key: 0, label: 'Studio' },
  { key: 1, label: '1 Bed' },
  { key: 2, label: '2 Bed' },
  { key: 3, label: '3 Bed' },
  { key: 4, label: '4 Bed' },
  { key: 5, label: '5+ Bed' },
];

// ─── Fixed-price tables from spec (by bedroom count / property size) ──────────
const EOT_SUGGESTED_RANGES: Record<number, [number, number]> = {
  0: [150, 200],
  1: [190, 240],
  2: [250, 300],
  3: [320, 380],
  4: [390, 450],
  5: [480, 580],
};
const AIRBNB_SUGGESTED_RANGES: Record<number, [number, number]> = {
  0: [45, 65],
  1: [55, 85],
  2: [75, 110],
  3: [95, 140],
  4: [130, 165],
};

// Add-ons per spec — EOT: oven £40, carpet £45/room, windows £25, fridge £20
// Airbnb: same-day turnaround £25, post-party deep clean £40
// Cleaner keeps 85% of add-on revenue
const EXTRA_SERVICES: Record<string, { id: string; label: string; price: number }[]> = {
  'end-of-tenancy': [
    { id: 'oven', label: 'Oven deep clean', price: 40 },
    { id: 'carpet', label: 'Carpet deep clean (per room)', price: 45 },
    { id: 'windows', label: 'Interior window clean', price: 25 },
    { id: 'fridge', label: 'Fridge clean', price: 20 },
  ],
  airbnb: [
    { id: 'same-day', label: 'Same-day turnaround (under 3hr notice)', price: 25 },
    { id: 'post-party', label: 'Post-party deep clean', price: 40 },
  ],
};

function calculateFixedPriceRange(
  category: ServiceCategory,
  rooms: RoomConfig,
  extras: string[]
): {
  lowPrice: number;
  highPrice: number;
  extrasTotal: number;
  lowTotal: number;
  highTotal: number;
} {
  const rangeTable = category === 'end-of-tenancy' ? EOT_SUGGESTED_RANGES : AIRBNB_SUGGESTED_RANGES;
  const maxKey = category === 'end-of-tenancy' ? 5 : 4;
  const bedroomKey = Math.min(rooms.bedrooms, maxKey);
  const range = rangeTable[bedroomKey] ?? [250, 300];
  const lowPrice = range[0];
  const highPrice = range[1];

  let extrasTotal = 0;
  const categoryExtras = EXTRA_SERVICES[category] ?? [];
  for (const extraId of extras) {
    const svc = categoryExtras.find((e) => e.id === extraId);
    if (svc) extrasTotal += svc.price;
  }

  return {
    lowPrice,
    highPrice,
    extrasTotal,
    lowTotal: lowPrice + extrasTotal,
    highTotal: highPrice + extrasTotal,
  };
}

const isFixedPrice = (cat: ServiceCategory) => cat === 'airbnb' || cat === 'end-of-tenancy';

const TIER_INFO: Record<string, { label: string; color: string; desc: string }> = {
  starter: { label: 'Starter', color: 'bg-slate-50 text-slate-500', desc: 'New to the platform' },
  bronze: {
    label: 'Bronze',
    color: 'bg-amber-50/60 text-amber-700',
    desc: 'Reliable and affordable',
  },
  silver: {
    label: 'Silver',
    color: 'bg-slate-50 text-slate-600',
    desc: 'Experienced and consistent',
  },
  gold: {
    label: 'Gold',
    color: 'bg-amber-50 text-amber-600',
    desc: 'Highly rated, proven track record',
  },
  elite: {
    label: 'Elite',
    color: 'bg-[#0f172a]/5 text-[#0f172a]',
    desc: 'Top-tier, best of the best',
  },
};

function calculateSuggestedHours(rooms: RoomConfig, category: ServiceCategory): number {
  let base = 0;
  base += rooms.bedrooms * 0.5;
  base += rooms.bathrooms * 0.5;
  base += rooms.livingAreas * 0.4;
  base += rooms.kitchen ? 0.5 : 0;
  base += rooms.additionals.length * 0.3;
  base = Math.max(base, 1.5);

  if (category === 'deep' || category === 'end-of-tenancy') {
    base *= 1.8;
  } else if (category === 'airbnb') {
    base *= 1.2;
  }

  return Math.round(base * 2) / 2;
}

type WizardPhase = 'quote' | 'cleaner';

export default function BookingWizardPage({ params }: { params: { category: string } }) {
  const category = params.category as ServiceCategory;
  const serviceLabel = SERVICE_LABELS[category] || 'Cleaning Service';
  const isRegular = category === 'regular';

  const { cleaners, getCleanerById } = useCleanersApi();

  // Check if a cleaner was pre-selected (coming from /book/[id] service selection)
  const searchParams = useSearchParams();
  const preSelectedCleanerId = searchParams.get('cleaner') ?? '';
  const preSelectedCleaner = preSelectedCleanerId ? getCleanerById(preSelectedCleanerId) : null;

  // Phase: "quote" = first page (postcode, rooms, hours, products, email)
  // Phase: "cleaner" = second page (flexible/set time, cleaner selection, key, notes)
  const [phase, setPhase] = useState<WizardPhase>('quote');

  // ─── Quote phase state ─────────────────────────
  const [postcode, setPostcode] = useState('');
  const [rooms, setRooms] = useState<RoomConfig>({
    bedrooms: 2,
    bathrooms: 1,
    livingAreas: 1,
    kitchen: true,
    additionals: [],
  });

  const suggestedHours = calculateSuggestedHours(rooms, category);
  const [selectedHours, setSelectedHours] = useState<number | null>(null);
  const effectiveHours = selectedHours ?? suggestedHours;
  const isUnderSuggested = effectiveHours < suggestedHours;

  const [cleanerNote, setCleanerNote] = useState('');
  const [cleanerBringsProducts, setCleanerBringsProducts] = useState(false);
  const [email, setEmail] = useState('');
  const [joinMailingList, setJoinMailingList] = useState(false);

  // Out-of-area waitlist
  const [outsideCatchment, setOutsideCatchment] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Fixed-price calculation for Airbnb & EOT (no extras — property-size-based pricing only)
  const fixedPriceQuote = useMemo(() => {
    if (!isFixedPrice(category)) return null;
    return calculateFixedPriceRange(category, rooms, []);
  }, [category, rooms]);

  // ─── Cleaner phase state ───────────────────────
  const [scheduling, setScheduling] = useState<'flexible' | 'set-time' | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedCleanerIds, setSelectedCleanerIds] = useState<string[]>(
    preSelectedCleanerId ? [preSelectedCleanerId] : []
  );
  const [profileCleaner, setProfileCleaner] = useState<Cleaner | null>(null);
  const [backupCleanerIds, setBackupCleanerIds] = useState<string[]>([]);
  const [autoAssignBackup, setAutoAssignBackup] = useState(false);
  const [keyAccess, setKeyAccess] = useState<KeyAccess>('i-will-be-home');
  const [keyAccessNote, setKeyAccessNote] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState('');

  const selectedCleaners = cleaners.filter((c) => selectedCleanerIds.includes(c.id));
  const selectedCleaner = selectedCleaners[0] ?? null;

  // Backup cleaners: exclude selected/pre-selected cleaner
  const currentCleanerId = preSelectedCleaner?.id ?? selectedCleaner?.id;
  const availableBackupCleaners = cleaners.filter((c) => c.id !== currentCleanerId);

  const handleBackupToggle = (cleanerId: string) => {
    setBackupCleanerIds((prev) =>
      prev.includes(cleanerId)
        ? prev.filter((id) => id !== cleanerId)
        : prev.length < 3
          ? [...prev, cleanerId]
          : prev
    );
  };

  const handleBookingSubmit = async () => {
    if (bookingSubmitting) return;
    setBookingSubmitting(true);
    try {
      const totalPrice =
        priceBreakdown.discountedTotal || (!priceBreakdown.isFixed ? priceBreakdown.total : 0) || 0;

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId: selectedCleaner?.id || 'auto-assign',
          name: email.split('@')[0],
          email,
          address: postcode,
          date: dayAbbrToNextDate(selectedDay),
          time: selectedTime || 'Flexible',
          duration: effectiveHours,
          serviceType: category,
          notes: specialInstructions || undefined,
          totalPrice,
          isGuest: true,
          backupCleanerIds: backupCleanerIds.length > 0 ? backupCleanerIds : undefined,
          rooms: {
            ...rooms,
            cleanerBringsProducts,
            keyAccess,
            keyAccessNote: keyAccessNote || undefined,
          },
        }),
      });

      if (joinMailingList && email) {
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            postcode,
            bedrooms: rooms.bedrooms,
            bathrooms: rooms.bathrooms,
            serviceType: category,
            estimatedTotal: totalPrice,
          }),
        }).catch(() => {});
      }

      if (response.ok) {
        const data = await response.json();
        setConfirmedBookingId(data.booking?.id || '');
        setSubmitted(true);
      }
    } catch {
      // Handle error silently for now
    } finally {
      setBookingSubmitting(false);
    }
  };

  // ─── Step-by-step back navigation ────────────────────
  // Determines which "step" the user is on for back-button behaviour
  const currentStep = useMemo(() => {
    if (submitted) return 'submitted';
    if (phase === 'quote') return 'quote';
    if (selectedCleanerIds.length > 0) return 'booking';
    if (scheduling === 'flexible') return 'browse';
    if (scheduling === 'set-time' && selectedTime) return 'set-time-results';
    if (scheduling === 'set-time') return 'set-time';
    return 'choose-method';
  }, [phase, scheduling, selectedCleanerIds, selectedTime, submitted]);

  const goBack = useCallback(() => {
    if (profileCleaner) {
      setProfileCleaner(null);
      return;
    }
    switch (currentStep) {
      case 'booking':
        setSelectedCleanerIds([]);
        setSelectedDay('');
        setSelectedTime('');
        break;
      case 'browse':
        setScheduling(null);
        break;
      case 'set-time-results':
        setSelectedTime('');
        break;
      case 'set-time':
        setScheduling(null);
        setSelectedDay('');
        setSelectedTime('');
        break;
      case 'choose-method':
        setPhase('quote');
        break;
      default:
        break;
    }
  }, [currentStep, profileCleaner]);

  // Push browser history on each step change so the back button works
  useEffect(() => {
    if (phase === 'cleaner') {
      window.history.pushState({ step: currentStep }, '');
    }
  }, [currentStep, phase]);

  useEffect(() => {
    function handlePopState() {
      goBack();
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack]);

  const priceBreakdown = useMemo(() => {
    if (isFixedPrice(category) && fixedPriceQuote) {
      // Range-based model for Airbnb & End of Tenancy — suggested range by property size
      const lowSubtotal = fixedPriceQuote.lowTotal;
      const highSubtotal = fixedPriceQuote.highTotal;
      const lowServiceFee = Math.round(lowSubtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
      const highServiceFee = Math.round(highSubtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
      return {
        isFixed: true as const,
        lowPrice: fixedPriceQuote.lowPrice,
        highPrice: fixedPriceQuote.highPrice,
        extrasTotal: fixedPriceQuote.extrasTotal,
        cleaningSubtotal: lowSubtotal,
        displayServiceFee: lowServiceFee,
        lowTotal: Math.round((lowSubtotal + lowServiceFee) * 100) / 100,
        highTotal: Math.round((highSubtotal + highServiceFee) * 100) / 100,
        discountedTotal: Math.round((lowSubtotal + lowServiceFee) * 100) / 100,
        discount: 0,
        listedHourlyRate: 0,
        listedSubtotal: lowSubtotal,
      };
    }
    const activeCleaner = preSelectedCleaner ?? selectedCleaner;
    const rawRate = activeCleaner
      ? getCleanerRateForService(activeCleaner, category)
      : MIN_CLEANER_RATE;
    const listedHourlyRate = Math.round(rawRate * 100) / 100;
    const listedSubtotal = Math.round(rawRate * effectiveHours * 100) / 100;
    const cleaningSubtotal = listedSubtotal;
    const serviceFee = Math.round(cleaningSubtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
    return {
      isFixed: false as const,
      listedSubtotal,
      listedHourlyRate,
      discount: 0,
      cleaningSubtotal,
      displayServiceFee: serviceFee,
      total:
        Math.round(
          (listedSubtotal + Math.round(listedSubtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100) *
            100
        ) / 100,
      serviceFee,
      discountedTotal: Math.round((cleaningSubtotal + serviceFee) * 100) / 100,
    };
  }, [preSelectedCleaner, selectedCleaner, effectiveHours, category, fixedPriceQuote]);

  const productCost = cleanerBringsProducts ? PRODUCT_FEE : 0;

  const isSameDay = category === 'same-day';

  // Today's day abbreviation (e.g. 'Mon')
  const todayAbbr = DAY_NAMES[new Date().getDay()];

  // Same-day: cleaners filtered by postcode area and available today
  const sameDayCleaners = useMemo(() => {
    if (!isSameDay) return [];
    const area = getPostcodeArea(postcode);
    return cleaners
      .filter((c) => {
        // Must cover this postcode area (or show all if no postcode)
        if (area && !c.postcodeAreas.includes(area)) return false;
        // Must have time slots today
        return (c.timeSlots[todayAbbr] ?? []).length > 0;
      })
      .sort((a, b) => {
        // Available now first, then by rating
        if (a.availableNow !== b.availableNow) return a.availableNow ? -1 : 1;
        return b.rating - a.rating;
      });
  }, [cleaners, isSameDay, postcode, todayAbbr]);

  // Filter cleaners for set-time mode — match both day and time slot
  const availableCleaners = useMemo(() => {
    if (scheduling !== 'set-time' || !selectedDay) return cleaners;
    return cleaners.filter((c) => {
      if (!c.availability.includes(selectedDay)) return false;
      if (selectedTime && c.timeSlots[selectedDay]) {
        return c.timeSlots[selectedDay].includes(selectedTime);
      }
      return true;
    });
  }, [cleaners, scheduling, selectedDay, selectedTime]);

  // All unique time slots across all cleaners for the selected day
  const availableTimeSlotsForDay = useMemo(() => {
    if (!selectedDay) return [];
    const slots = new Set<string>();
    cleaners.forEach((c) => {
      if (c.timeSlots[selectedDay]) {
        c.timeSlots[selectedDay].forEach((s) => slots.add(s));
      }
    });
    return Array.from(slots).sort((a, b) => {
      const toMin = (t: string) => {
        const [time, period] = t.split(' ');
        const [h, m] = time.split(':').map(Number);
        return ((h % 12) + (period === 'PM' ? 12 : 0)) * 60 + m;
      };
      return toMin(a) - toMin(b);
    });
  }, [cleaners, selectedDay]);

  // Count cleaners available at each time slot for a given day
  const cleanerCountsPerSlot = useMemo(() => {
    if (!selectedDay) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    availableTimeSlotsForDay.forEach((slot) => {
      counts[slot] = cleaners.filter(
        (c) => c.timeSlots[selectedDay] && c.timeSlots[selectedDay].includes(slot)
      ).length;
    });
    return counts;
  }, [cleaners, selectedDay, availableTimeSlotsForDay]);

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center bg-cream min-h-screen">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-cream-2 text-3xl text-gold ring-1 ring-ink/[0.06]">
          &#10003;
        </div>
        <h1 className="mt-8 font-cormorant font-light text-3xl text-ink">Booking Request Sent</h1>
        <p className="mt-5 font-jost font-light text-ink-2">
          {isFixedPrice(category) ? (
            <>
              We&apos;ve received your {serviceLabel.toLowerCase()} request
              {selectedCleaners.length > 0
                ? `. We\u2019ll try to match you with ${selectedCleaners.map((sc) => sc.name).join(', ')}`
                : `. We\u2019ll assign the best available cleaner`}
              . You&apos;ll receive a confirmation at{' '}
              <span className="font-normal text-ink">{email}</span>.
            </>
          ) : (
            <>
              We&apos;ve sent your {serviceLabel.toLowerCase()} request
              {selectedCleaners.length > 0
                ? ` to ${selectedCleaners.map((sc) => sc.name).join(' & ')}`
                : ''}
              . You&apos;ll receive a confirmation at{' '}
              <span className="font-normal text-ink">{email}</span>.
            </>
          )}
        </p>
        {joinMailingList && (
          <p className="mt-3 font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
            You&apos;ve been added to our mailing list for tips and offers.
          </p>
        )}

        {selectedDay && (
          <AddToCalendar
            title={`${serviceLabel}${selectedCleaners.length > 0 ? ` - ${selectedCleaners.map((c) => c.name).join(', ')}` : ''}`}
            description={`Cleaning booked via Rena. Ref: ${confirmedBookingId || 'TBC'}`}
            location={postcode}
            date={selectedDay}
            time={selectedTime || '9:00 AM'}
            durationHours={effectiveHours}
          />
        )}

        <Link
          href="/"
          className="mt-10 inline-block bg-ink px-8 py-3.5 font-jost text-[11px] uppercase tracking-[0.1em] text-cream hover:bg-gold transition"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // ─── PHASE 1: Quote ────────────────────────────
  if (phase === 'quote') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:max-w-6xl lg:px-8 bg-cream min-h-screen">
        {/* Back link */}
        <Link
          href="/"
          className="group inline-flex items-center gap-2 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-3 hover:text-gold transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-3/20 group-hover:border-gold/40 group-hover:bg-gold/5 transition-all">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </span>
          Back
        </Link>

        {/* Hero header */}
        <div className="mt-6 animate-fade-in">
          <h1 className="font-jost font-medium text-2xl text-ink sm:text-3xl">{serviceLabel}</h1>
          <p className="mt-2 max-w-xl font-jost text-sm font-light leading-relaxed text-ink-3">
            {SERVICE_DESCRIPTIONS[category] || 'Professional cleaning tailored to your home.'}
          </p>
          <div className="my-6 h-px bg-ink/[0.06]" />

          {/* Trust chips */}
          <div className="flex flex-wrap items-center gap-3">
            {[
              { icon: '\u2713', text: 'Verified Cleaners' },
              { icon: '\u2713', text: 'Escrow Protected' },
              { icon: '\u2713', text: 'Satisfaction Guarantee' },
            ].map((chip) => (
              <span
                key={chip.text}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 font-jost text-[11px] font-medium tracking-wide text-ink-2 shadow-sm ring-1 ring-ink/[0.06]"
              >
                <span className="text-gold">{chip.icon}</span>
                {chip.text}
              </span>
            ))}
          </div>
        </div>

        {/* Step indicator */}
        <div className="mt-8 flex items-center gap-2">
          {[
            { num: 1, label: 'Configure' },
            { num: 2, label: 'Choose Cleaner' },
            { num: 3, label: 'Confirm' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-ink-3/15 sm:w-10" />}
              <span
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] transition-colors ${
                  s.num === 1 ? 'bg-ink text-cream shadow-sm' : 'bg-ink-3/8 text-ink-3/50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                    s.num === 1 ? 'bg-cream/20 text-cream' : 'bg-ink-3/10 text-ink-3/40'
                  }`}
                >
                  {s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10 lg:grid lg:grid-cols-[1fr,420px] lg:gap-10 lg:items-start">
          <div className="space-y-8">
            {/* Postcode */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-jost font-medium text-base text-ink">Your Postcode</h2>
              <input
                type="text"
                value={postcode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setPostcode(val);
                  // Check catchment when a full postcode is entered
                  const fullPostcode = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
                  if (fullPostcode.test(val.trim())) {
                    setOutsideCatchment(!isInCatchmentArea(val));
                  } else {
                    setOutsideCatchment(false);
                  }
                }}
                placeholder="e.g. SW1A 1AA"
                className="mt-4 w-full rounded-lg bg-cream px-4 py-3.5 font-jost text-lg font-light text-ink ring-1 ring-ink/[0.06] transition-all focus:outline-none focus:ring-2 focus:ring-gold/30"
              />

              {/* Out-of-area waitlist */}
              {outsideCatchment && !waitlistSubmitted && (
                <div className="mt-4 rounded-lg bg-cream-2 p-5 ring-1 ring-ink/[0.06]">
                  <p className="font-jost text-sm font-normal text-ink">
                    We&apos;re expanding to your area soon
                  </p>
                  <p className="mt-1 font-jost text-xs font-light text-ink-3">
                    Leave your email and we&apos;ll notify you when we launch near{' '}
                    <span className="font-normal text-ink">{postcode}</span>.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (waitlistEmail.trim()) {
                            setWaitlistLoading(true);
                            fetch('/api/waitlist', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: waitlistEmail.trim(), postcode }),
                            })
                              .then(() => setWaitlistSubmitted(true))
                              .catch(() => {})
                              .finally(() => setWaitlistLoading(false));
                          }
                        }
                      }}
                      placeholder="your@email.com"
                      className="flex-1 rounded-lg bg-white px-4 py-3 font-jost text-sm font-light text-ink ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!waitlistEmail.trim()) return;
                        setWaitlistLoading(true);
                        fetch('/api/waitlist', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: waitlistEmail.trim(), postcode }),
                        })
                          .then(() => setWaitlistSubmitted(true))
                          .catch(() => {})
                          .finally(() => setWaitlistLoading(false));
                      }}
                      disabled={waitlistLoading || !waitlistEmail.trim()}
                      className="rounded-lg bg-ink px-5 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-cream transition hover:bg-gold disabled:opacity-50"
                    >
                      {waitlistLoading ? 'Sending...' : 'Notify Me'}
                    </button>
                  </div>
                </div>
              )}

              {outsideCatchment && waitlistSubmitted && (
                <div className="mt-4 rounded-lg bg-cream-2 p-5 ring-1 ring-ink/[0.06]">
                  <p className="font-jost text-sm font-normal text-ink">You&apos;re on the list</p>
                  <p className="mt-1 font-jost text-xs font-light text-ink-3">
                    We&apos;ll email you as soon as we launch in your area.
                  </p>
                </div>
              )}
            </div>

            {/* Property Size — for fixed-price services (EOT & Airbnb) */}
            {isFixedPrice(category) && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
                <h2 className="font-jost font-medium text-base text-ink">Property Size</h2>
                <p className="mt-2 font-jost text-xs font-light text-ink-3">
                  Select your property size to get a guide price.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {(category === 'end-of-tenancy'
                    ? PROPERTY_SIZES
                    : PROPERTY_SIZES.filter((s) => s.key <= 4)
                  ).map((size) => (
                    <button
                      key={size.key}
                      type="button"
                      onClick={() => setRooms({ ...rooms, bedrooms: size.key })}
                      className={`rounded-xl p-4 text-center transition-all duration-200 ${
                        rooms.bedrooms === size.key
                          ? 'bg-gold/5 ring-2 ring-gold shadow-sm'
                          : 'bg-cream ring-1 ring-ink/[0.06] hover:-translate-y-0.5 hover:shadow-md'
                      }`}
                    >
                      <p
                        className={`font-jost text-sm font-normal ${rooms.bedrooms === size.key ? 'text-ink' : 'text-ink-2'}`}
                      >
                        {size.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rooms — for hourly services */}
            {!isFixedPrice(category) && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
                <h2 className="font-jost font-medium text-base text-ink">How Many Rooms?</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Counter
                    label="Bedrooms"
                    value={rooms.bedrooms}
                    onChange={(v) => setRooms({ ...rooms, bedrooms: v })}
                    min={0}
                    max={10}
                  />
                  <Counter
                    label="Bathrooms"
                    value={rooms.bathrooms}
                    onChange={(v) => setRooms({ ...rooms, bathrooms: v })}
                    min={1}
                    max={6}
                  />
                  <Counter
                    label="Living Areas"
                    value={rooms.livingAreas}
                    onChange={(v) => setRooms({ ...rooms, livingAreas: v })}
                    min={0}
                    max={5}
                  />
                </div>
              </div>
            )}

            {/* Hours — only for hourly services */}
            {!isFixedPrice(category) && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
                <h2 className="font-jost font-medium text-base text-ink">How Many Hours?</h2>
                <div className="mt-4 rounded-lg bg-cream-2/60 p-4 ring-1 ring-ink/[0.04]">
                  <p className="font-jost font-light text-sm text-ink-2">
                    We recommend{' '}
                    <span className="font-normal text-ink">{suggestedHours} hours</span> for your{' '}
                    {rooms.bedrooms} bedroom, {rooms.bathrooms} bathroom home.
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setSelectedHours(h)}
                      className={`relative rounded-full px-4 py-2.5 font-jost text-sm font-light transition-all duration-200 ${
                        effectiveHours === h
                          ? 'bg-ink text-cream shadow-sm'
                          : h === suggestedHours
                            ? 'bg-white text-ink ring-1 ring-gold/40 hover:ring-gold/60'
                            : 'bg-white text-ink-2 ring-1 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink'
                      }`}
                    >
                      {h}h
                      {h === suggestedHours && effectiveHours !== h && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-white">
                          &#10003;
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {isUnderSuggested && (
                  <div className="mt-4 rounded-lg bg-cream-2/60 p-5 ring-1 ring-ink/[0.04]">
                    <p className="font-jost font-light text-sm text-ink-2">
                      You&apos;ve selected fewer hours than recommended. Leave a note for the
                      cleaner so they know where to focus:
                    </p>
                    <textarea
                      rows={2}
                      value={cleanerNote}
                      onChange={(e) => setCleanerNote(e.target.value)}
                      placeholder="e.g. Please focus on the kitchen and bathrooms..."
                      className="mt-3 w-full rounded-lg bg-cream px-3 py-2.5 font-jost text-sm font-light text-ink ring-1 ring-ink/[0.06] focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Extra services section removed — EOT & Airbnb use property-size-based pricing only */}

            {/* Products */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-jost font-medium text-base text-ink">Cleaning Products</h2>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCleanerBringsProducts(false)}
                  className={`flex-1 rounded-xl p-4 text-left transition-all duration-200 ${
                    !cleanerBringsProducts
                      ? 'bg-gold/5 ring-2 ring-gold shadow-sm'
                      : 'bg-cream ring-1 ring-ink/[0.06] hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <p className="font-jost text-sm font-normal text-ink">
                    I&apos;ll provide products
                  </p>
                  <p
                    className={`mt-1 font-jost text-[11px] uppercase tracking-[0.1em] ${!cleanerBringsProducts ? 'text-gold' : 'text-ink-3'}`}
                  >
                    No extra cost
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setCleanerBringsProducts(true)}
                  className={`flex-1 rounded-xl p-4 text-left transition-all duration-200 ${
                    cleanerBringsProducts
                      ? 'bg-gold/5 ring-2 ring-gold shadow-sm'
                      : 'bg-cream ring-1 ring-ink/[0.06] hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <p className="font-jost text-sm font-normal text-ink">Cleaner brings products</p>
                  <p
                    className={`mt-1 font-jost text-[11px] uppercase tracking-[0.1em] ${cleanerBringsProducts ? 'text-gold' : 'text-ink-3'}`}
                  >
                    Additional &pound;5 charge
                  </p>
                </button>
              </div>
            </div>

            {/* Email */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-jost font-medium text-base text-ink">Your Email</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-4 w-full rounded-lg bg-cream px-4 py-3.5 font-jost font-light text-ink ring-1 ring-ink/[0.06] transition-all focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              <label className="mt-4 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={joinMailingList}
                  onChange={(e) => setJoinMailingList(e.target.checked)}
                  className="h-4 w-4 rounded border-ink-3 text-gold focus:ring-gold/30"
                />
                <span className="font-jost text-sm font-light text-ink-2">
                  Tick here to receive promotional offers
                </span>
              </label>
            </div>

            {/* Price display */}
            <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-ink via-gold to-teal" />
              {priceBreakdown.isFixed && fixedPriceQuote ? (
                <>
                  <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Suggested price range
                  </span>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between font-jost text-sm">
                      <span className="font-light text-ink-3">
                        {category === 'end-of-tenancy' ? 'End of tenancy' : 'Airbnb'} clean
                      </span>
                      <span className="text-ink">
                        &pound;{fixedPriceQuote.lowPrice} &ndash; &pound;{fixedPriceQuote.highPrice}
                      </span>
                    </div>
                    {productCost > 0 && (
                      <div className="flex justify-between font-jost text-sm">
                        <span className="font-light text-ink-3">Cleaning products</span>
                        <span className="text-ink">&pound;{productCost.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-jost text-sm">
                      <span className="font-light text-ink-3">
                        Service fee ({SERVICE_FEE_PERCENT}%)
                      </span>
                      <span className="text-ink">
                        &pound;
                        {(
                          Math.round(fixedPriceQuote.lowTotal * (SERVICE_FEE_PERCENT / 100) * 100) /
                          100
                        ).toFixed(2)}{' '}
                        &ndash; &pound;
                        {(
                          Math.round(
                            fixedPriceQuote.highTotal * (SERVICE_FEE_PERCENT / 100) * 100
                          ) / 100
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-ink/[0.06]">
                      <span className="font-jost font-normal text-ink">Total</span>
                      <span className="font-cormorant font-light text-3xl text-ink">
                        &pound;{(priceBreakdown.lowTotal + productCost).toFixed(2)} &ndash; &pound;
                        {(priceBreakdown.highTotal + productCost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 font-jost font-light text-xs text-ink-3">
                    Cleaner-set prices by property size. No hidden charges, ever.
                  </p>
                </>
              ) : (
                <>
                  <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    {preSelectedCleaner ? 'Your price' : 'Guide price'}
                  </span>
                  {preSelectedCleaner && (
                    <p className="mt-1 font-jost font-light text-xs text-ink-3">
                      {preSelectedCleaner.name} — &pound;
                      {getServiceListedRate(preSelectedCleaner, category).toFixed(2)}
                      /hr
                    </p>
                  )}
                  {!preSelectedCleaner && (
                    <p className="mt-1 font-jost font-light text-xs text-ink-3">
                      Starting at &pound;
                      {SERVICE_STARTING_RATES[category]}
                      /hr
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between font-jost text-sm">
                      <span className="font-light text-ink-3">Cleaning ({effectiveHours}h)</span>
                      <span className="text-ink">
                        &pound;{priceBreakdown.cleaningSubtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-jost text-sm">
                      <span className="font-light text-ink-3">
                        Service fee ({SERVICE_FEE_PERCENT}%)
                      </span>
                      <span className="text-ink">
                        &pound;{priceBreakdown.displayServiceFee.toFixed(2)}
                      </span>
                    </div>
                    {productCost > 0 && (
                      <div className="flex justify-between font-jost text-sm">
                        <span className="font-light text-ink-3">Cleaning products</span>
                        <span className="text-ink">&pound;{productCost.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 font-jost border-t border-ink/[0.06]">
                      <span className="text-sm text-ink">Total</span>
                      <span className="font-cormorant font-light text-3xl text-ink">
                        &pound;{(priceBreakdown.discountedTotal + productCost).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 font-jost font-light text-xs text-ink-3">
                    {!preSelectedCleaner
                      ? 'Final price depends on your chosen cleaner\u2019s rate. No hidden charges.'
                      : 'No hidden charges, ever.'}
                  </p>
                </>
              )}
            </div>

            {/* Continue */}
            <button
              type="button"
              onClick={() => setPhase('cleaner')}
              disabled={!postcode || !email || outsideCatchment}
              className="w-full rounded-lg bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.15em] text-cream shadow-sm transition-all duration-200 hover:bg-gold hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {outsideCatchment ? 'Not yet available in your area' : 'Continue'}
            </button>
          </div>
          {/* End left column */}

          {/* Right column — sticky booking summary (desktop only) */}
          <div className="hidden lg:block">
            <div className="sticky top-8 animate-fade-in space-y-4">
              <div className="relative overflow-hidden rounded-xl bg-white p-8 shadow-sm ring-1 ring-ink/[0.06]">
                <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-ink via-gold to-teal" />
                <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Booking Summary
                </span>

                <div className="mt-5 space-y-3">
                  <SummaryRow label="Service" value={serviceLabel} />
                  {postcode && <SummaryRow label="Postcode" value={postcode} />}
                  <SummaryRow
                    label="Space"
                    value={`${rooms.bedrooms} bed, ${rooms.bathrooms} bath, ${rooms.livingAreas} living${rooms.kitchen ? ', kitchen' : ''}${rooms.additionals.length > 0 ? `, +${rooms.additionals.length} more` : ''}`}
                  />
                  <SummaryRow label="Duration" value={`${effectiveHours} hours`} />
                  <SummaryRow
                    label="Products"
                    value={
                      cleanerBringsProducts
                        ? `Cleaner brings (+\u00A3${PRODUCT_FEE})`
                        : 'Customer provides'
                    }
                  />
                  {preSelectedCleaner && (
                    <SummaryRow
                      label="Cleaner"
                      value={`${preSelectedCleaner.name} (${TIER_INFO[preSelectedCleaner.tier].label}) — \u00A3${priceBreakdown.listedHourlyRate}/hr`}
                    />
                  )}
                </div>

                <div className="pt-5 mt-5 space-y-3 border-t border-ink/[0.06]">
                  <div className="flex justify-between font-jost text-sm">
                    <span className="font-light text-ink-3">Cleaning ({effectiveHours}h)</span>
                    <span className="text-ink">
                      &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {productCost > 0 && (
                    <div className="flex justify-between font-jost text-sm">
                      <span className="font-light text-ink-3">Cleaning products</span>
                      <span className="text-ink">&pound;{productCost.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-jost text-sm">
                    <span className="font-light text-ink-3">
                      Service fee ({SERVICE_FEE_PERCENT}%)
                    </span>
                    <span className="text-ink">
                      &pound;{priceBreakdown.displayServiceFee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-ink/[0.06]">
                    <span className="font-jost font-normal text-ink">Total</span>
                    <span className="font-cormorant font-light text-3xl text-ink">
                      &pound;
                      {(priceBreakdown.discountedTotal + productCost).toFixed(2)}
                    </span>
                  </div>
                  {isRegular && (
                    <p className="mt-2 font-jost font-light text-xs text-ink-3">
                      Per clean. Cancel or pause your schedule anytime.
                    </p>
                  )}
                  {!preSelectedCleaner && (
                    <p className="mt-2 font-jost font-light text-xs text-ink-3">
                      Final price depends on your chosen cleaner&apos;s rate.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── PHASE 2: Cleaner selection / Time slot picker ────────────────

  // When cleaner is pre-selected, show time slot picker directly
  if (preSelectedCleaner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
        {/* Back link */}
        <button
          onClick={() => setPhase('quote')}
          className="group inline-flex items-center gap-2 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-3 hover:text-gold transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-3/20 group-hover:border-gold/40 group-hover:bg-gold/5 transition-all">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </span>
          Back to quote
        </button>

        <h1 className="mt-6 font-cormorant font-light text-3xl text-ink sm:text-4xl">
          Choose a Time
        </h1>
        <div className="my-6 h-px bg-gradient-to-r from-transparent via-ink/10 to-transparent" />

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[
            { num: 1, label: 'Configure', done: true },
            { num: 2, label: 'Choose Cleaner', active: true },
            { num: 3, label: 'Confirm' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-6 sm:w-10 ${s.done || s.active ? 'bg-gold/30' : 'bg-ink-3/15'}`}
                />
              )}
              <span
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] transition-colors ${
                  s.active
                    ? 'bg-ink text-cream shadow-sm'
                    : s.done
                      ? 'bg-gold/10 text-gold'
                      : 'bg-ink-3/8 text-ink-3/50'
                }`}
              >
                {s.done ? (
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                      s.active ? 'bg-cream/20 text-cream' : 'bg-ink-3/10 text-ink-3/40'
                    }`}
                  >
                    {s.num}
                  </span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Cleaner summary */}
        <div className="mt-8 flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink/[0.06]">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream-2 font-cormorant text-xl font-light text-ink ring-1 ring-ink/[0.06]">
            {preSelectedCleaner.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-jost font-normal text-ink">{preSelectedCleaner.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${TIER_INFO[preSelectedCleaner.tier].color}`}
              >
                {TIER_INFO[preSelectedCleaner.tier].label}
              </span>
              <VerificationBadge
                identityVerified={preSelectedCleaner.identityVerified}
                backgroundChecked={preSelectedCleaner.backgroundChecked}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-jost font-light text-sm text-ink-3">
              <StarRating rating={preSelectedCleaner.rating} />
              <span>
                {preSelectedCleaner.rating} ({preSelectedCleaner.reviewCount} reviews)
              </span>
              <span className="text-ink-3/30">|</span>
              <span>
                &pound;
                {getServiceListedRate(preSelectedCleaner, category).toFixed(2)}
                /hr ({SERVICE_RATE_LABELS[category]})
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-8">
          {/* Day selection from cleaner's availability */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
            <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">Pick a day</h2>
            <p className="mt-2 font-jost font-light text-sm text-ink-3">
              {preSelectedCleaner.name} is available on the following days.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {preSelectedCleaner.availability.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setSelectedTime('');
                  }}
                  className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                    selectedDay === day
                      ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                      : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time slot selection — from cleaner's actual availability */}
          {selectedDay && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Pick a time
              </h2>
              <p className="mt-2 font-jost font-light text-sm text-ink-3">
                {preSelectedCleaner.name}&apos;s available start times on {selectedDay}s.
              </p>
              {(preSelectedCleaner.timeSlots[selectedDay] ?? []).length > 0 ? (
                <div className="mt-5 flex flex-wrap gap-2.5">
                  {(preSelectedCleaner.timeSlots[selectedDay] ?? []).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                        selectedTime === slot
                          ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                          : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-5 font-jost text-sm font-light text-ink-3">
                  No available slots on this day. Please try another day.
                </p>
              )}
            </div>
          )}

          {/* Backup cleaner slider */}
          {selectedDay && selectedTime && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <BackupCleanerSlider
                cleaners={availableBackupCleaners}
                selectedIds={backupCleanerIds}
                onToggle={handleBackupToggle}
                maxSelections={3}
                autoAssign={autoAssignBackup}
                onAutoAssignChange={setAutoAssignBackup}
                serviceCategory={category}
                propertySize={rooms.bedrooms}
              />
            </div>
          )}

          {/* Escrow payment notice */}
          {selectedDay && selectedTime && (
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <div className="h-0.5 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5 rounded-t-xl bg-gradient-to-r from-ink via-gold to-teal" />
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-gold"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 1a1 1 0 100 2 1 1 0 000-2z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h4 className="font-cormorant text-lg font-light text-ink">
                    Payment Held in Escrow
                  </h4>
                  <p className="mt-1.5 font-jost text-sm font-light text-ink-2 leading-relaxed">
                    You will see a charge to your bank account for the booking summary shown above,
                    but the payment will be held securely in escrow.
                  </p>
                  {backupCleanerIds.length > 0 && (
                    <p className="mt-2 font-jost text-sm font-light text-ink-2 leading-relaxed">
                      In the event that your chosen cleaner does not accept the booking, one of your
                      selected backup cleaners will be used instead. Our system will either provide
                      a small refund or apply a small additional charge to your account to align
                      with the new cleaner&apos;s rate as shown in the booking summary.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 font-jost text-xs font-light text-gold">
                    <span>&#10003; Funds held safely</span>
                    <span>&#10003; Released after completion</span>
                    {backupCleanerIds.length > 0 && (
                      <span>&#10003; Auto-adjusted for backup rates</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Key access */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
            <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
              How will the cleaner get in?
            </h2>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {(
                [
                  { value: 'lockbox', label: 'Keybox' },
                  { value: 'key-under-mat', label: 'Key hidden' },
                  { value: 'i-will-be-home', label: 'Someone will be in' },
                  { value: 'with-concierge', label: 'Concierge' },
                ] as { value: KeyAccess; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setKeyAccess(opt.value)}
                  className={`rounded-lg px-4 py-3.5 text-left font-jost font-light text-sm ring-1 transition-all ${
                    keyAccess === opt.value
                      ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                      : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:shadow-sm'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {(keyAccess === 'lockbox' || keyAccess === 'key-under-mat') && (
              <input
                type="text"
                value={keyAccessNote}
                onChange={(e) => setKeyAccessNote(e.target.value)}
                placeholder={
                  keyAccess === 'lockbox'
                    ? 'Lockbox code or location...'
                    : 'Where is the key hidden?'
                }
                className="mt-4 w-full rounded-lg bg-cream px-4 py-3 font-jost font-light text-sm text-ink ring-1 ring-ink/[0.06] transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            )}
          </div>

          {/* Special instructions */}
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
            <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
              Special instructions
            </h2>
            <p className="mt-2 font-jost font-light text-sm text-ink-3">
              Anything the cleaner should know or be careful with?
            </p>
            <textarea
              rows={3}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. 'Dog is friendly but barks', 'Please be careful with the antique vase', 'Don't move items on the desk'..."
              className="mt-4 w-full rounded-lg bg-cream px-4 py-3 font-jost font-light text-sm text-ink ring-1 ring-ink/[0.06] transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleBookingSubmit}
            disabled={!selectedDay || !selectedTime}
            className="w-full rounded-lg bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.15em] text-cream shadow-sm transition-all hover:bg-gold hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bookingSubmitting ? 'Processing...' : 'Confirm & Pay'}
          </button>
        </div>
      </div>
    );
  }

  // ─── PHASE 2 (Same-Day): Show cleaners in area with today's availability ──
  if (isSameDay) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
        {/* Back */}
        <button
          onClick={() => setPhase('quote')}
          className="group mb-6 inline-flex items-center gap-2 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-3 hover:text-gold transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-3/20 group-hover:border-gold/40 group-hover:bg-gold/5 transition-all">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </span>
          Back
        </button>

        <h1 className="font-cormorant font-light text-3xl text-ink sm:text-4xl">
          Cleaners Available Today
        </h1>
        <p className="mt-3 font-jost font-light text-sm text-ink-3">
          {sameDayCleaners.length > 0 ? (
            <>
              <span className="font-normal text-ink">{sameDayCleaners.length}</span>{' '}
              {sameDayCleaners.length === 1 ? 'cleaner' : 'cleaners'} available near{' '}
              <span className="font-normal text-ink">{postcode.toUpperCase()}</span> today (
              {todayAbbr}). Pick a cleaner and choose a time slot.
            </>
          ) : (
            <>
              No cleaners available near{' '}
              <span className="font-normal text-ink">{postcode.toUpperCase()}</span> today. Try a
              different postcode or check back later.
            </>
          )}
        </p>

        {/* Cleaner cards with time slots */}
        <div className="mt-8 space-y-6">
          {sameDayCleaners.map((c) => {
            const todaySlots = c.timeSlots[todayAbbr] ?? [];
            const tier = TIER_INFO[c.tier];
            const isSelected = selectedCleanerIds.includes(c.id);
            const listedRate = c.hourlyRateSameDay ?? c.hourlyRateRegular ?? 0;

            return (
              <div
                key={c.id}
                className={`rounded-xl bg-white shadow-sm ring-1 transition-all ${isSelected ? 'ring-2 ring-gold' : 'ring-ink/[0.06]'}`}
              >
                {/* Cleaner header */}
                <div className="p-5 flex items-start gap-4 sm:p-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream-2 text-xl font-light text-ink font-cormorant ring-1 ring-ink/[0.06]">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-jost font-normal text-ink">{c.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${tier.color}`}
                      >
                        {tier.label}
                      </span>
                      <VerificationBadge
                        identityVerified={c.identityVerified}
                        backgroundChecked={c.backgroundChecked}
                      />
                      {c.availableNow && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
                          </span>
                          <span className="font-jost text-[11px] font-medium text-teal">
                            Available now
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 font-jost font-light text-sm text-ink-3">
                      <StarRating rating={c.rating} />
                      <span>
                        {c.rating} ({c.reviewCount} reviews)
                      </span>
                      <span className="text-ink-3/30">|</span>
                      <span>{c.location}</span>
                    </div>
                    <p className="mt-2 font-jost font-light text-xs text-ink-3 line-clamp-2">
                      {c.bio}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-cormorant font-light text-2xl text-ink">
                      &pound;{listedRate.toFixed(2)}
                    </span>
                    <span className="font-jost font-light text-[11px] text-ink-3">/hr</span>
                    <p className="font-jost font-light text-[10px] text-ink-3 mt-0.5">
                      same-day rate
                    </p>
                  </div>
                </div>

                {/* Today's time slots */}
                <div className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
                  <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
                    Available times today ({todayAbbr})
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {todaySlots.map((slot) => {
                      const isSlotSelected = isSelected && selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            if (isSlotSelected) {
                              // Deselect
                              setSelectedCleanerIds([]);
                              setSelectedTime('');
                              setSelectedDay('');
                            } else {
                              setSelectedCleanerIds([c.id]);
                              setSelectedTime(slot);
                              setSelectedDay(todayAbbr);
                            }
                          }}
                          className={`rounded-full px-4 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                            isSlotSelected
                              ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                              : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected summary & continue */}
        {selectedCleanerIds.length > 0 && selectedTime && (
          <div className="mt-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
            <div className="h-0.5 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5 rounded-t-xl bg-gradient-to-r from-ink via-gold to-teal" />
            <div className="flex items-center justify-between">
              <div>
                <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Your booking
                </span>
                <p className="mt-1 font-jost font-light text-sm text-ink">
                  {cleaners.find((c) => c.id === selectedCleanerIds[0])?.name} &middot; Today at{' '}
                  {selectedTime} &middot; {effectiveHours}h
                </p>
              </div>
              <div className="text-right">
                <span className="font-cormorant font-light text-2xl text-ink">
                  &pound;{priceBreakdown.isFixed ? '0' : priceBreakdown.discountedTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Booking details (key access, notes, submit) — show when cleaner + time selected */}
        {selectedCleanerIds.length > 0 && selectedTime && (
          <div className="mt-6 space-y-6">
            {/* Key access */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Property access
              </h2>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    { value: 'i-will-be-home' as KeyAccess, label: 'I\u2019ll be home' },
                    { value: 'key-under-mat' as KeyAccess, label: 'Key under mat' },
                    { value: 'lockbox' as KeyAccess, label: 'Lockbox' },
                    { value: 'with-concierge' as KeyAccess, label: 'With concierge' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKeyAccess(opt.value)}
                    className={`rounded-lg p-4 text-center font-jost text-sm font-light ring-1 transition-all ${
                      keyAccess === opt.value
                        ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                        : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:shadow-sm'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Special instructions */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Special instructions
              </h2>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Anything your cleaner should know? (optional)"
                rows={3}
                className="mt-4 w-full rounded-lg bg-cream px-4 py-3 font-jost font-light text-sm text-ink ring-1 ring-ink/[0.06] placeholder:text-ink-3/50 transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleBookingSubmit}
              className="w-full rounded-lg bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.15em] text-cream shadow-sm transition-all hover:bg-gold hover:shadow-md active:scale-[0.98]"
            >
              Confirm Same-Day Booking
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── PHASE 2 (Fixed-Price): Cleaner → Day/Time → Backup → Summary → Submit ──
  if (isFixedPrice(category)) {
    const priceField = category === 'end-of-tenancy' ? 'eotPrices' : 'airbnbPrices';
    const maxBedKey = category === 'end-of-tenancy' ? 5 : 4;
    const bedroomKey = Math.min(rooms.bedrooms, maxBedKey);

    // Only show cleaners that have a price for this service & property size
    const eligibleCleaners = cleaners.filter((c) => {
      const prices = c[priceField];
      return prices && prices[bedroomKey] !== undefined;
    });

    // Derive the selected cleaner's actual price
    const fixedSelectedCleaner = selectedCleaner;
    const cleanerBasePrice = fixedSelectedCleaner?.[priceField]?.[bedroomKey] ?? 0;
    const extrasTotal = fixedPriceQuote?.extrasTotal ?? 0;
    const subtotal = cleanerBasePrice + extrasTotal;
    const serviceFee = Math.round(subtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
    const total = Math.round((subtotal + serviceFee) * 100) / 100;

    // Backup cleaners: exclude the selected cleaner, only those with pricing
    const fixedBackupCandidates = eligibleCleaners.filter((c) => c.id !== fixedSelectedCleaner?.id);

    // Determine current step for back navigation
    const fixedStep = !fixedSelectedCleaner
      ? 'choose-cleaner'
      : !selectedDay || !selectedTime
        ? 'choose-time'
        : 'review';

    const goBackFixed = () => {
      switch (fixedStep) {
        case 'review':
          setSelectedDay('');
          setSelectedTime('');
          break;
        case 'choose-time':
          setSelectedCleanerIds([]);
          setSelectedDay('');
          setSelectedTime('');
          break;
        case 'choose-cleaner':
        default:
          setPhase('quote');
          break;
      }
    };

    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
        {/* Back */}
        <button
          onClick={goBackFixed}
          className="group mb-6 inline-flex items-center gap-2 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-3 hover:text-gold transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-3/20 group-hover:border-gold/40 group-hover:bg-gold/5 transition-all">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </span>
          Back
        </button>

        {/* Step pills */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => setPhase('quote')}
            className="flex items-center gap-2 rounded-full bg-gold/10 px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] text-gold hover:bg-gold/20 transition-colors"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Quote
          </button>
          {[
            { key: 'choose-cleaner', label: 'Cleaner' },
            { key: 'choose-time', label: 'Schedule' },
            { key: 'review', label: 'Book' },
          ].map((step) => {
            const stepOrder = ['choose-cleaner', 'choose-time', 'review'];
            const currentIdx = stepOrder.indexOf(fixedStep);
            const isActive = step.key === fixedStep;
            const isPast = stepOrder.indexOf(step.key) < currentIdx;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={`h-px w-6 transition-colors ${isPast || isActive ? 'bg-gold/30' : 'bg-ink-3/15'}`}
                />
                {isPast ? (
                  <span className="flex items-center gap-2 rounded-full bg-gold/10 px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] text-gold">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    {step.label}
                  </span>
                ) : (
                  <span
                    className={`rounded-full px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] transition-colors ${
                      isActive ? 'bg-ink text-cream shadow-sm' : 'bg-ink-3/8 text-ink-3/50'
                    }`}
                  >
                    {step.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <h1 className="font-cormorant font-light text-3xl text-ink sm:text-4xl">
          {category === 'end-of-tenancy' ? 'End of Tenancy' : 'Airbnb'} Booking
        </h1>
        <p className="mt-2 font-jost font-light text-sm text-ink-3">
          {rooms.bedrooms === 0 ? 'Studio' : `${rooms.bedrooms}-bed`} property
        </p>

        {/* ── Step 1: Choose a cleaner ────────────────────── */}
        {fixedStep === 'choose-cleaner' && (
          <div className="mt-8">
            <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
              Choose your cleaner
            </h2>
            <p className="mt-2 font-jost font-light text-sm text-ink-3">
              Each cleaner sets their own price. Select one to continue.
            </p>

            {eligibleCleaners.length === 0 ? (
              <div className="mt-6 rounded-xl bg-white p-6 text-center ring-1 ring-ink/[0.06]">
                <p className="font-jost font-light text-sm text-ink-3">
                  No cleaners currently offer{' '}
                  {category === 'end-of-tenancy' ? 'end of tenancy' : 'Airbnb'} cleaning for this
                  property size. Please try a different configuration.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {eligibleCleaners.map((c) => {
                  const tier = TIER_INFO[c.tier];
                  const price = (c[priceField] ?? {})[bedroomKey] ?? 0;
                  const priceFee = Math.round(price * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
                  const priceTotal = Math.round((price + priceFee) * 100) / 100;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCleanerIds([c.id]);
                        setBackupCleanerIds([]);
                        setAutoAssignBackup(false);
                      }}
                      className="group rounded-xl p-5 text-left shadow-sm ring-1 transition-all hover:shadow-md bg-white ring-ink/[0.06] hover:bg-cream"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream-2 group-hover:bg-cream text-lg font-light text-ink font-cormorant ring-1 ring-ink/[0.06] transition">
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-jost font-normal text-sm text-ink">{c.name}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${tier.color}`}
                            >
                              {tier.label}
                            </span>
                            <VerificationBadge
                              identityVerified={c.identityVerified}
                              backgroundChecked={c.backgroundChecked}
                            />
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 font-jost font-light text-xs text-ink-3">
                            <StarRating rating={c.rating} />
                            <span>
                              {c.rating} ({c.reviewCount})
                            </span>
                            <span className="text-ink-3/30">|</span>
                            <span>{c.completedJobs} jobs</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 font-jost font-light text-xs text-ink-3 line-clamp-2">
                        {c.bio}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {c.specialties.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-cream-2 px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.05em] text-ink-3 ring-1 ring-ink/[0.06]"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      {/* Price */}
                      <div className="mt-4 flex items-baseline justify-between border-t border-ink/[0.06] pt-3">
                        <span className="font-jost font-light text-xs text-ink-3">
                          {rooms.bedrooms === 0 ? 'Studio' : `${rooms.bedrooms}-bed`} price
                        </span>
                        <div className="text-right">
                          <span className="font-cormorant font-light text-2xl text-ink">
                            &pound;{priceTotal.toFixed(2)}
                          </span>
                          <span className="block font-jost font-light text-[10px] text-ink-3">
                            incl. {SERVICE_FEE_PERCENT}% service fee
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Day & time ──────────────────────────── */}
        {fixedStep === 'choose-time' && fixedSelectedCleaner && (
          <div className="mt-8">
            {/* Selected cleaner summary */}
            <div className="rounded-xl bg-white p-4 ring-1 ring-ink/[0.06] flex items-center gap-3.5 mb-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cream-2 text-lg font-light text-ink font-cormorant ring-1 ring-ink/[0.06]">
                {fixedSelectedCleaner.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-jost font-normal text-sm text-ink">
                  {fixedSelectedCleaner.name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <StarRating rating={fixedSelectedCleaner.rating} />
                  <span className="font-jost font-light text-xs text-ink-3">
                    {fixedSelectedCleaner.rating}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-cormorant font-light text-xl text-ink">
                  &pound;{cleanerBasePrice}
                </span>
                <span className="block font-jost font-light text-[10px] text-ink-3">
                  + {SERVICE_FEE_PERCENT}% fee
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                When would you like this done?
              </h2>
              <div className="mt-5">
                <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
                  Day
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day);
                        setSelectedTime('');
                      }}
                      className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                        selectedDay === day
                          ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                          : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              {selectedDay && (
                <div className="mt-6">
                  <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mb-3">
                    Preferred start time
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      '8:00 AM',
                      '9:00 AM',
                      '10:00 AM',
                      '11:00 AM',
                      '12:00 PM',
                      '1:00 PM',
                      '2:00 PM',
                      '3:00 PM',
                      '4:00 PM',
                    ].map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setSelectedTime(time)}
                        className={`rounded-full px-4 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                          selectedTime === time
                            ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                            : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Backup cleaners + Summary + Submit ──── */}
        {fixedStep === 'review' && fixedSelectedCleaner && (
          <div className="mt-8 space-y-8">
            {/* Backup cleaners */}
            {fixedBackupCandidates.length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
                <BackupCleanerSlider
                  cleaners={fixedBackupCandidates}
                  selectedIds={backupCleanerIds}
                  onToggle={handleBackupToggle}
                  maxSelections={3}
                  autoAssign={autoAssignBackup}
                  onAutoAssignChange={setAutoAssignBackup}
                  serviceCategory={category}
                  propertySize={rooms.bedrooms}
                />
              </div>
            )}

            {/* Key access */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Property access
              </h2>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    { value: 'i-will-be-home' as KeyAccess, label: 'I\u2019ll be home' },
                    { value: 'key-under-mat' as KeyAccess, label: 'Key under mat' },
                    { value: 'lockbox' as KeyAccess, label: 'Lockbox' },
                    { value: 'with-concierge' as KeyAccess, label: 'With concierge' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKeyAccess(opt.value)}
                    className={`rounded-lg p-4 text-center font-jost text-sm font-light ring-1 transition-all ${
                      keyAccess === opt.value
                        ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                        : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:shadow-sm'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Special instructions */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Special instructions
              </h2>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Anything your cleaner should know? (optional)"
                rows={3}
                className="mt-4 w-full rounded-lg bg-cream px-4 py-3 font-jost font-light text-sm text-ink ring-1 ring-ink/[0.06] placeholder:text-ink-3/50 transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>

            {/* Booking summary */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <div className="h-0.5 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5 rounded-t-xl bg-gradient-to-r from-ink via-gold to-teal" />
              <span className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Booking summary
              </span>

              <div className="mt-5 space-y-2.5">
                <div className="flex justify-between font-jost text-sm">
                  <span className="font-light text-ink-3">Cleaner</span>
                  <span className="text-ink">{fixedSelectedCleaner.name}</span>
                </div>
                <div className="flex justify-between font-jost text-sm">
                  <span className="font-light text-ink-3">
                    {category === 'end-of-tenancy' ? 'End of tenancy' : 'Airbnb'} clean (
                    {rooms.bedrooms === 0 ? 'Studio' : `${rooms.bedrooms}-bed`})
                  </span>
                  <span className="text-ink">&pound;{cleanerBasePrice.toFixed(2)}</span>
                </div>
                {extrasTotal > 0 && (
                  <div className="flex justify-between font-jost text-sm">
                    <span className="font-light text-ink-3">Extras</span>
                    <span className="text-ink">&pound;{extrasTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-jost text-sm">
                  <span className="font-light text-ink-3">
                    Service fee ({SERVICE_FEE_PERCENT}%)
                  </span>
                  <span className="text-ink">&pound;{serviceFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-jost text-sm">
                  <span className="font-light text-ink-3">When</span>
                  <span className="text-ink">
                    {selectedDay}, {selectedTime}
                  </span>
                </div>
                {backupCleanerIds.length > 0 && (
                  <div className="flex justify-between font-jost text-sm">
                    <span className="font-light text-ink-3">Backup cleaners</span>
                    <span className="text-ink">
                      {backupCleanerIds
                        .map((id) => cleaners.find((c) => c.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-3 border-t border-ink/[0.06]">
                  <span className="font-jost font-normal text-ink">Total</span>
                  <span className="font-cormorant font-light text-3xl text-ink">
                    &pound;{total.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="mt-3 font-jost font-light text-xs text-ink-3">
                Price set by {fixedSelectedCleaner.name}. {SERVICE_FEE_PERCENT}% service fee
                included. No hidden charges.
              </p>
            </div>

            <button
              type="button"
              onClick={handleBookingSubmit}
              disabled={bookingSubmitting}
              className="w-full rounded-lg bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.15em] text-cream shadow-sm transition-all hover:bg-gold hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bookingSubmitting ? 'Submitting\u2026' : 'Submit Booking Request'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── PHASE 2: Cleaner selection (no pre-selected cleaner) ────────────────

  const stepLabels = [
    { key: 'choose-method', label: 'Method' },
    ...(scheduling === 'flexible'
      ? [{ key: 'browse', label: 'Browse' }]
      : scheduling === 'set-time'
        ? [{ key: 'set-time', label: 'Schedule' }]
        : []),
    { key: 'booking', label: 'Book' },
  ];

  const activeStepIndex = stepLabels.findIndex(
    (s) => s.key === currentStep || (s.key === 'set-time' && currentStep === 'set-time-results')
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
      {/* ── Step indicator bar ── */}
      <div className="relative">
        {/* Back button */}
        <button
          onClick={goBack}
          className="group mb-6 inline-flex items-center gap-2 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-3 hover:text-gold transition-colors"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-ink-3/20 group-hover:border-gold/40 group-hover:bg-gold/5 transition-all">
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </span>
          Back
        </button>

        {/* Step progress pills */}
        <div className="flex items-center gap-3">
          {/* Quote (always clickable, always behind) */}
          <button
            onClick={() => setPhase('quote')}
            className="flex items-center gap-2 rounded-full bg-gold/10 px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] text-gold hover:bg-gold/20 transition-colors"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Quote
          </button>

          {stepLabels.map((step, i) => {
            const isActive = i === activeStepIndex;
            const isPast = i < activeStepIndex;
            return (
              <div key={step.key} className="flex items-center gap-3">
                {/* Connector line */}
                <div
                  className={`h-px w-6 transition-colors ${
                    isPast || isActive ? 'bg-gold/30' : 'bg-ink-3/15'
                  }`}
                />
                {/* Step pill */}
                {isPast ? (
                  <button
                    onClick={() => {
                      if (step.key === 'choose-method') {
                        setScheduling(null);
                        setSelectedCleanerIds([]);
                        setSelectedDay('');
                        setSelectedTime('');
                      } else if (step.key === 'browse' || step.key === 'set-time') {
                        setSelectedCleanerIds([]);
                        setSelectedDay('');
                        setSelectedTime('');
                      }
                    }}
                    className="flex items-center gap-2 rounded-full bg-gold/10 px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] text-gold hover:bg-gold/20 transition-colors"
                  >
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    {step.label}
                  </button>
                ) : (
                  <span
                    className={`rounded-full px-3.5 py-1.5 font-jost text-[10px] uppercase tracking-[0.15em] transition-colors ${
                      isActive ? 'bg-ink text-cream shadow-sm' : 'bg-ink-3/8 text-ink-3/50'
                    }`}
                  >
                    {step.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Page title */}
        <h1 className="mt-8 font-cormorant font-light text-3xl text-ink sm:text-4xl">
          {currentStep === 'choose-method' && 'How would you like to book?'}
          {currentStep === 'browse' && 'Browse Available Cleaners'}
          {(currentStep === 'set-time' || currentStep === 'set-time-results') &&
            'Pick a Date & Time'}
          {currentStep === 'booking' && 'Complete Your Booking'}
        </h1>
        <p className="mt-2 font-jost font-light text-sm text-ink-3">
          {currentStep === 'choose-method' &&
            'Start with what matters most \u2014 the cleaner or the time slot.'}
          {currentStep === 'browse' &&
            `${cleaners.length} cleaners available \u00b7 click to view profile`}
          {(currentStep === 'set-time' || currentStep === 'set-time-results') &&
            `Your clean is ${effectiveHours} hours \u00b7 select a day then a start time`}
          {currentStep === 'booking' && 'Review your details and confirm.'}
        </p>
      </div>

      <div className="mt-10 space-y-10">
        {/* ── Scheduling preference choice ── */}
        {scheduling === null && selectedCleanerIds.length === 0 && (
          <div>
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Cleaner-first card */}
              <button
                type="button"
                onClick={() => setScheduling('flexible')}
                className="group relative overflow-hidden rounded-xl bg-white p-8 text-left shadow-sm ring-1 ring-ink/[0.06] transition-all duration-300 hover:shadow-md hover:ring-ink/15 hover:-translate-y-0.5"
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-ink/[0.02] blur-2xl transition-all duration-300 group-hover:bg-ink/[0.04]" />

                <div className="relative">
                  <h3 className="font-cormorant text-xl text-ink">Choose your cleaner</h3>
                  <p className="mt-2 font-jost font-light text-[13px] leading-relaxed text-ink-3">
                    Browse available cleaners, view profiles and reviews, then pick the right fit.
                    You&apos;ll arrange a time that suits you both.
                  </p>

                  <div className="mt-5 flex items-center gap-3">
                    <span className="inline-flex rounded-full bg-cream-2/60 px-2.5 py-1 font-jost text-[10px] uppercase tracking-[0.1em] text-ink-3">
                      Flexible on timing
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-ink/[0.04] pt-5">
                    <span className="inline-flex items-center gap-1.5 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-2 group-hover:text-ink transition-colors">
                      Browse cleaners
                      <svg
                        className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>

              {/* Time-first card */}
              <button
                type="button"
                onClick={() => setScheduling('set-time')}
                className="group relative overflow-hidden rounded-xl bg-white p-8 text-left shadow-sm ring-1 ring-ink/[0.06] transition-all duration-300 hover:shadow-md hover:ring-ink/15 hover:-translate-y-0.5"
              >
                <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-ink/[0.02] blur-2xl transition-all duration-300 group-hover:bg-ink/[0.04]" />

                <div className="relative">
                  <h3 className="font-cormorant text-xl text-ink">Choose your time</h3>
                  <p className="mt-2 font-jost font-light text-[13px] leading-relaxed text-ink-3">
                    Lock in the date and time that works for you. We&apos;ll show cleaners who are
                    available for that slot.
                  </p>

                  <div className="mt-5 flex items-center gap-3">
                    <span className="inline-flex rounded-full bg-cream-2/60 px-2.5 py-1 font-jost text-[10px] uppercase tracking-[0.1em] text-ink-3">
                      Flexible on the cleaner
                    </span>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-ink/[0.04] pt-5">
                    <span className="inline-flex items-center gap-1.5 font-jost text-[11px] uppercase tracking-[0.15em] text-ink-2 group-hover:text-ink transition-colors">
                      Pick a time
                      <svg
                        className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            FLOW A: Browse available cleaners (flexible)
           ════════════════════════════════════════════════════════════ */}
        {scheduling === 'flexible' && selectedCleanerIds.length === 0 && (
          <div>
            {/* Tier legend */}
            <div className="mt-6 flex flex-wrap gap-3">
              {(['elite', 'gold', 'silver', 'bronze', 'starter'] as const).map((tier) => (
                <span
                  key={tier}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-jost text-[11px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${TIER_INFO[tier].color}`}
                >
                  {TIER_INFO[tier].label}
                </span>
              ))}
            </div>

            {/* Cleaner grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {cleaners.map((c) => {
                const tier = TIER_INFO[c.tier];
                const isAlreadySelected = selectedCleanerIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      isAlreadySelected
                        ? setSelectedCleanerIds((prev) => prev.filter((id) => id !== c.id))
                        : setProfileCleaner(c)
                    }
                    className={`group rounded-xl p-5 text-left shadow-sm ring-1 transition-all hover:shadow-md ${
                      isAlreadySelected
                        ? 'bg-gold/5 ring-2 ring-gold'
                        : 'bg-white ring-ink/[0.06] hover:bg-cream'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream-2 group-hover:bg-cream text-lg font-light text-ink font-cormorant ring-1 ring-ink/[0.06] transition">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-jost font-normal text-sm text-ink">{c.name}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${tier.color}`}
                          >
                            {tier.label}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-jost font-light text-xs text-ink-3">
                          <StarRating rating={c.rating} />
                          <span>
                            {c.rating} ({c.reviewCount})
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-cormorant font-light text-lg text-ink">
                          &pound;{getServiceListedRate(c, category).toFixed(2)}
                        </span>
                        <span className="font-jost font-light text-[11px] text-ink-3">/hr</span>
                        <p className="font-jost font-light text-[10px] text-ink-3 mt-0.5">
                          {SERVICE_RATE_LABELS[category]}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 font-jost font-light text-xs text-ink-3 line-clamp-2">
                      {c.bio}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.specialties.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-cream-2 px-2.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.05em] text-ink-3 ring-1 ring-ink/[0.06]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    {c.availableNow && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal" />
                        </span>
                        <span className="font-jost text-[11px] font-medium text-teal">
                          Available now
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            FLOW B: Pick a date and time (set-time)
           ════════════════════════════════════════════════════════════ */}
        {scheduling === 'set-time' && selectedCleanerIds.length === 0 && (
          <div>
            <div className="space-y-6">
              {/* Day selector */}
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
                <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                  Pick a day
                </h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const hasCleaners = cleaners.some(
                      (c) => c.timeSlots[day] && c.timeSlots[day].length > 0
                    );
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={!hasCleaners}
                        onClick={() => {
                          setSelectedDay(day);
                          setSelectedTime('');
                        }}
                        className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                          selectedDay === day
                            ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                            : hasCleaners
                              ? 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                              : 'bg-cream text-ink-3/30 ring-ink/[0.06] cursor-not-allowed'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots with cleaner counts */}
              {selectedDay && (
                <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
                  <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                    Available times on {selectedDay}
                  </h2>
                  {availableTimeSlotsForDay.length > 0 ? (
                    <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {availableTimeSlotsForDay.map((slot) => {
                        const endTime = getEndTime(slot, effectiveHours);
                        const count = cleanerCountsPerSlot[slot] || 0;
                        const isSelected = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`flex items-center justify-between rounded-lg px-4 py-3.5 text-left ring-1 transition-all ${
                              isSelected
                                ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                                : 'bg-cream text-ink ring-ink/[0.06] hover:bg-cream-2 hover:shadow-sm'
                            }`}
                          >
                            <div>
                              <span className="font-jost text-sm font-normal">
                                {slot} &ndash; {endTime}
                              </span>
                            </div>
                            <span
                              className={`font-jost text-xs font-light ${isSelected ? 'text-ink-3' : 'text-ink-3'}`}
                            >
                              {count} cleaner{count !== 1 ? 's' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-5 font-jost text-sm font-light text-ink-3">
                      No cleaners available on this day.
                    </p>
                  )}
                </div>
              )}

              {/* Show available cleaners for selected time slot */}
              {selectedDay && selectedTime && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                      Available cleaners for {selectedTime} &ndash;{' '}
                      {getEndTime(selectedTime, effectiveHours)} on {selectedDay}
                    </label>
                  </div>
                  {availableCleaners.length > 0 ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {availableCleaners.map((c) => {
                        const tier = TIER_INFO[c.tier];
                        const isAlreadySelected = selectedCleanerIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() =>
                              isAlreadySelected
                                ? setSelectedCleanerIds((prev) => prev.filter((id) => id !== c.id))
                                : setProfileCleaner(c)
                            }
                            className={`group rounded-xl p-5 text-left shadow-sm ring-1 transition-all hover:shadow-md ${
                              isAlreadySelected
                                ? 'bg-gold/5 ring-2 ring-gold'
                                : 'bg-white ring-ink/[0.06] hover:bg-cream'
                            }`}
                          >
                            <div className="flex items-start gap-3.5">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream-2 group-hover:bg-cream text-lg font-light text-ink font-cormorant ring-1 ring-ink/[0.06] transition">
                                {c.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-jost font-normal text-sm text-ink">
                                    {c.name}
                                  </span>
                                  <span
                                    className={`rounded-full px-1.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${tier.color}`}
                                  >
                                    {tier.label}
                                  </span>
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 font-jost font-light text-xs text-ink-3">
                                  <StarRating rating={c.rating} />
                                  <span>
                                    {c.rating} ({c.reviewCount})
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="font-cormorant font-light text-lg text-ink">
                                  &pound;
                                  {getServiceListedRate(c, category).toFixed(2)}
                                </span>
                                <span className="font-jost font-light text-[11px] text-ink-3">
                                  /hr
                                </span>
                                <p className="font-jost font-light text-[10px] text-ink-3 mt-0.5">
                                  {SERVICE_RATE_LABELS[category]}
                                </p>
                              </div>
                            </div>
                            <p className="mt-3 font-jost font-light text-xs text-ink-3 line-clamp-2">
                              {c.bio}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-ink/[0.06]">
                      <p className="font-jost font-light text-sm text-ink-2">
                        No cleaners available for this slot. Try a different time.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            BOOKING PAGE (shown after selecting a cleaner from either flow)
           ════════════════════════════════════════════════════════════ */}
        {selectedCleanerIds.length >= 1 && selectedCleaner && (
          <>
            {/* Selected cleaner header */}
            <div className="space-y-3">
              {selectedCleaners.map((sc) => (
                <div
                  key={sc.id}
                  className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-ink/[0.06] sm:p-6"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream-2 text-xl font-light text-ink font-cormorant ring-1 ring-ink/[0.06]">
                    {sc.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-jost font-normal text-ink">{sc.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${TIER_INFO[sc.tier].color}`}
                      >
                        {TIER_INFO[sc.tier].label}
                      </span>
                      <VerificationBadge
                        identityVerified={sc.identityVerified}
                        backgroundChecked={sc.backgroundChecked}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 font-jost font-light text-sm text-ink-3">
                      <StarRating rating={sc.rating} />
                      <span>
                        {sc.rating} ({sc.reviewCount} reviews)
                      </span>
                    </div>
                  </div>
                  {!isFixedPrice(category) && (
                    <div className="shrink-0 text-right">
                      <span className="font-cormorant font-light text-2xl text-ink">
                        &pound;{getServiceListedRate(sc, category).toFixed(2)}
                      </span>
                      <span className="font-jost font-light text-xs text-ink-3">/hr</span>
                      <p className="font-jost font-light text-[10px] text-ink-3 mt-0.5">
                        {SERVICE_RATE_LABELS[category]}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* When to book — cleaner's available slots */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                When would you like {selectedCleaner.name}?
              </h2>
              <p className="mt-2 font-jost font-light text-sm text-ink-3">
                Your clean is {effectiveHours} hours &middot; select a day and start time
              </p>

              {/* Day selector */}
              <div className="mt-5 flex flex-wrap gap-2.5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                  const available = selectedCleaner.availability.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        setSelectedDay(day);
                        setSelectedTime('');
                      }}
                      className={`rounded-full px-5 py-2.5 font-jost text-sm font-light ring-1 transition-all ${
                        selectedDay === day
                          ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                          : available
                            ? 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:text-ink hover:shadow-sm'
                            : 'bg-cream text-ink-3/30 ring-ink/[0.06] cursor-not-allowed'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Time slots for selected day */}
              {selectedDay && selectedCleaner.timeSlots[selectedDay] && (
                <div className="mt-6">
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Available times on {selectedDay}
                  </label>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedCleaner.timeSlots[selectedDay].map((slot) => {
                      const endTime = getEndTime(slot, effectiveHours);
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`rounded-lg px-4 py-3 text-left font-jost text-sm font-light ring-1 transition-all ${
                            isSelected
                              ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                              : 'bg-cream text-ink ring-ink/[0.06] hover:bg-cream-2 hover:shadow-sm'
                          }`}
                        >
                          {slot} &ndash; {endTime}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDay && !selectedCleaner.timeSlots[selectedDay] && (
                <p className="mt-5 font-jost text-sm font-light text-ink-3">
                  No time slots available on {selectedDay}.
                </p>
              )}
            </div>

            {/* Backup cleaner slider */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <BackupCleanerSlider
                cleaners={availableBackupCleaners}
                selectedIds={backupCleanerIds}
                onToggle={handleBackupToggle}
                maxSelections={3}
                autoAssign={autoAssignBackup}
                onAutoAssignChange={setAutoAssignBackup}
                serviceCategory={category}
                propertySize={rooms.bedrooms}
              />
            </div>

            {/* Escrow payment notice */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <div className="h-0.5 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5 rounded-t-xl bg-gradient-to-r from-ink via-gold to-teal" />
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-gold"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 1a1 1 0 100 2 1 1 0 000-2z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h4 className="font-cormorant text-lg font-light text-ink">
                    Payment Held in Escrow
                  </h4>
                  <p className="mt-1.5 font-jost text-sm font-light text-ink-2 leading-relaxed">
                    You will see a charge to your bank account for the booking summary shown above,
                    but the payment will be held securely in escrow.
                  </p>
                  {backupCleanerIds.length > 0 && (
                    <p className="mt-2 font-jost text-sm font-light text-ink-2 leading-relaxed">
                      In the event that your chosen cleaner does not accept the booking, one of your
                      selected backup cleaners will be used instead. Our system will either provide
                      a small refund or apply a small additional charge to your account to align
                      with the new cleaner&apos;s rate as shown in the booking summary.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 font-jost text-xs font-light text-gold">
                    <span>&#10003; Funds held safely</span>
                    <span>&#10003; Released after completion</span>
                    {backupCleanerIds.length > 0 && (
                      <span>&#10003; Auto-adjusted for backup rates</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Key access */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                How will the cleaner get in?
              </h2>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    { value: 'lockbox', label: 'Keybox' },
                    { value: 'key-under-mat', label: 'Key hidden' },
                    { value: 'i-will-be-home', label: 'Someone will be in' },
                    { value: 'with-concierge', label: 'Concierge' },
                  ] as { value: KeyAccess; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKeyAccess(opt.value)}
                    className={`rounded-lg px-4 py-3.5 text-left font-jost font-light text-sm ring-1 transition-all ${
                      keyAccess === opt.value
                        ? 'bg-gold/5 text-ink ring-2 ring-gold shadow-sm'
                        : 'bg-cream text-ink-2 ring-ink/[0.06] hover:bg-cream-2 hover:shadow-sm'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {(keyAccess === 'lockbox' || keyAccess === 'key-under-mat') && (
                <input
                  type="text"
                  value={keyAccessNote}
                  onChange={(e) => setKeyAccessNote(e.target.value)}
                  placeholder={
                    keyAccess === 'lockbox'
                      ? 'Lockbox code or location...'
                      : 'Where is the key hidden?'
                  }
                  className="mt-4 w-full rounded-lg bg-cream px-4 py-3 font-jost font-light text-sm text-ink ring-1 ring-ink/[0.06] transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              )}
            </div>

            {/* Special instructions */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8">
              <h2 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Special instructions
              </h2>
              <p className="mt-2 font-jost font-light text-sm text-ink-3">
                Anything the cleaner should know or be careful with?
              </p>
              <textarea
                rows={3}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. 'Dog is friendly but barks', 'Please be careful with the antique vase', 'Don't move items on the desk'..."
                className="mt-4 w-full rounded-lg bg-cream px-4 py-3 font-jost font-light text-sm text-ink ring-1 ring-ink/[0.06] transition-shadow focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
            </div>

            {/* Summary & submit */}
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-ink/[0.06] sm:p-8 space-y-4">
              <div className="h-0.5 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8 mb-5 rounded-t-xl bg-gradient-to-r from-ink via-gold to-teal" />
              <h3 className="font-cormorant text-xl font-light text-ink sm:text-2xl">
                Booking Summary
              </h3>
              <SummaryRow label="Service" value={serviceLabel} />
              <SummaryRow label="Postcode" value={postcode} />
              <SummaryRow
                label="Space"
                value={`${rooms.bedrooms} bed, ${rooms.bathrooms} bath, ${rooms.livingAreas} living${rooms.kitchen ? ', kitchen' : ''}${rooms.additionals.length > 0 ? `, +${rooms.additionals.length} more` : ''}`}
              />
              <SummaryRow label="Duration" value={`${effectiveHours} hours`} />
              <SummaryRow label="Frequency" value="One-off" />
              <SummaryRow
                label="Products"
                value={
                  cleanerBringsProducts
                    ? `Cleaner brings (+\u00A3${PRODUCT_FEE})`
                    : 'Customer provides'
                }
              />
              <SummaryRow label="Cleaner" value={selectedCleaner?.name ?? ''} />
              {selectedDay && selectedTime && (
                <SummaryRow
                  label="When"
                  value={`${selectedDay}, ${selectedTime} — ${getEndTime(selectedTime, effectiveHours)}`}
                />
              )}
              <SummaryRow
                label="Key access"
                value={
                  keyAccess === 'lockbox'
                    ? 'Keybox'
                    : keyAccess === 'key-under-mat'
                      ? keyAccessNote
                        ? keyAccessNote.charAt(0).toUpperCase() + keyAccessNote.slice(1)
                        : 'Key hidden'
                      : keyAccess === 'i-will-be-home'
                        ? 'Someone will be in'
                        : 'Concierge'
                }
              />

              <div className="pt-4 mt-4 space-y-3 border-t border-ink/[0.06]">
                {/* Hourly services only — fixed-price services have their own phase 2 */}
                <>
                  <div className="flex justify-between text-sm">
                    <span className="font-jost font-light text-ink-3">
                      Cleaning ({effectiveHours}h &times; &pound;{priceBreakdown.listedHourlyRate}
                      /hr)
                    </span>
                    <span className="font-jost font-normal text-ink">
                      &pound;{priceBreakdown.listedSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {productCost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="font-jost font-light text-ink-3">Cleaning products</span>
                      <span className="font-jost font-light text-ink">
                        &pound;{productCost.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="font-jost font-light text-ink-3">
                      Service fee ({SERVICE_FEE_PERCENT}%)
                    </span>
                    <span className="font-jost font-light text-ink">
                      &pound;{priceBreakdown.displayServiceFee.toFixed(2)}
                    </span>
                  </div>
                </>
                <div className="flex justify-between pt-3 border-t border-ink/[0.06]">
                  <span className="font-jost font-normal text-ink">Total</span>
                  <span className="font-cormorant font-light text-3xl text-ink">
                    &pound;
                    {(priceBreakdown.discountedTotal + productCost).toFixed(2)}
                  </span>
                </div>
                {isRegular && (
                  <p className="font-jost font-light text-xs text-ink-3">
                    Per clean. Cancel or pause your schedule anytime.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleBookingSubmit}
              disabled={!selectedDay || !selectedTime}
              className="w-full rounded-lg bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.15em] text-cream shadow-sm transition-all hover:bg-gold hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bookingSubmitting ? 'Processing...' : 'Confirm & Pay'}
            </button>
          </>
        )}
      </div>

      {/* ── Cleaner profile slide-out ── */}
      {profileCleaner && (
        <CleanerProfileSlideOut
          cleaner={profileCleaner}
          listedRate={getServiceListedRate(profileCleaner, category)}
          rateLabel={SERVICE_RATE_LABELS[category]}
          effectiveHours={effectiveHours}
          onClose={() => setProfileCleaner(null)}
          onBook={() => {
            setSelectedCleanerIds([profileCleaner.id]);
            setProfileCleaner(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function CleanerProfileSlideOut({
  cleaner,
  listedRate,
  rateLabel,
  effectiveHours,
  onClose,
  onBook,
}: {
  cleaner: Cleaner;
  listedRate: number;
  rateLabel: string;
  effectiveHours: number;
  onClose: () => void;
  onBook: () => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const tier = TIER_INFO[cleaner.tier];

  useEffect(() => {
    fetch(`/api/cleaners/${cleaner.id}/reviews`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setReviews)
      .catch(() => setReviews([]));
  }, [cleaner.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="relative z-10 mx-4 mt-8 mb-8 max-h-[calc(100vh-64px)] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:mx-6 md:mt-12">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center text-ink-3 transition-colors hover:text-ink"
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-cream px-6 py-8">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white font-cormorant text-[26px] font-semibold text-ink ring-1 ring-ink/[0.06]">
              {cleaner.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-cormorant text-[24px] font-semibold leading-tight text-ink">
                  {cleaner.name}
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ring-1 ring-ink/[0.06] ${tier.color}`}
                >
                  {tier.label}
                </span>
                <VerificationBadge
                  identityVerified={cleaner.identityVerified}
                  backgroundChecked={cleaner.backgroundChecked}
                  size="md"
                />
              </div>
              <p className="mt-1 font-jost text-[13px] font-light text-ink-3">{cleaner.location}</p>
              <div className="mt-2 flex items-center gap-2">
                <StarRating rating={cleaner.rating} />
                <span className="font-jost text-[13px] font-light text-ink-2">
                  {cleaner.rating} ({cleaner.reviewCount} reviews)
                </span>
              </div>
              {cleaner.availableNow && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                  </span>
                  <span className="font-jost text-[12px] font-medium text-teal">
                    Available today &middot; responds in {cleaner.responseTime}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Price + Book now */}
          <div className="mt-6 flex items-end justify-between">
            <div>
              <span className="font-cormorant text-[28px] font-semibold text-ink">
                &pound;{listedRate.toFixed(2)}
              </span>
              <span className="font-jost text-[13px] font-light text-ink-3">/hr</span>
              <span className="ml-3 font-jost text-[13px] font-light text-ink-3">
                &pound;{(listedRate * effectiveHours).toFixed(2)} for {effectiveHours}h
              </span>
              <p className="font-jost font-light text-[11px] text-ink-3 mt-0.5">{rateLabel}</p>
            </div>
            <button
              type="button"
              onClick={onBook}
              className="bg-ink px-6 py-2.5 font-jost text-[13px] font-medium text-cream transition-opacity hover:opacity-90"
            >
              Book now
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8">
          {/* Bio */}
          <p className="font-jost text-[14px] font-light leading-relaxed text-ink-2">
            {cleaner.bio}
          </p>

          {/* Specialties */}
          <div className="mt-5 flex flex-wrap gap-2">
            {cleaner.specialties.map((s) => (
              <span
                key={s}
                className="rounded-full bg-cream px-3 py-1 font-jost text-[12px] font-medium text-ink-2"
              >
                {s}
              </span>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: `${cleaner.yearsExperience}`, label: 'Years exp.' },
              { value: `${cleaner.completedJobs}`, label: 'Jobs done' },
              { value: `${cleaner.rating}`, label: 'Avg rating' },
              { value: cleaner.responseTime, label: 'Response' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-cormorant text-[22px] font-semibold text-ink">
                  {stat.value}
                </div>
                <div className="font-jost text-[11px] font-light text-ink-3">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Detailed ratings */}
          <div className="mt-8">
            <h3 className="font-cormorant text-[18px] font-semibold text-ink">Ratings</h3>
            <div className="mt-4 space-y-3">
              {[
                { label: 'Thoroughness', value: cleaner.categoryRatings.thoroughness },
                { label: 'Punctuality', value: cleaner.categoryRatings.punctuality },
                { label: 'Communication', value: cleaner.categoryRatings.communication },
                { label: 'Value', value: cleaner.categoryRatings.value },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="w-28 font-jost text-[13px] font-light text-ink-2">
                    {r.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-2">
                    <div
                      className="h-full rounded-full bg-ink"
                      style={{ width: `${(r.value / 5) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-jost text-[13px] font-medium text-ink">
                    {r.value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="mt-8">
            <h3 className="font-cormorant text-[18px] font-semibold text-ink">Availability</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <span
                  key={day}
                  className={`rounded-full px-3.5 py-1.5 font-jost text-[12px] font-medium ${
                    cleaner.availability.includes(day) ? 'bg-ink text-cream' : 'bg-cream text-ink-3'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>
          </div>

          {/* Languages */}
          {cleaner.languages.length > 0 && (
            <div className="mt-6">
              <h3 className="font-cormorant text-[18px] font-semibold text-ink">Languages</h3>
              <p className="mt-2 font-jost text-[13px] font-light text-ink-2">
                {cleaner.languages.join(', ')}
              </p>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div className="mt-8">
              <h3 className="font-cormorant text-[18px] font-semibold text-ink">
                Reviews ({reviews.length})
              </h3>
              <div className="mt-4 space-y-4">
                {reviews.slice(0, 4).map((review) => (
                  <div key={review.id} className="border-t border-ink/5 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-jost text-[13px] font-medium text-ink">
                          {review.customerName}
                        </span>
                        {review.verified && (
                          <span className="rounded-full bg-cream px-2 py-0.5 font-jost text-[10px] font-medium text-teal">
                            Verified
                          </span>
                        )}
                      </div>
                      <span className="font-jost text-[11px] font-light text-ink-3">
                        {review.date}
                      </span>
                    </div>
                    <div className="mt-1">
                      <StarRating rating={review.rating} />
                    </div>
                    <p className="mt-2 font-jost text-[13px] font-light leading-relaxed text-ink-2">
                      {review.comment}
                    </p>
                    {review.cleanerReply && (
                      <div className="mt-3 rounded-md bg-cream px-4 py-3">
                        <p className="font-jost text-[12px] font-medium text-ink">
                          {cleaner.name} replied
                        </p>
                        <p className="mt-1 font-jost text-[12px] font-light text-ink-2">
                          {review.cleanerReply}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom book button */}
          <div className="mt-8 border-t border-ink/5 pt-6">
            <button
              type="button"
              onClick={onBook}
              className="w-full bg-ink py-3.5 font-jost text-[12px] uppercase tracking-[0.1em] text-cream transition hover:bg-gold"
            >
              Book {cleaner.name} &middot; &pound;{listedRate.toFixed(2)}/hr
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-cream px-5 py-4 ring-1 ring-ink/[0.06]">
      <span className="font-jost font-light text-ink-2">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-ink/[0.06] transition-all hover:bg-ink hover:text-cream hover:shadow-md disabled:opacity-30"
        >
          -
        </button>
        <span className="w-8 text-center font-cormorant text-xl font-light text-ink">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink-2 shadow-sm ring-1 ring-ink/[0.06] transition-all hover:bg-ink hover:text-cream hover:shadow-md disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="font-jost font-light text-ink-3">{label}</span>
      <span className="font-jost font-normal text-ink text-right max-w-[60%]">{value}</span>
    </div>
  );
}
