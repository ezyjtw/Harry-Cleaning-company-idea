"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cleaners, getReviewsForCleaner } from "@/lib/mock-data";
import { getPriceBreakdown, PLATFORM_FEE_PERCENT } from "@/lib/pricing";
import StarRating from "@/components/StarRating";
import VerificationBadge from "@/components/VerificationBadge";
import type {
  ServiceCategory,
  BookingFrequency,
  KeyAccess,
  RoomConfig,
  Cleaner,
} from "@/lib/types";

const SERVICE_LABELS: Record<ServiceCategory, string> = {
  regular: "Regular Cleaning",
  "one-off": "One-Off Cleaning",
  "same-day": "Same Day Cleaning",
  deep: "Deep Cleaning",
  airbnb: "AirBnB Cleaning",
  "end-of-tenancy": "End of Tenancy Cleaning",
};

const SERVICE_MULTIPLIERS: Record<ServiceCategory, number> = {
  regular: 1,
  "one-off": 1.05,
  "same-day": 1.2,
  deep: 1.5,
  airbnb: 1.1,
  "end-of-tenancy": 2,
};

const ADDITIONAL_ROOMS = [
  "Conservatory",
  "Utility Room",
  "Garage",
  "Hallway",
  "Study / Office",
  "Dining Room",
  "Basement",
  "Attic Room",
];

const PRODUCT_FEE = 5; // £5 flat rate

const TIME_SLOTS = [
  "Early Morning (7am - 9am)",
  "Morning (9am - 12pm)",
  "Afternoon (12pm - 3pm)",
  "Late Afternoon (3pm - 6pm)",
  "Evening (6pm - 8pm)",
];

const TIER_INFO = {
  standard: { label: "Standard", color: "bg-gray-100 text-gray-700", desc: "Reliable and affordable" },
  premium: { label: "Premium", color: "bg-blue-100 text-blue-700", desc: "Experienced & highly rated" },
  elite: { label: "Elite", color: "bg-amber-100 text-amber-700", desc: "Top-tier, best of the best" },
};

function calculateSuggestedHours(rooms: RoomConfig, category: ServiceCategory): number {
  let base = 0;
  base += rooms.bedrooms * 0.5;
  base += rooms.bathrooms * 0.5;
  base += rooms.livingAreas * 0.4;
  base += rooms.kitchen ? 0.5 : 0;
  base += rooms.additionals.length * 0.3;
  base = Math.max(base, 1.5);

  if (category === "deep" || category === "end-of-tenancy") {
    base *= 1.8;
  } else if (category === "airbnb") {
    base *= 1.2;
  }

  return Math.round(base * 2) / 2;
}

type WizardPhase = "quote" | "cleaner";

