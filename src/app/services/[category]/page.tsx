"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cleaners } from "@/lib/mock-data";
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
  "one-off": 1,
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

const FOCUS_AREAS = [
  "Kitchen",
  "Bathrooms",
  "Bedrooms",
  "Living Areas",
  "Windows (interior)",
  "Skirting Boards",
  "Inside Cupboards",
  "Appliances (oven, fridge)",
  "Floors (mop & vacuum)",
];

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

  return Math.round(base * 2) / 2; // round to nearest 0.5
}

const STEPS = [
  "Rooms",
  "Hours & Focus",
  "Products & Frequency",
  "Details",
  "Choose Cleaner",
  "Review",
] as const;

export default function BookingWizardPage({
  params,
}: {
  params: { category: string };
}) {
  const category = params.category as ServiceCategory;
  const serviceLabel = SERVICE_LABELS[category] || "Cleaning Service";
  const isRegular = category === "regular";

  const [step, setStep] = useState(0);

  // Room config
  const [rooms, setRooms] = useState<RoomConfig>({
    bedrooms: 2,
    bathrooms: 1,
    livingAreas: 1,
    kitchen: true,
    additionals: [],
  });

  // Hours
  const suggestedHours = calculateSuggestedHours(rooms, category);
  const [selectedHours, setSelectedHours] = useState<number | null>(null);
  const effectiveHours = selectedHours ?? suggestedHours;
  const isUnderSuggested = effectiveHours < suggestedHours;

  // Focus areas (only shown if hours < suggested)
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  // Products
  const [cleanerBringsProducts, setCleanerBringsProducts] = useState(false);

  // Frequency
  const [frequency, setFrequency] = useState<BookingFrequency>(
    isRegular ? "weekly" : "one-time"
  );

  // Contact & access
  const [email, setEmail] = useState("");
  const [joinMailingList, setJoinMailingList] = useState(false);
  const [keyAccess, setKeyAccess] = useState<KeyAccess>("i-will-be-home");
  const [keyAccessNote, setKeyAccessNote] = useState("");

  // Scheduling
  const [scheduling, setScheduling] = useState<"specific" | "flexible">("flexible");
  const [preferredDates, setPreferredDates] = useState<string[]>([""]);
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<string[]>([]);

  // Cleaner
  const [selectedCleanerId, setSelectedCleanerId] = useState("");
  const [acceptSubstitute, setAcceptSubstitute] = useState(true);

  // Instructions
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Submitted
  const [submitted, setSubmitted] = useState(false);

  const selectedCleaner = cleaners.find((c) => c.id === selectedCleanerId);

  const frequencyDiscount = frequency === "weekly" ? 0.1 : frequency === "biweekly" ? 0.05 : 0;

  const priceBreakdown = useMemo(() => {
    const rate = selectedCleaner?.hourlyRate ?? 30;
    const multiplier = SERVICE_MULTIPLIERS[category] ?? 1;
    const breakdown = getPriceBreakdown(rate, effectiveHours, multiplier);
    if (frequencyDiscount > 0) {
      const discount = breakdown.total * frequencyDiscount;
      return {
        ...breakdown,
        discount: Math.round(discount * 100) / 100,
        discountedTotal: Math.round((breakdown.total - discount) * 100) / 100,
      };
    }
    return { ...breakdown, discount: 0, discountedTotal: breakdown.total };
  }, [selectedCleaner, effectiveHours, category, frequencyDiscount]);

  const productCost = cleanerBringsProducts && selectedCleaner ? selectedCleaner.productFee : 0;

  function handleSubmit() {
    setSubmitted(true);
  }

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
          href="/services"
          className="mt-8 inline-block rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Book Another Clean
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/services"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {serviceLabel}
        </h1>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-gray-500">
          {STEPS.map((label, i) => (
            <button
              key={label}
              onClick={() => i < step && setStep(i)}
              className={`text-center transition ${
                i === step
                  ? "font-semibold text-brand-600"
                  : i < step
                  ? "text-brand-500 cursor-pointer hover:text-brand-600"
                  : "text-gray-400"
              }`}
            >
              <div
                className={`mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  i === step
                    ? "bg-brand-600 text-white"
                    : i < step
                    ? "bg-brand-100 text-brand-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </div>
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full bg-brand-600 transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="mt-8">
        {/* ─── STEP 0: Rooms ─── */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Tell us about your space
            </h2>

            <div className="grid gap-6 sm:grid-cols-2">
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
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={rooms.kitchen}
                    onChange={(e) =>
                      setRooms({ ...rooms, kitchen: e.target.checked })
                    }
                    className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="font-medium text-gray-700">Kitchen</span>
                </label>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Additional areas
              </p>
              <div className="flex flex-wrap gap-2">
                {ADDITIONAL_ROOMS.map((room) => (
                  <button
                    key={room}
                    type="button"
                    onClick={() => {
                      setRooms({
                        ...rooms,
                        additionals: rooms.additionals.includes(room)
                          ? rooms.additionals.filter((r) => r !== room)
                          : [...rooms.additionals, room],
                      });
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      rooms.additionals.includes(room)
                        ? "bg-brand-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {room}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 1: Hours & Focus ─── */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              How long do you need?
            </h2>

            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm text-brand-700">
                Based on your {rooms.bedrooms} bedroom{rooms.bedrooms !== 1 ? "s" : ""},{" "}
                {rooms.bathrooms} bathroom{rooms.bathrooms !== 1 ? "s" : ""},{" "}
                {rooms.livingAreas} living area{rooms.livingAreas !== 1 ? "s" : ""}
                {rooms.kitchen ? ", kitchen" : ""}
                {rooms.additionals.length > 0
                  ? `, and ${rooms.additionals.length} additional area${
                      rooms.additionals.length !== 1 ? "s" : ""
                    }`
                  : ""}
                , we suggest:
              </p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {suggestedHours} hours
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                Or choose your own duration:
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8].map((h) => (
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
              {selectedHours !== null && selectedHours !== suggestedHours && (
                <button
                  type="button"
                  onClick={() => setSelectedHours(null)}
                  className="mt-2 text-xs text-brand-600 hover:text-brand-700"
                >
                  Use suggested ({suggestedHours}h)
                </button>
              )}
            </div>

            {isUnderSuggested && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-800">
                  You&apos;ve selected fewer hours than we recommend.
                </p>
                <p className="mt-1 text-sm text-amber-700">
                  Where would you like the cleaner to focus?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FOCUS_AREAS.map((area) => (
                    <button
                      key={area}
                      type="button"
                      onClick={() =>
                        setFocusAreas(
                          focusAreas.includes(area)
                            ? focusAreas.filter((a) => a !== area)
                            : [...focusAreas, area]
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        focusAreas.includes(area)
                          ? "bg-amber-600 text-white"
                          : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      }`}
                    >
                      {area}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 2: Products & Frequency ─── */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Products & Scheduling
            </h2>

            {/* Products */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">Cleaning Products</h3>
              <p className="mt-1 text-sm text-gray-600">
                Would you like the cleaner to bring their own products?
              </p>
              <div className="mt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setCleanerBringsProducts(false)}
                  className={`flex-1 rounded-xl border-2 p-4 text-left transition ${
                    !cleanerBringsProducts
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    I&apos;ll provide products
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    No additional cost
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setCleanerBringsProducts(true)}
                  className={`flex-1 rounded-xl border-2 p-4 text-left transition ${
                    cleanerBringsProducts
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    Cleaner brings products
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Additional cost applies (varies by cleaner)
                  </p>
                </button>
              </div>
            </div>

            {/* Frequency */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">
                How often?
              </h3>
              {isRegular && (
                <p className="mt-1 text-sm text-green-600">
                  Lock in a weekly or biweekly schedule to save on every clean!
                </p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    {
                      value: "weekly" as BookingFrequency,
                      label: "Weekly",
                      saving: "Save 10%",
                    },
                    {
                      value: "biweekly" as BookingFrequency,
                      label: "Biweekly",
                      saving: "Save 5%",
                    },
                    {
                      value: "one-time" as BookingFrequency,
                      label: "One-Time",
                      saving: null,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFrequency(opt.value)}
                    className={`rounded-xl border-2 p-4 text-center transition ${
                      frequency === opt.value
                        ? "border-brand-500 bg-brand-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <p className="font-semibold text-gray-900">{opt.label}</p>
                    {opt.saving && (
                      <p className="mt-1 text-sm font-medium text-green-600">
                        {opt.saving}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Details (email, key, scheduling) ─── */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Details
            </h2>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              <label className="mt-3 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={joinMailingList}
                  onChange={(e) => setJoinMailingList(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-gray-600">
                  Sign me up for cleaning tips, offers, and updates
                </span>
              </label>
            </div>

            {/* Key access */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">
                How will the cleaner access your home?
              </h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { value: "i-will-be-home", label: "I'll be home" },
                    { value: "key-under-mat", label: "Key under mat / hidden" },
                    { value: "lockbox", label: "Key in lockbox" },
                    { value: "with-concierge", label: "With concierge / doorman" },
                    { value: "other", label: "Other" },
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
              {(keyAccess === "lockbox" ||
                keyAccess === "key-under-mat" ||
                keyAccess === "other") && (
                <input
                  type="text"
                  value={keyAccessNote}
                  onChange={(e) => setKeyAccessNote(e.target.value)}
                  placeholder={
                    keyAccess === "lockbox"
                      ? "Lockbox code or location..."
                      : keyAccess === "key-under-mat"
                      ? "Where exactly is the key?"
                      : "Please describe access instructions..."
                  }
                  className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              )}
            </div>

            {/* Scheduling */}
            <div className="rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900">
                When works for you?
              </h3>
              <div className="mt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setScheduling("flexible")}
                  className={`flex-1 rounded-xl border-2 p-4 text-center transition ${
                    scheduling === "flexible"
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    I&apos;m flexible
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Find me the best available time
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduling("specific")}
                  className={`flex-1 rounded-xl border-2 p-4 text-center transition ${
                    scheduling === "specific"
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900">
                    Specific dates
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    I have preferred dates/times
                  </p>
                </button>
              </div>

              {scheduling === "flexible" && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 mb-3">
                    Which time slots work best for you?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          setPreferredTimeSlots(
                            preferredTimeSlots.includes(slot)
                              ? preferredTimeSlots.filter((s) => s !== slot)
                              : [...preferredTimeSlots, slot]
                          )
                        }
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          preferredTimeSlots.includes(slot)
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {scheduling === "specific" && (
                <div className="mt-4 space-y-3">
                  {preferredDates.map((date, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => {
                          const newDates = [...preferredDates];
                          newDates[i] = e.target.value;
                          setPreferredDates(newDates);
                        }}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                      {preferredDates.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreferredDates(
                              preferredDates.filter((_, j) => j !== i)
                            )
                          }
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {preferredDates.length < 5 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreferredDates([...preferredDates, ""])
                      }
                      className="text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      + Add another date option
                    </button>
                  )}
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">Preferred time:</p>
                    <div className="flex flex-wrap gap-2">
                      {TIME_SLOTS.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() =>
                            setPreferredTimeSlots(
                              preferredTimeSlots.includes(slot)
                                ? preferredTimeSlots.filter((s) => s !== slot)
                                : [...preferredTimeSlots, slot]
                            )
                          }
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                            preferredTimeSlots.includes(slot)
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
              )}
            </div>
          </div>
        )}

        {/* ─── STEP 4: Choose Cleaner ─── */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Choose your cleaner
            </h2>
            <p className="text-sm text-gray-600">
              Browse cleaners in your area. You can pick anyone, or let us match
              you with the best available.
            </p>

            {/* Tier filter legend */}
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

            {/* Cleaner cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              {cleaners.map((cleaner) => (
                <CleanerSelectCard
                  key={cleaner.id}
                  cleaner={cleaner}
                  selected={selectedCleanerId === cleaner.id}
                  onSelect={() => setSelectedCleanerId(cleaner.id)}
                  bringsProducts={cleanerBringsProducts}
                />
              ))}
            </div>

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
                    If {selectedCleaner?.name} isn&apos;t available, we&apos;ll match you
                    with another cleaner of the same tier ({selectedCleaner?.tier}).
                  </p>
                </div>
              </label>
            )}
          </div>
        )}

        {/* ─── STEP 5: Review & Special Instructions ─── */}
        {step === 5 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Review & Submit
            </h2>

            {/* Special instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Anything the cleaner should know or be careful with?
              </label>
              <textarea
                rows={4}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="E.g. 'Please be careful with the antique vase in the living room', 'Dog is friendly but barks', 'Don't move items on the desk', etc."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Booking Summary</h3>

              <SummaryRow label="Service" value={serviceLabel} />
              <SummaryRow
                label="Space"
                value={`${rooms.bedrooms} bed, ${rooms.bathrooms} bath, ${rooms.livingAreas} living${rooms.kitchen ? ", kitchen" : ""}${rooms.additionals.length > 0 ? `, +${rooms.additionals.length} more` : ""}`}
              />
              <SummaryRow
                label="Duration"
                value={`${effectiveHours} hours${isUnderSuggested ? ` (suggested: ${suggestedHours}h)` : ""}`}
              />
              {isUnderSuggested && focusAreas.length > 0 && (
                <SummaryRow
                  label="Focus areas"
                  value={focusAreas.join(", ")}
                />
              )}
              <SummaryRow
                label="Products"
                value={
                  cleanerBringsProducts
                    ? `Cleaner brings products (+$${productCost})`
                    : "Customer provides"
                }
              />
              <SummaryRow
                label="Frequency"
                value={
                  frequency === "weekly"
                    ? "Weekly (10% off)"
                    : frequency === "biweekly"
                    ? "Biweekly (5% off)"
                    : "One-time"
                }
              />
              <SummaryRow label="Key access" value={keyAccess.replace(/-/g, " ")} />
              <SummaryRow
                label="Scheduling"
                value={
                  scheduling === "flexible"
                    ? `Flexible${preferredTimeSlots.length > 0 ? ` (${preferredTimeSlots.join(", ")})` : ""}`
                    : `Specific dates${preferredDates.filter(Boolean).length > 0 ? ` (${preferredDates.filter(Boolean).join(", ")})` : ""}`
                }
              />
              {selectedCleaner && (
                <SummaryRow
                  label="Cleaner"
                  value={`${selectedCleaner.name} (${TIER_INFO[selectedCleaner.tier].label}) — $${selectedCleaner.hourlyRate}/hr`}
                />
              )}

              {/* Price breakdown */}
              <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Cleaning ({effectiveHours}h &times; ${selectedCleaner?.hourlyRate ?? 30}/hr
                    {SERVICE_MULTIPLIERS[category] !== 1
                      ? ` &times; ${SERVICE_MULTIPLIERS[category]}x`
                      : ""}
                    )
                  </span>
                  <span className="font-medium text-green-600">
                    ${priceBreakdown.cleanerEarnings.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Platform fee ({PLATFORM_FEE_PERCENT}%)
                  </span>
                  <span className="text-gray-500">
                    ${priceBreakdown.platformFee.toFixed(2)}
                  </span>
                </div>
                {productCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cleaning products</span>
                    <span className="text-gray-500">
                      ${productCost.toFixed(2)}
                    </span>
                  </div>
                )}
                {priceBreakdown.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 font-medium">
                      {frequency === "weekly" ? "Weekly" : "Biweekly"} discount
                    </span>
                    <span className="text-green-600 font-medium">
                      -${priceBreakdown.discount.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-brand-600">
                    ${(priceBreakdown.discountedTotal + productCost).toFixed(2)}
                  </span>
                </div>
                {frequency !== "one-time" && (
                  <p className="text-xs text-gray-400">
                    Per clean. You can cancel or pause your schedule anytime.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          className={`rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 ${
            step === 0 ? "invisible" : ""
          }`}
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            disabled={step === 3 && !email}
            className="rounded-lg bg-brand-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!email || !selectedCleanerId}
            className="rounded-lg bg-green-600 px-8 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Booking Request
          </button>
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

function CleanerSelectCard({
  cleaner,
  selected,
  onSelect,
  bringsProducts,
}: {
  cleaner: Cleaner;
  selected: boolean;
  onSelect: () => void;
  bringsProducts: boolean;
}) {
  const tier = TIER_INFO[cleaner.tier];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border-2 p-4 text-left transition ${
        selected
          ? "border-brand-500 bg-brand-50 shadow-md"
          : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
          {cleaner.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">
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
          <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
            <StarRating rating={cleaner.rating} />
            <span>
              {cleaner.rating} ({cleaner.reviewCount})
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">
            {cleaner.bio}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {cleaner.languages.map((lang) => (
              <span
                key={lang}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
              >
                {lang}
              </span>
            ))}
          </div>
          {bringsProducts && cleaner.bringsProducts && (
            <p className="mt-1 text-xs text-green-600">
              Brings products (+${cleaner.productFee})
            </p>
          )}
          {bringsProducts && !cleaner.bringsProducts && (
            <p className="mt-1 text-xs text-amber-600">
              Does not bring products
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-gray-900">
            ${cleaner.hourlyRate}
          </span>
          <span className="text-xs text-gray-500">/hr</span>
        </div>
      </div>
    </button>
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
