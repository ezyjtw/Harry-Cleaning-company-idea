'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useMemo, useEffect, useCallback } from 'react';

import StarRating from '@/components/StarRating';
import VerificationBadge from '@/components/VerificationBadge';
import { cleaners, getCleanerById, getReviewsForCleaner } from '@/lib/mock-data';
import { getPriceBreakdown, getListedRate } from '@/lib/pricing';
import type {
  ServiceCategory,
  BookingFrequency,
  KeyAccess,
  RoomConfig,
  Cleaner,
} from '@/lib/types';

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

const SERVICE_MULTIPLIERS: Record<ServiceCategory, number> = {
  regular: 1.1,
  'same-day': 1.2,
  deep: 1.5,
  airbnb: 1.1,
  'end-of-tenancy': 2,
};

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

const TIER_INFO = {
  standard: { label: 'Standard', color: 'bg-cream-2 text-ink-2', desc: 'Reliable and affordable' },
  premium: { label: 'Premium', color: 'bg-cream-2 text-ink', desc: 'Experienced & highly rated' },
  elite: { label: 'Elite', color: 'bg-cream-2 text-gold', desc: 'Top-tier, best of the best' },
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

  // Check if a cleaner was pre-selected (coming from /book/[id] service selection)
  const searchParams = useSearchParams();
  const preSelectedCleanerId = searchParams.get('cleaner') ?? '';
  const preSelectedCleaner = preSelectedCleanerId ? getCleanerById(preSelectedCleanerId) : null;

  // Phase: "quote" = first page (postcode, rooms, hours, products, frequency, email)
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
  const [frequency, setFrequency] = useState<BookingFrequency>('weekly');
  const [email, setEmail] = useState('');
  const [joinMailingList, setJoinMailingList] = useState(false);

  // ─── Cleaner phase state ───────────────────────
  const [scheduling, setScheduling] = useState<'flexible' | 'set-time' | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedCleanerId, setSelectedCleanerId] = useState(preSelectedCleanerId);
  const [profileCleaner, setProfileCleaner] = useState<Cleaner | null>(null);
  const [acceptSubstitute, setAcceptSubstitute] = useState(true);
  const [keyAccess, setKeyAccess] = useState<KeyAccess>('i-will-be-home');
  const [keyAccessNote, setKeyAccessNote] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [submitted, setSubmitted] = useState(false);

  const selectedCleaner = cleaners.find((c) => c.id === selectedCleanerId);

  // ─── Step-by-step back navigation ────────────────────
  // Determines which "step" the user is on for back-button behaviour
  const currentStep = useMemo(() => {
    if (submitted) return 'submitted';
    if (phase === 'quote') return 'quote';
    if (selectedCleanerId) return 'booking';
    if (scheduling === 'flexible') return 'browse';
    if (scheduling === 'set-time' && selectedTime) return 'set-time-results';
    if (scheduling === 'set-time') return 'set-time';
    return 'choose-method';
  }, [phase, scheduling, selectedCleanerId, selectedTime, submitted]);

  const goBack = useCallback(() => {
    if (profileCleaner) {
      setProfileCleaner(null);
      return;
    }
    switch (currentStep) {
      case 'booking':
        setSelectedCleanerId('');
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

  const frequencyDiscount = isRegular
    ? frequency === 'weekly'
      ? 0.1
      : frequency === 'biweekly'
        ? 0.05
        : 0
    : 0;

  const priceBreakdown = useMemo(() => {
    const rawRate = preSelectedCleaner?.hourlyRate ?? selectedCleaner?.hourlyRate ?? 18;
    const listedHourlyRate = getListedRate(rawRate);
    const multiplier = SERVICE_MULTIPLIERS[category] ?? 1;
    const breakdown = getPriceBreakdown(rawRate, effectiveHours, multiplier);
    const discount = breakdown.listedSubtotal * frequencyDiscount;
    const cleaningSubtotal = Math.round((breakdown.listedSubtotal - discount) * 100) / 100;
    const serviceFee = Math.round(cleaningSubtotal * 0.05 * 100) / 100;
    return {
      ...breakdown,
      listedHourlyRate,
      discount: Math.round(discount * 100) / 100,
      cleaningSubtotal,
      displayServiceFee: serviceFee,
      discountedTotal: Math.round((cleaningSubtotal + serviceFee) * 100) / 100,
    };
  }, [preSelectedCleaner, selectedCleaner, effectiveHours, category, frequencyDiscount]);

  const productCost = cleanerBringsProducts ? PRODUCT_FEE : 0;

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
  }, [scheduling, selectedDay, selectedTime]);

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
  }, [selectedDay]);

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
  }, [selectedDay, availableTimeSlotsForDay]);

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center bg-cream min-h-screen">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center bg-cream-2 text-3xl text-gold"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          &#10003;
        </div>
        <h1 className="mt-8 font-cormorant font-light text-3xl text-ink">Booking Request Sent</h1>
        <p className="mt-5 font-jost font-light text-ink-2">
          We&apos;ve sent your {serviceLabel.toLowerCase()} request
          {selectedCleaner ? ` to ${selectedCleaner.name}` : ''}. You&apos;ll receive a confirmation
          at <span className="font-normal text-ink">{email}</span>.
        </p>
        {joinMailingList && (
          <p className="mt-3 font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
            You&apos;ve been added to our mailing list for tips and offers.
          </p>
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
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink transition"
          >
            &larr; Back
          </Link>
          <h1 className="font-cormorant font-light text-2xl text-ink sm:text-3xl">
            {serviceLabel}
          </h1>
        </div>

        <div className="mt-10 space-y-10">
          {/* Postcode */}
          <div>
            <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Your postcode
            </label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. SW1A 1AA"
              className="mt-3 w-full bg-cream px-4 py-3.5 font-jost font-light text-lg text-ink focus:outline-none"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            />
          </div>

          {/* Rooms */}
          <div>
            <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              How many rooms?
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

          {/* Hours */}
          <div>
            <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              How many hours?
            </h2>
            <div
              className="mt-3 bg-cream-2 p-5"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <p className="font-jost font-light text-sm text-ink-2">
                We recommend <span className="font-normal text-ink">{suggestedHours} hours</span>{' '}
                for your {rooms.bedrooms} bedroom, {rooms.bathrooms} bathroom home.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSelectedHours(h)}
                  className={`px-4 py-2.5 font-jost text-sm font-light transition ${
                    effectiveHours === h
                      ? 'bg-ink text-cream'
                      : 'bg-cream-2 text-ink-2 hover:bg-cream hover:text-ink'
                  }`}
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  {h}h
                </button>
              ))}
            </div>

            {isUnderSuggested && (
              <div
                className="mt-4 bg-cream-2 p-5"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <p className="font-jost font-light text-sm text-ink-2">
                  You&apos;ve selected fewer hours than recommended. Leave a note for the cleaner so
                  they know where to focus:
                </p>
                <textarea
                  rows={2}
                  value={cleanerNote}
                  onChange={(e) => setCleanerNote(e.target.value)}
                  placeholder="e.g. Please focus on the kitchen and bathrooms..."
                  className="mt-3 w-full bg-cream px-3 py-2.5 font-jost font-light text-sm text-ink focus:outline-none"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                />
              </div>
            )}
          </div>

          {/* Products */}
          <div className="p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Cleaning products
            </h2>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setCleanerBringsProducts(false)}
                className={`flex-1 p-4 text-left transition ${
                  !cleanerBringsProducts ? 'bg-ink text-cream' : 'bg-cream'
                }`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <p
                  className={`font-jost font-normal text-sm ${!cleanerBringsProducts ? 'text-cream' : 'text-ink'}`}
                >
                  I&apos;ll provide products
                </p>
                <p
                  className={`mt-1 font-jost text-[11px] uppercase tracking-[0.1em] ${!cleanerBringsProducts ? 'text-cream/60' : 'text-ink-3'}`}
                >
                  No extra cost
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCleanerBringsProducts(true)}
                className={`flex-1 p-4 text-left transition ${
                  cleanerBringsProducts ? 'bg-ink text-cream' : 'bg-cream'
                }`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <p
                  className={`font-jost font-normal text-sm ${cleanerBringsProducts ? 'text-cream' : 'text-ink'}`}
                >
                  Cleaner brings products
                </p>
                <p
                  className={`mt-1 font-jost text-[11px] uppercase tracking-[0.1em] ${cleanerBringsProducts ? 'text-cream/60' : 'text-ink-3'}`}
                >
                  Additional &pound;5 charge
                </p>
              </button>
            </div>
          </div>

          {/* Frequency — only shown for Regular Cleaning */}
          {isRegular && (
            <div className="p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                How often?
              </h2>
              <p className="mt-2 font-jost font-light text-xs text-gold">
                Save with a regular schedule — weekly cleans get the best rate.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { value: 'weekly' as BookingFrequency, label: 'Weekly', tag: 'Save 10%' },
                    { value: 'biweekly' as BookingFrequency, label: 'Fortnightly', tag: 'Save 5%' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={`p-4 text-center transition ${
                      frequency === opt.value ? 'bg-ink text-cream' : 'bg-cream hover:bg-cream-2'
                    }`}
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    <p
                      className={`font-jost font-normal text-sm ${frequency === opt.value ? 'text-cream' : 'text-ink'}`}
                    >
                      {opt.label}
                    </p>
                    {opt.tag && (
                      <p
                        className={`mt-1 font-jost text-[11px] uppercase tracking-[0.1em] ${frequency === opt.value ? 'text-cream/60' : 'text-gold'}`}
                      >
                        {opt.tag}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-3 w-full bg-cream px-4 py-3.5 font-jost font-light text-ink focus:outline-none"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            />
            <label className="mt-4 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={joinMailingList}
                onChange={(e) => setJoinMailingList(e.target.checked)}
                className="h-4 w-4 border-ink-3 text-ink focus:ring-0"
              />
              <span className="font-jost font-light text-sm text-ink-2">
                Tick here to recieve promotional offers
              </span>
            </label>
          </div>

          {/* Price display */}
          <div className="bg-cream-2 p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  {preSelectedCleaner ? 'Your price' : 'Guide price'}
                </span>
                <p className="mt-1 font-jost font-light text-xs text-ink-3">
                  {preSelectedCleaner
                    ? `${preSelectedCleaner.name} — \u00A3${getListedRate(preSelectedCleaner.hourlyRate).toFixed(2)}/hr`
                    : 'Starting at \u00A318/hr'}
                </p>
              </div>
              <div className="text-right">
                <span className="font-cormorant font-light text-3xl text-ink">
                  &pound;{priceBreakdown.discountedTotal.toFixed(2)}
                </span>
                {productCost > 0 && (
                  <span className="ml-2 font-jost font-light text-xs text-ink-3">
                    + &pound;{productCost} products
                  </span>
                )}
              </div>
            </div>
            {frequencyDiscount > 0 && (
              <p className="mt-2 font-jost font-light text-xs text-gold text-right">
                {frequency === 'weekly' ? 'Weekly' : 'Fortnightly'} discount applied (-&pound;
                {priceBreakdown.discount.toFixed(2)})
              </p>
            )}
            {!preSelectedCleaner && (
              <p className="mt-3 font-jost font-light text-xs text-ink-3">
                Final price depends on your chosen cleaner&apos;s rate. No hidden charges.
              </p>
            )}
            {preSelectedCleaner && (
              <p className="mt-3 font-jost font-light text-xs text-ink-3">
                No hidden charges, ever.
              </p>
            )}
          </div>

          {/* Continue */}
          <button
            type="button"
            onClick={() => setPhase('cleaner')}
            disabled={!postcode || !email}
            className="w-full bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.1em] text-cream hover:bg-gold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ─── PHASE 2: Cleaner selection / Time slot picker ────────────────

  // When cleaner is pre-selected, show time slot picker directly
  if (preSelectedCleaner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setPhase('quote')}
            className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink transition"
          >
            &larr; Back to quote
          </button>
          <h1 className="font-cormorant font-light text-2xl text-ink">Choose a Time</h1>
        </div>

        {/* Cleaner summary */}
        <div
          className="mt-8 flex items-center gap-4 p-5"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2 text-xl font-light text-ink font-cormorant"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            {preSelectedCleaner.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-jost font-normal text-ink">{preSelectedCleaner.name}</span>
              <span
                className={`px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${TIER_INFO[preSelectedCleaner.tier].color}`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
              <span>&pound;{getListedRate(preSelectedCleaner.hourlyRate).toFixed(2)}/hr</span>
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-10">
          {/* Day selection from cleaner's availability */}
          <div>
            <h2 className="font-cormorant font-light text-lg text-ink">Pick a day</h2>
            <p className="mt-2 font-jost font-light text-xs text-ink-3">
              {preSelectedCleaner.name} is available on the following days.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {preSelectedCleaner.availability.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setSelectedTime('');
                  }}
                  className={`px-5 py-3 font-jost text-sm font-light transition ${
                    selectedDay === day
                      ? 'bg-ink text-cream'
                      : 'bg-cream-2 text-ink-2 hover:bg-cream hover:text-ink'
                  }`}
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time slot selection — from cleaner's actual availability */}
          {selectedDay && (
            <div>
              <h2 className="font-cormorant font-light text-lg text-ink">Pick a time</h2>
              <p className="mt-2 font-jost font-light text-xs text-ink-3">
                {preSelectedCleaner.name}&apos;s available start times on {selectedDay}s.
              </p>
              {(preSelectedCleaner.timeSlots[selectedDay] ?? []).length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(preSelectedCleaner.timeSlots[selectedDay] ?? []).map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`px-4 py-3 font-jost text-sm font-light transition ${
                        selectedTime === slot
                          ? 'bg-ink text-cream'
                          : 'bg-cream-2 text-ink-2 hover:bg-cream hover:text-ink'
                      }`}
                      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 font-jost text-sm font-light text-ink-3">
                  No available slots on this day. Please try another day.
                </p>
              )}
            </div>
          )}

          {/* Substitute preference */}
          {selectedDay && selectedTime && (
            <label
              className="flex items-start gap-4 bg-cream-2 p-5 cursor-pointer"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <input
                type="checkbox"
                checked={acceptSubstitute}
                onChange={(e) => setAcceptSubstitute(e.target.checked)}
                className="mt-0.5 h-5 w-5 border-ink-3 text-ink focus:ring-0"
              />
              <div>
                <p className="font-jost font-normal text-sm text-ink">
                  Happy with a substitute cleaner?
                </p>
                <p className="mt-1 font-jost font-light text-xs text-ink-3">
                  If {preSelectedCleaner.name} cancels, we&apos;ll match you with another cleaner of
                  the same rating ({preSelectedCleaner.rating}).
                </p>
              </div>
            </label>
          )}

          {/* Key access */}
          <div className="p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              How will the cleaner get in?
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
                  className={`px-4 py-3.5 text-left font-jost font-light text-sm transition ${
                    keyAccess === opt.value
                      ? 'bg-ink text-cream'
                      : 'bg-cream text-ink-2 hover:bg-cream-2'
                  }`}
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                className="mt-4 w-full bg-cream px-3 py-2.5 font-jost font-light text-sm text-ink focus:outline-none"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
            )}
          </div>

          {/* Special instructions */}
          <div>
            <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              Anything the cleaner should know or be careful with?
            </label>
            <textarea
              rows={3}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. 'Dog is friendly but barks', 'Please be careful with the antique vase', 'Don't move items on the desk'..."
              className="mt-3 w-full bg-cream px-3 py-2.5 font-jost font-light text-sm text-ink focus:outline-none"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            />
          </div>

          {/* Summary & submit */}
          <div
            className="bg-cream-2 p-6 space-y-4"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <h3 className="font-cormorant font-light text-lg text-ink">Booking Summary</h3>
            <SummaryRow label="Service" value={serviceLabel} />
            <SummaryRow label="Postcode" value={postcode} />
            <SummaryRow
              label="Space"
              value={`${rooms.bedrooms} bed, ${rooms.bathrooms} bath, ${rooms.livingAreas} living${rooms.kitchen ? ', kitchen' : ''}${rooms.additionals.length > 0 ? `, +${rooms.additionals.length} more` : ''}`}
            />
            <SummaryRow label="Duration" value={`${effectiveHours} hours`} />
            <SummaryRow
              label="Frequency"
              value={frequency === 'weekly' ? 'Weekly (10% off)' : 'Fortnightly (5% off)'}
            />
            <SummaryRow
              label="Products"
              value={
                cleanerBringsProducts
                  ? `Cleaner brings (+\u00A3${PRODUCT_FEE})`
                  : 'Customer provides'
              }
            />
            <SummaryRow
              label="Cleaner"
              value={`${preSelectedCleaner.name} (${TIER_INFO[preSelectedCleaner.tier].label}) — \u00A3${priceBreakdown.listedHourlyRate}/hr`}
            />
            {selectedDay && <SummaryRow label="Day" value={selectedDay} />}
            {selectedTime && <SummaryRow label="Time" value={selectedTime} />}
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

            <div
              className="pt-4 mt-4 space-y-3"
              style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <div className="flex justify-between text-sm">
                <span className="font-jost font-light text-ink-3">
                  Cleaning ({effectiveHours}h)
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
              {priceBreakdown.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-jost font-normal text-gold">
                    {frequency === 'weekly' ? 'Weekly' : 'Fortnightly'} discount
                  </span>
                  <span className="font-jost font-normal text-gold">
                    -&pound;{priceBreakdown.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="font-jost font-light text-ink-3">Service fee (5%)</span>
                <span className="font-jost font-light text-ink">
                  &pound;{priceBreakdown.displayServiceFee.toFixed(2)}
                </span>
              </div>
              <div
                className="flex justify-between pt-3"
                style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}
              >
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
            onClick={() => setSubmitted(true)}
            disabled={!selectedDay || !selectedTime}
            className="w-full bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.1em] text-cream hover:bg-gold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Booking Request
          </button>
        </div>
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
                        setSelectedCleanerId('');
                        setSelectedDay('');
                        setSelectedTime('');
                      } else if (step.key === 'browse' || step.key === 'set-time') {
                        setSelectedCleanerId('');
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
        {scheduling === null && !selectedCleanerId && (
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
        {scheduling === 'flexible' && !selectedCleanerId && (
          <div>
            {/* Tier legend */}
            <div className="mt-6 flex flex-wrap gap-3">
              {(['elite', 'premium', 'standard'] as const).map((tier) => (
                <span
                  key={tier}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-jost text-[11px] uppercase tracking-[0.1em] ${TIER_INFO[tier].color}`}
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  {TIER_INFO[tier].label}
                </span>
              ))}
            </div>

            {/* Cleaner grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {cleaners.map((c) => {
                const tier = TIER_INFO[c.tier];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setProfileCleaner(c)}
                    className="group bg-cream p-5 text-left transition hover:bg-cream-2"
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center bg-cream-2 group-hover:bg-cream text-lg font-light text-ink font-cormorant transition"
                        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-jost font-normal text-sm text-ink">{c.name}</span>
                          <span
                            className={`px-1.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${tier.color}`}
                            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                          &pound;{getListedRate(c.hourlyRate).toFixed(2)}
                        </span>
                        <span className="font-jost font-light text-[11px] text-ink-3">/hr</span>
                      </div>
                    </div>
                    <p className="mt-3 font-jost font-light text-xs text-ink-3 line-clamp-2">
                      {c.bio}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.specialties.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="bg-cream-2 px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.05em] text-ink-3"
                          style={{ border: '0.5px solid rgba(14,14,12,0.06)' }}
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
        {scheduling === 'set-time' && !selectedCleanerId && (
          <div>
            <div className="space-y-6">
              {/* Day selector */}
              <div>
                <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                  Day
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
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
                        className={`px-4 py-2.5 font-jost text-sm font-light transition ${
                          selectedDay === day
                            ? 'bg-ink text-cream'
                            : hasCleaners
                              ? 'bg-cream-2 text-ink-2 hover:bg-cream hover:text-ink'
                              : 'bg-cream-2 text-ink-3/30 cursor-not-allowed'
                        }`}
                        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots with cleaner counts */}
              {selectedDay && (
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Available time slots on {selectedDay}
                  </label>
                  {availableTimeSlotsForDay.length > 0 ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {availableTimeSlotsForDay.map((slot) => {
                        const endTime = getEndTime(slot, effectiveHours);
                        const count = cleanerCountsPerSlot[slot] || 0;
                        const isSelected = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedTime(slot)}
                            className={`flex items-center justify-between px-4 py-3.5 text-left transition ${
                              isSelected
                                ? 'bg-ink text-cream'
                                : 'bg-cream text-ink hover:bg-cream-2'
                            }`}
                            style={{
                              border: isSelected
                                ? '1px solid #1B2A4A'
                                : '0.5px solid rgba(14,14,12,0.1)',
                            }}
                          >
                            <div>
                              <span className="font-jost text-sm font-normal">
                                {slot} &ndash; {endTime}
                              </span>
                            </div>
                            <span
                              className={`font-jost text-xs font-light ${isSelected ? 'text-cream/70' : 'text-ink-3'}`}
                            >
                              {count} cleaner{count !== 1 ? 's' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 font-jost text-sm font-light text-ink-3">
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
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setProfileCleaner(c)}
                            className="group bg-cream p-5 text-left transition hover:bg-cream-2"
                            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                          >
                            <div className="flex items-start gap-3.5">
                              <div
                                className="flex h-12 w-12 shrink-0 items-center justify-center bg-cream-2 group-hover:bg-cream text-lg font-light text-ink font-cormorant transition"
                                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                              >
                                {c.name.charAt(0)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-jost font-normal text-sm text-ink">
                                    {c.name}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${tier.color}`}
                                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                                  &pound;{getListedRate(c.hourlyRate).toFixed(2)}
                                </span>
                                <span className="font-jost font-light text-[11px] text-ink-3">
                                  /hr
                                </span>
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
                    <div
                      className="mt-3 bg-cream-2 p-6 text-center"
                      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                    >
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
        {selectedCleanerId && selectedCleaner && (
          <>
            {/* Selected cleaner header */}
            <div>
              {/* Cleaner info card */}
              <div
                className="flex items-start gap-4 bg-cream p-5"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2 text-xl font-light text-ink font-cormorant"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  {selectedCleaner.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-jost font-normal text-ink">{selectedCleaner.name}</span>
                    <span
                      className={`px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${TIER_INFO[selectedCleaner.tier].color}`}
                      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                    >
                      {TIER_INFO[selectedCleaner.tier].label}
                    </span>
                    <VerificationBadge
                      identityVerified={selectedCleaner.identityVerified}
                      backgroundChecked={selectedCleaner.backgroundChecked}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 font-jost font-light text-sm text-ink-3">
                    <StarRating rating={selectedCleaner.rating} />
                    <span>
                      {selectedCleaner.rating} ({selectedCleaner.reviewCount} reviews)
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-cormorant font-light text-2xl text-ink">
                    &pound;{priceBreakdown.listedHourlyRate}
                  </span>
                  <span className="font-jost font-light text-xs text-ink-3">/hr</span>
                </div>
              </div>
            </div>

            {/* When to book — cleaner's available slots */}
            <div className="p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                When would you like {selectedCleaner.name}?
              </h2>
              <p className="mt-1.5 font-jost font-light text-xs text-ink-3">
                Your clean is {effectiveHours} hours &middot; select a day and start time
              </p>

              {/* Day selector */}
              <div className="mt-4 flex flex-wrap gap-2">
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
                      className={`px-4 py-2.5 font-jost text-sm font-light transition ${
                        selectedDay === day
                          ? 'bg-ink text-cream'
                          : available
                            ? 'bg-cream-2 text-ink-2 hover:bg-cream hover:text-ink'
                            : 'bg-cream-2 text-ink-3/30 cursor-not-allowed'
                      }`}
                      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Time slots for selected day */}
              {selectedDay && selectedCleaner.timeSlots[selectedDay] && (
                <div className="mt-5">
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Available times on {selectedDay}
                  </label>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedCleaner.timeSlots[selectedDay].map((slot) => {
                      const endTime = getEndTime(slot, effectiveHours);
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`px-4 py-3 text-left font-jost text-sm font-light transition ${
                            isSelected ? 'bg-ink text-cream' : 'bg-cream text-ink hover:bg-cream-2'
                          }`}
                          style={{
                            border: isSelected
                              ? '1px solid #1B2A4A'
                              : '0.5px solid rgba(14,14,12,0.1)',
                          }}
                        >
                          {slot} &ndash; {endTime}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedDay && !selectedCleaner.timeSlots[selectedDay] && (
                <p className="mt-4 font-jost text-sm font-light text-ink-3">
                  No time slots available on {selectedDay}.
                </p>
              )}
            </div>

            {/* Substitute cleaner */}
            <label
              className="flex items-start gap-4 bg-cream-2 p-5 cursor-pointer"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <input
                type="checkbox"
                checked={acceptSubstitute}
                onChange={(e) => setAcceptSubstitute(e.target.checked)}
                className="mt-0.5 h-5 w-5 border-ink-3 text-ink focus:ring-0"
              />
              <div>
                <p className="font-jost font-normal text-sm text-ink">
                  Happy with a substitute cleaner?
                </p>
                <p className="mt-1 font-jost font-light text-xs text-ink-3">
                  If {selectedCleaner.name} cancels, we&apos;ll match you with another cleaner of
                  the same rating ({selectedCleaner.rating}).
                </p>
              </div>
            </label>

            {/* Key access */}
            <div className="p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
              <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                How will the cleaner get in?
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
                    className={`px-4 py-3.5 text-left font-jost font-light text-sm transition ${
                      keyAccess === opt.value
                        ? 'bg-ink text-cream'
                        : 'bg-cream text-ink-2 hover:bg-cream-2'
                    }`}
                    style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                  className="mt-4 w-full bg-cream px-3 py-2.5 font-jost font-light text-sm text-ink focus:outline-none"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                />
              )}
            </div>

            {/* Special instructions */}
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                Anything the cleaner should know or be careful with?
              </label>
              <textarea
                rows={3}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. 'Dog is friendly but barks', 'Please be careful with the antique vase', 'Don't move items on the desk'..."
                className="mt-3 w-full bg-cream px-3 py-2.5 font-jost font-light text-sm text-ink focus:outline-none"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              />
            </div>

            {/* Summary & submit */}
            <div
              className="bg-cream-2 p-6 space-y-4"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <h3 className="font-cormorant font-light text-lg text-ink">Booking Summary</h3>
              <SummaryRow label="Service" value={serviceLabel} />
              <SummaryRow label="Postcode" value={postcode} />
              <SummaryRow
                label="Space"
                value={`${rooms.bedrooms} bed, ${rooms.bathrooms} bath, ${rooms.livingAreas} living${rooms.kitchen ? ', kitchen' : ''}${rooms.additionals.length > 0 ? `, +${rooms.additionals.length} more` : ''}`}
              />
              <SummaryRow label="Duration" value={`${effectiveHours} hours`} />
              <SummaryRow
                label="Frequency"
                value={
                  frequency === 'weekly'
                    ? 'Weekly (10% off)'
                    : frequency === 'biweekly'
                      ? 'Fortnightly (5% off)'
                      : 'One-off'
                }
              />
              <SummaryRow
                label="Products"
                value={
                  cleanerBringsProducts
                    ? `Cleaner brings (+\u00A3${PRODUCT_FEE})`
                    : 'Customer provides'
                }
              />
              <SummaryRow
                label="Cleaner"
                value={`${selectedCleaner.name} (${TIER_INFO[selectedCleaner.tier].label}) — \u00A3${priceBreakdown.listedHourlyRate}/hr`}
              />
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

              <div
                className="pt-4 mt-4 space-y-3"
                style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div className="flex justify-between text-sm">
                  <span className="font-jost font-light text-ink-3">
                    Cleaning ({effectiveHours}h &times; &pound;{priceBreakdown.listedHourlyRate}/hr)
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
                {priceBreakdown.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-jost font-normal text-gold">
                      {frequency === 'weekly' ? 'Weekly' : 'Fortnightly'} discount
                    </span>
                    <span className="font-jost font-normal text-gold">
                      -&pound;{priceBreakdown.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="font-jost font-light text-ink-3">Service fee (5%)</span>
                  <span className="font-jost font-light text-ink">
                    &pound;{priceBreakdown.displayServiceFee.toFixed(2)}
                  </span>
                </div>
                <div
                  className="flex justify-between pt-3"
                  style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}
                >
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
              onClick={() => setSubmitted(true)}
              disabled={!selectedDay || !selectedTime}
              className="w-full bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.1em] text-cream hover:bg-gold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Booking Request
            </button>
          </>
        )}
      </div>

      {/* ── Cleaner profile slide-out ── */}
      {profileCleaner && (
        <CleanerProfileSlideOut
          cleaner={profileCleaner}
          listedRate={getListedRate(profileCleaner.hourlyRate)}
          effectiveHours={effectiveHours}
          onClose={() => setProfileCleaner(null)}
          onBook={() => {
            setSelectedCleanerId(profileCleaner.id);
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
  effectiveHours,
  onClose,
  onBook,
}: {
  cleaner: Cleaner;
  listedRate: number;
  effectiveHours: number;
  onClose: () => void;
  onBook: () => void;
}) {
  const reviews = getReviewsForCleaner(cleaner.id);
  const tier = TIER_INFO[cleaner.tier];

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
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center bg-white font-cormorant text-[26px] font-semibold text-ink"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              {cleaner.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-cormorant text-[24px] font-semibold leading-tight text-ink">
                  {cleaner.name}
                </h2>
                <span
                  className={`px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${tier.color}`}
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
    <div
      className="flex items-center justify-between bg-cream px-5 py-4"
      style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
    >
      <span className="font-jost font-light text-ink-2">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center bg-cream-2 text-ink-2 hover:bg-ink hover:text-cream transition disabled:opacity-30"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          -
        </button>
        <span className="w-6 text-center font-jost font-normal text-lg text-ink">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center bg-cream-2 text-ink-2 hover:bg-ink hover:text-cream transition disabled:opacity-30"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
