'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useMemo } from 'react';

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

const SERVICE_LABELS: Record<ServiceCategory, string> = {
  regular: 'Regular Cleaning',
  'one-off': 'One-Off Cleaning',
  'same-day': 'Same Day Cleaning',
  deep: 'Deep Cleaning',
  airbnb: 'AirBnB Cleaning',
  'end-of-tenancy': 'End of Tenancy Cleaning',
};

const SERVICE_MULTIPLIERS: Record<ServiceCategory, number> = {
  regular: 1,
  'one-off': 1.05,
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
  const [frequency, setFrequency] = useState<BookingFrequency>(isRegular ? 'weekly' : 'one-time');
  const [email, setEmail] = useState('');
  const [joinMailingList, setJoinMailingList] = useState(false);

  // ─── Cleaner phase state ───────────────────────
  const [scheduling, setScheduling] = useState<'flexible' | 'set-time' | null>(null);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedCleanerId, setSelectedCleanerId] = useState(preSelectedCleanerId);
  const [acceptSubstitute, setAcceptSubstitute] = useState(true);
  const [keyAccess, setKeyAccess] = useState<KeyAccess>('i-will-be-home');
  const [keyAccessNote, setKeyAccessNote] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  const [submitted, setSubmitted] = useState(false);

  const selectedCleaner = cleaners.find((c) => c.id === selectedCleanerId);

  const frequencyDiscount = frequency === 'weekly' ? 0.1 : frequency === 'biweekly' ? 0.05 : 0;
  const oneOffSurcharge = frequency === 'one-time' && isRegular ? 0.05 : 0;

  const priceBreakdown = useMemo(() => {
    const rawRate = preSelectedCleaner?.hourlyRate ?? selectedCleaner?.hourlyRate ?? 18;
    const listedHourlyRate = getListedRate(rawRate);
    const multiplier = SERVICE_MULTIPLIERS[category] ?? 1;
    const breakdown = getPriceBreakdown(rawRate, effectiveHours, multiplier);
    const discount = breakdown.listedSubtotal * frequencyDiscount;
    const surcharge =
      frequency === 'one-time' && isRegular ? breakdown.listedSubtotal * oneOffSurcharge : 0;
    const cleaningSubtotal =
      Math.round((breakdown.listedSubtotal - discount + surcharge) * 100) / 100;
    const serviceFee = Math.round(cleaningSubtotal * 0.05 * 100) / 100;
    return {
      ...breakdown,
      listedHourlyRate,
      discount: Math.round(discount * 100) / 100,
      surcharge: Math.round(surcharge * 100) / 100,
      cleaningSubtotal,
      displayServiceFee: serviceFee,
      discountedTotal: Math.round((cleaningSubtotal + serviceFee) * 100) / 100,
    };
  }, [
    preSelectedCleaner,
    selectedCleaner,
    effectiveHours,
    category,
    frequencyDiscount,
    frequency,
    isRegular,
    oneOffSurcharge,
  ]);

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

          {/* Frequency */}
          <div className="p-6" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
            <h2 className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              How often?
            </h2>
            {isRegular && (
              <p className="mt-2 font-jost font-light text-xs text-gold">
                Save with a regular schedule — one-off cleans cost a little more.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { value: 'weekly' as BookingFrequency, label: 'Weekly', tag: 'Save 10%' },
                  { value: 'biweekly' as BookingFrequency, label: 'Fortnightly', tag: 'Save 5%' },
                  { value: 'one-time' as BookingFrequency, label: 'One-Off', tag: null },
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
                    ? `${preSelectedCleaner.name} — \u00A3${getListedRate(preSelectedCleaner.hourlyRate)}/hr`
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
            {priceBreakdown.surcharge > 0 && (
              <p className="mt-1 font-jost font-light text-xs text-ink-2 text-right">
                One-off surcharge (+&pound;{priceBreakdown.surcharge.toFixed(2)})
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
              <span>&pound;{getListedRate(preSelectedCleaner.hourlyRate)}/hr</span>
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
              {priceBreakdown.surcharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-jost font-light text-ink-3">One-off surcharge</span>
                  <span className="font-jost font-light text-ink">
                    +&pound;{priceBreakdown.surcharge.toFixed(2)}
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
              {frequency !== 'one-time' && (
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
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 bg-cream min-h-screen">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPhase('quote')}
          className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 hover:text-ink transition"
        >
          &larr; Back to quote
        </button>
        <h1 className="font-cormorant font-light text-2xl text-ink">Choose Your Cleaner</h1>
      </div>

      <div className="mt-10 space-y-10">
        {/* Scheduling preference */}
        {scheduling === null && (
          <div>
            <h2 className="font-cormorant font-light text-xl text-ink">
              How would you like to book?
            </h2>
            <p className="mt-2 font-jost font-light text-sm text-ink-3">
              Choose the option that works best for your schedule.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScheduling('flexible')}
                className="group bg-cream p-7 text-left transition hover:bg-cream-2"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center bg-cream-2 group-hover:bg-cream transition"
                  style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
                >
                  <svg
                    className="h-5 w-5 text-ink-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 font-cormorant font-light text-lg text-ink">
                  Browse available cleaners
                </h3>
                <p className="mt-1.5 font-jost font-light text-sm text-ink-3">
                  See who&apos;s available in your area and choose the right fit.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setScheduling('set-time')}
                className="group bg-cream p-7 text-left transition hover:bg-cream-2"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center bg-cream-2 group-hover:bg-cream transition"
                  style={{ border: '0.5px solid rgba(14,14,12,0.08)' }}
                >
                  <svg
                    className="h-5 w-5 text-ink-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 font-cormorant font-light text-lg text-ink">
                  Pick a date and time
                </h3>
                <p className="mt-1.5 font-jost font-light text-sm text-ink-3">
                  Choose your preferred slot and we&apos;ll match you with available cleaners.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Set time selector */}
        {scheduling === 'set-time' && (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="font-cormorant font-light text-lg text-ink">
                When do you need your cleaner?
              </h2>
              <button
                type="button"
                onClick={() => {
                  setScheduling(null);
                  setSelectedDay('');
                  setSelectedTime('');
                }}
                className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold hover:text-ink transition"
              >
                Change preference
              </button>
            </div>
            <div className="mt-5 space-y-6">
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
              {selectedDay && (
                <div>
                  <label className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                    Available start times on {selectedDay}
                  </label>
                  {availableTimeSlotsForDay.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {availableTimeSlotsForDay.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`px-3 py-2 font-jost text-xs font-light transition ${
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
                    <p className="mt-3 font-jost text-sm font-light text-ink-3">
                      No cleaners available on this day.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {scheduling === 'flexible' && (
          <div className="flex items-center justify-between">
            <h2 className="font-cormorant font-light text-lg text-ink">
              All available cleaners in your area
            </h2>
            <button
              type="button"
              onClick={() => setScheduling(null)}
              className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold hover:text-ink transition"
            >
              Change preference
            </button>
          </div>
        )}

        {/* Cleaners list */}
        {scheduling !== null && (
          <>
            {/* Tier legend */}
            <div className="flex flex-wrap gap-3">
              {(['elite', 'premium', 'standard'] as const).map((tier) => (
                <span
                  key={tier}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-jost text-[11px] uppercase tracking-[0.1em] ${TIER_INFO[tier].color}`}
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  {TIER_INFO[tier].label} — {TIER_INFO[tier].desc}
                </span>
              ))}
            </div>

            {availableCleaners.length === 0 ? (
              <div
                className="bg-cream-2 p-8 text-center"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <p className="font-jost font-light text-sm text-ink-2">
                  No cleaners available on {selectedDay}. Try a different day or switch to flexible
                  scheduling.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableCleaners.map((cleaner) => (
                  <CleanerDetailCard
                    key={cleaner.id}
                    cleaner={cleaner}
                    selected={selectedCleanerId === cleaner.id}
                    onSelect={() => setSelectedCleanerId(cleaner.id)}
                  />
                ))}
              </div>
            )}

            {selectedCleanerId && (
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
                    If {selectedCleaner?.name} cancels, we&apos;ll match you with another cleaner of
                    the same rating ({selectedCleaner?.rating}).
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
              {selectedCleaner && (
                <SummaryRow
                  label="Cleaner"
                  value={`${selectedCleaner.name} (${TIER_INFO[selectedCleaner.tier].label}) — \u00A3${priceBreakdown.listedHourlyRate}/hr`}
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
                {priceBreakdown.surcharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-jost font-light text-ink-3">One-off surcharge</span>
                    <span className="font-jost font-light text-ink">
                      +&pound;{priceBreakdown.surcharge.toFixed(2)}
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
                {frequency !== 'one-time' && (
                  <p className="font-jost font-light text-xs text-ink-3">
                    Per clean. Cancel or pause your schedule anytime.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!selectedCleanerId}
              className="w-full bg-ink py-4 font-jost text-[11px] uppercase tracking-[0.1em] text-cream hover:bg-gold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Booking Request
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

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

function CleanerDetailCard({
  cleaner,
  selected,
  onSelect,
}: {
  cleaner: Cleaner;
  selected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_INFO[cleaner.tier];
  const reviews = getReviewsForCleaner(cleaner.id);

  return (
    <div
      className={`transition ${selected ? 'bg-cream-2' : 'bg-cream hover:bg-cream-2'}`}
      style={{ border: selected ? '1px solid #0e0e0c' : '0.5px solid rgba(14,14,12,0.1)' }}
    >
      <button type="button" onClick={onSelect} className="w-full p-5 text-left">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center bg-cream-2 text-xl font-light text-ink font-cormorant"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            {cleaner.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-jost font-normal text-ink">{cleaner.name}</span>
              <span
                className={`px-2 py-0.5 font-jost text-[10px] uppercase tracking-[0.1em] ${tier.color}`}
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                {tier.label}
              </span>
              <VerificationBadge
                identityVerified={cleaner.identityVerified}
                backgroundChecked={cleaner.backgroundChecked}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 font-jost font-light text-sm text-ink-3">
              <StarRating rating={cleaner.rating} />
              <span>
                {cleaner.rating} ({cleaner.reviewCount} reviews)
              </span>
              <span className="text-ink-3/30">|</span>
              <span>{cleaner.yearsExperience} yrs exp</span>
              <span className="text-ink-3/30">|</span>
              <span>{cleaner.completedJobs} jobs</span>
            </div>
            <p className="mt-2 font-jost font-light text-sm text-ink-2 line-clamp-2">
              {cleaner.bio}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {cleaner.languages.map((lang) => (
                <span
                  key={lang}
                  className="bg-cream-2 px-2 py-0.5 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-2"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
                >
                  {lang}
                </span>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-3 font-jost font-light text-xs text-ink-3">
              <span>
                Available:{' '}
                <span className="font-normal text-ink-2">{cleaner.availability.join(', ')}</span>
              </span>
              {cleaner.availableNow && (
                <span className="flex items-center gap-1 text-gold font-normal">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping bg-gold/40" />
                    <span className="relative inline-flex h-2 w-2 bg-gold" />
                  </span>
                  Available now
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="font-cormorant font-light text-xl text-ink">
              &pound;{getListedRate(cleaner.hourlyRate)}
            </span>
            <span className="font-jost font-light text-xs text-ink-3">/hr</span>
            {selected && (
              <div className="mt-2 font-jost text-[11px] uppercase tracking-[0.1em] text-gold">
                &#10003; Selected
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expandable reviews */}
      <div className="px-5 py-3" style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold hover:text-ink transition"
        >
          {expanded ? 'Hide reviews' : `Show reviews (${reviews.length})`}
        </button>
        {expanded && reviews.length > 0 && (
          <div className="mt-3 space-y-3 pb-2">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-cream p-4"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-jost font-normal text-sm text-ink">
                      {review.customerName}
                    </span>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="font-jost font-light text-xs text-ink-3">{review.date}</span>
                </div>
                <p className="mt-1.5 font-jost font-light text-xs text-ink-2">{review.comment}</p>
                {review.cleanerReply && (
                  <div className="mt-2 bg-cream-2 p-3">
                    <p className="font-jost font-light text-xs text-ink-3">
                      <span className="font-normal text-ink-2">{cleaner.name}:</span>{' '}
                      {review.cleanerReply}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {expanded && reviews.length === 0 && (
          <p className="mt-2 pb-2 font-jost font-light text-xs text-ink-3">No reviews yet.</p>
        )}
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