export default function BookingWizardPage({
  params,
}: {
  params: { category: string };
}) {
  const category = params.category as ServiceCategory;
  const serviceLabel = SERVICE_LABELS[category] || "Cleaning Service";
  const isRegular = category === "regular";

  // Phase: "quote" = first page (postcode, rooms, hours, products, frequency, email)
  // Phase: "cleaner" = second page (flexible/set time, cleaner selection, key, notes)
  const [phase, setPhase] = useState<WizardPhase>("quote");

  // ─── Quote phase state ─────────────────────────
  const [postcode, setPostcode] = useState("");
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

  const [cleanerNote, setCleanerNote] = useState("");
  const [cleanerBringsProducts, setCleanerBringsProducts] = useState(false);
  const [frequency, setFrequency] = useState<BookingFrequency>(
    isRegular ? "weekly" : "one-time"
  );
  const [email, setEmail] = useState("");
  const [joinMailingList, setJoinMailingList] = useState(false);

  // ─── Cleaner phase state ───────────────────────
  const [scheduling, setScheduling] = useState<"flexible" | "set-time" | null>(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedCleanerId, setSelectedCleanerId] = useState("");
  const [acceptSubstitute, setAcceptSubstitute] = useState(true);
  const [keyAccess, setKeyAccess] = useState<KeyAccess>("i-will-be-home");
  const [keyAccessNote, setKeyAccessNote] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [submitted, setSubmitted] = useState(false);

  const selectedCleaner = cleaners.find((c) => c.id === selectedCleanerId);

  const frequencyDiscount = frequency === "weekly" ? 0.1 : frequency === "biweekly" ? 0.05 : 0;
  const oneOffSurcharge = frequency === "one-time" && isRegular ? 0.05 : 0;

  const priceBreakdown = useMemo(() => {
    const rate = selectedCleaner?.hourlyRate ?? 30;
    const multiplier = SERVICE_MULTIPLIERS[category] ?? 1;
    const breakdown = getPriceBreakdown(rate, effectiveHours, multiplier);
    const discount = breakdown.total * frequencyDiscount;
    const surcharge = frequency === "one-time" && isRegular ? breakdown.total * oneOffSurcharge : 0;
    return {
      ...breakdown,
      discount: Math.round(discount * 100) / 100,
      surcharge: Math.round(surcharge * 100) / 100,
      discountedTotal: Math.round((breakdown.total - discount + surcharge) * 100) / 100,
    };
  }, [selectedCleaner, effectiveHours, category, frequencyDiscount, frequency, isRegular, oneOffSurcharge]);

  const productCost = cleanerBringsProducts ? PRODUCT_FEE : 0;

  // Filter cleaners for set-time mode
  const availableCleaners = useMemo(() => {
    if (scheduling !== "set-time" || !selectedDay) return cleaners;
    return cleaners.filter((c) => c.availability.includes(selectedDay));
  }, [scheduling, selectedDay]);

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          &#10003;
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Booking Request Sent!
        </h1>
        <p className="mt-4 text-gray-600">
          We&apos;ve sent your {serviceLabel.toLowerCase()} request
          {selectedCleaner ? ` to ${selectedCleaner.name}` : ""}. You&apos;ll
          receive a confirmation at <strong>{email}</strong>.
        </p>
        {joinMailingList && (
          <p className="mt-2 text-sm text-brand-600">
            You&apos;ve been added to our mailing list for tips and offers.
          </p>
        )}
        <Link
          href="/"
          className="mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  // ─── PHASE 1: Quote ────────────────────────────
  if (phase === "quote") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            {serviceLabel}
          </h1>
        </div>

        <div className="mt-8 space-y-8">
          {/* Postcode */}
          <div>
            <label className="block text-sm font-semibold text-gray-900">
              Your postcode
            </label>
            <input
              type="text"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.toUpperCase())}
              placeholder="e.g. SW1A 1AA"
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {/* Rooms */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              How many rooms?
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
            <h2 className="text-sm font-semibold text-gray-900">
              How many hours?
            </h2>
            <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm text-brand-700">
                We recommend <strong>{suggestedHours} hours</strong> for your{" "}
                {rooms.bedrooms} bedroom, {rooms.bathrooms} bathroom home.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setSelectedHours(h)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    effectiveHours === h
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>

            {isUnderSuggested && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm text-amber-800">
                  You&apos;ve selected fewer hours than recommended. Leave a note
                  for the cleaner so they know where to focus:
                </p>
                <textarea
                  rows={2}
                  value={cleanerNote}
                  onChange={(e) => setCleanerNote(e.target.value)}
                  placeholder="e.g. Please focus on the kitchen and bathrooms..."
                  className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>
            )}
          </div>

          {/* Products */}
          <div className="rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">
              Cleaning products
            </h2>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setCleanerBringsProducts(false)}
                className={`flex-1 rounded-xl border-2 p-3 text-left text-sm transition ${
                  !cleanerBringsProducts
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-semibold text-gray-900">
                  I&apos;ll provide products
                </p>
                <p className="mt-0.5 text-xs text-gray-500">No extra cost</p>
              </button>
              <button
                type="button"
                onClick={() => setCleanerBringsProducts(true)}
                className={`flex-1 rounded-xl border-2 p-3 text-left text-sm transition ${
                  cleanerBringsProducts
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-semibold text-gray-900">
                  Cleaner brings products
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Additional &pound;5 charge
                </p>
              </button>
            </div>
          </div>

          {/* Frequency */}
          <div className="rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900">How often?</h2>
            {isRegular && (
              <p className="mt-1 text-xs text-green-600">
                Save with a regular schedule — one-off cleans cost a little more.
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  { value: "weekly" as BookingFrequency, label: "Weekly", tag: "Save 10%" },
                  { value: "biweekly" as BookingFrequency, label: "Fortnightly", tag: "Save 5%" },
                  { value: "one-time" as BookingFrequency, label: "One-Off", tag: "No extra charge" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFrequency(opt.value)}
                  className={`rounded-xl border-2 p-3 text-center transition ${
                    frequency === opt.value
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {opt.label}
                  </p>
                  {opt.tag && (
                    <p
                      className="mt-0.5 text-xs font-medium text-green-600"
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
            <label className="block text-sm font-semibold text-gray-900">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={joinMailingList}
                onChange={(e) => setJoinMailingList(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-gray-600">
                Tick here to recieve promotional offers
              </span>
            </label>
          </div>

          {/* Guide price */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                Guide price
              </span>
              <div className="text-right">
                <span className="text-2xl font-bold text-brand-600">
                  &pound;{priceBreakdown.discountedTotal.toFixed(2)}
                </span>
                {productCost > 0 && (
                  <span className="ml-1 text-xs text-gray-500">
                    + &pound;{productCost} products
                  </span>
                )}
              </div>
            </div>
            {frequencyDiscount > 0 && (
              <p className="mt-1 text-xs text-green-600 text-right">
                {frequency === "weekly" ? "Weekly" : "Fortnightly"} discount
                applied (-&pound;{priceBreakdown.discount.toFixed(2)})
              </p>
            )}
            {priceBreakdown.surcharge > 0 && (
              <p className="mt-1 text-xs text-amber-600 text-right">
                One-off surcharge (+&pound;{priceBreakdown.surcharge.toFixed(2)})
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Final price depends on your chosen cleaner&apos;s rate. Only{" "}
              {PLATFORM_FEE_PERCENT}% platform fee — no hidden charges.
            </p>
          </div>

          {/* Continue */}
          <button
            type="button"
            onClick={() => setPhase("cleaner")}
            disabled={!postcode || !email}
            className="w-full rounded-lg bg-brand-600 py-3.5 text-lg font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ─── PHASE 2: Cleaner selection ────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPhase("quote")}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to quote
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          Choose Your Cleaner
        </h1>
      </div>

      <div className="mt-8 space-y-8">
        {/* Scheduling preference */}
        {scheduling === null && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              When would you like your clean?
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setScheduling("flexible")}
                className="rounded-2xl border-2 border-gray-200 p-6 text-left transition hover:border-brand-400 hover:shadow-md"
              >
                <div className="text-3xl">&#128197;</div>
                <h3 className="mt-3 text-lg font-bold text-gray-900">
                  I&apos;m flexible
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Show me all available cleaners in my area and I&apos;ll
                  pick one that suits.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setScheduling("set-time")}
                className="rounded-2xl border-2 border-gray-200 p-6 text-left transition hover:border-brand-400 hover:shadow-md"
              >
                <div className="text-3xl">&#9200;</div>
                <h3 className="mt-3 text-lg font-bold text-gray-900">
                  I have a set time
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  I know when I need the cleaner — show me who&apos;s available
                  at my preferred time.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Set time selector */}
        {scheduling === "set-time" && (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                When do you need your cleaner?
              </h2>
              <button
                type="button"
                onClick={() => {
                  setScheduling(null);
                  setSelectedDay("");
                  setSelectedTime("");
                }}
                className="text-xs text-brand-600 hover:text-brand-700"
              >
                Change preference
              </button>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Day
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                          selectedDay === day
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {day}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Time slot
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        selectedTime === slot
                          ? "bg-brand-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {scheduling === "flexible" && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              All available cleaners in your area
            </h2>
            <button
              type="button"
              onClick={() => setScheduling(null)}
              className="text-xs text-brand-600 hover:text-brand-700"
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
              {(["elite", "premium", "standard"] as const).map((tier) => (
                <span
                  key={tier}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${TIER_INFO[tier].color}`}
                >
                  {TIER_INFO[tier].label} — {TIER_INFO[tier].desc}
                </span>
              ))}
            </div>

            {availableCleaners.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
                <p className="text-sm text-amber-800">
                  No cleaners available on {selectedDay}. Try a different day or
                  switch to flexible scheduling.
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
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptSubstitute}
                  onChange={(e) => setAcceptSubstitute(e.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Happy with a substitute cleaner?
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    If {selectedCleaner?.name} cancels, we&apos;ll match you
                    with another cleaner of the same rating (
                    {selectedCleaner?.rating}).
                  </p>
                </div>
              </label>
            )}

            {/* Key access */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900">
                How will the cleaner get in?
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "lockbox", label: "Keybox" },
                    { value: "key-under-mat", label: "Key hidden" },
                    { value: "i-will-be-home", label: "Someone will be in" },
                    { value: "with-concierge", label: "Concierge" },
                  ] as { value: KeyAccess; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setKeyAccess(opt.value)}
                    className={`rounded-lg border-2 px-4 py-3 text-left text-sm font-medium transition ${
                      keyAccess === opt.value
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {(keyAccess === "lockbox" || keyAccess === "key-under-mat") && (
                <input
                  type="text"
                  value={keyAccessNote}
                  onChange={(e) => setKeyAccessNote(e.target.value)}
                  placeholder={
                    keyAccess === "lockbox"
                      ? "Lockbox code or location..."
                      : "Where is the key hidden?"
                  }
                  className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              )}
            </div>

            {/* Special instructions */}
            <div>
              <label className="block text-sm font-semibold text-gray-900">
                Anything the cleaner should know or be careful with?
              </label>
              <textarea
                rows={3}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="e.g. 'Dog is friendly but barks', 'Please be careful with the antique vase', 'Don't move items on the desk'..."
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>

            {/* Summary & submit */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Booking Summary</h3>
              <SummaryRow label="Service" value={serviceLabel} />
              <SummaryRow label="Postcode" value={postcode} />
              <SummaryRow
                label="Space"
                value={`${rooms.bedrooms} bed, ${rooms.bathrooms} bath, ${rooms.livingAreas} living${rooms.kitchen ? ", kitchen" : ""}${rooms.additionals.length > 0 ? `, +${rooms.additionals.length} more` : ""}`}
              />
              <SummaryRow label="Duration" value={`${effectiveHours} hours`} />
              <SummaryRow
                label="Frequency"
                value={
                  frequency === "weekly"
                    ? "Weekly (10% off)"
                    : frequency === "biweekly"
                    ? "Fortnightly (5% off)"
                    : "One-off"
                }
              />
              <SummaryRow
                label="Products"
                value={cleanerBringsProducts ? `Cleaner brings (+\u00A3${PRODUCT_FEE})` : "Customer provides"}
              />
              {selectedCleaner && (
                <SummaryRow
                  label="Cleaner"
                  value={`${selectedCleaner.name} (${TIER_INFO[selectedCleaner.tier].label}) — \u00A3${selectedCleaner.hourlyRate}/hr`}
                />
              )}
              <SummaryRow
                label="Key access"
                value={keyAccess.replace(/-/g, " ")}
              />

              <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Cleaning ({effectiveHours}h)
                  </span>
                  <span className="font-medium text-green-600">
                    &pound;{priceBreakdown.cleanerEarnings.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Platform fee ({PLATFORM_FEE_PERCENT}%)
                  </span>
                  <span className="text-gray-500">
                    &pound;{priceBreakdown.platformFee.toFixed(2)}
                  </span>
                </div>
                {productCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cleaning products</span>
                    <span className="text-gray-500">
                      &pound;{productCost.toFixed(2)}
                    </span>
                  </div>
                )}
                {priceBreakdown.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">
                      {frequency === "weekly" ? "Weekly" : "Fortnightly"}{" "}
                      discount
                    </span>
                    <span className="text-green-600 font-medium">
                      -&pound;{priceBreakdown.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                {priceBreakdown.surcharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600 font-medium">
                      One-off surcharge
                    </span>
                    <span className="text-amber-600 font-medium">
                      +&pound;{priceBreakdown.surcharge.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-brand-600">
                    &pound;
                    {(priceBreakdown.discountedTotal + productCost).toFixed(2)}
                  </span>
                </div>
                {frequency !== "one-time" && (
                  <p className="text-xs text-gray-400">
                    Per clean. Cancel or pause your schedule anytime.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={!selectedCleanerId}
              className="w-full rounded-lg bg-green-600 py-3.5 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
      <span className="font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          -
        </button>
        <span className="w-6 text-center text-lg font-semibold text-gray-900">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
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
      className={`rounded-xl border-2 transition ${
        selected
          ? "border-brand-500 bg-brand-50 shadow-md"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
            {cleaner.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900">
                {cleaner.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tier.color}`}
              >
                {tier.label}
              </span>
              <VerificationBadge
                identityVerified={cleaner.identityVerified}
                backgroundChecked={cleaner.backgroundChecked}
              />
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
              <StarRating rating={cleaner.rating} />
              <span>
                {cleaner.rating} ({cleaner.reviewCount} reviews)
              </span>
              <span className="text-gray-300">|</span>
              <span>{cleaner.yearsExperience} yrs exp</span>
              <span className="text-gray-300">|</span>
              <span>{cleaner.completedJobs} jobs</span>
            </div>
            <p className="mt-1.5 text-sm text-gray-600 line-clamp-2">
              {cleaner.bio}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cleaner.languages.map((lang) => (
                <span
                  key={lang}
                  className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                >
                  {lang}
                </span>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>
                Available:{" "}
                <strong>{cleaner.availability.join(", ")}</strong>
              </span>
              {cleaner.availableNow && (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  Available now
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xl font-bold text-gray-900">
              &pound;{cleaner.hourlyRate}
            </span>
            <span className="text-xs text-gray-500">/hr</span>
            {selected && (
              <div className="mt-2 text-xs font-semibold text-brand-600">
                &#10003; Selected
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expandable reviews */}
      <div className="border-t border-gray-100 px-4 py-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          {expanded ? "Hide reviews" : `Show reviews (${reviews.length})`}
        </button>
        {expanded && reviews.length > 0 && (
          <div className="mt-2 space-y-3 pb-2">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg bg-white border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {review.customerName}
                    </span>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="text-xs text-gray-400">{review.date}</span>
                </div>
                <p className="mt-1 text-xs text-gray-600">{review.comment}</p>
                {review.cleanerReply && (
                  <div className="mt-2 rounded bg-gray-50 p-2">
                    <p className="text-xs text-gray-500">
                      <strong>{cleaner.name}:</strong> {review.cleanerReply}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {expanded && reviews.length === 0 && (
          <p className="mt-2 pb-2 text-xs text-gray-400">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right max-w-[60%]">
        {value}
      </span>
    </div>
  );
}
