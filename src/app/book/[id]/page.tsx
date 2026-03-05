"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCleanerById } from "@/lib/mock-data";
import StarRating from "@/components/StarRating";

const SERVICE_TYPES = [
  { value: "standard", label: "Standard Cleaning", multiplier: 1 },
  { value: "deep", label: "Deep Cleaning", multiplier: 1.5 },
  { value: "move-in-out", label: "Move In/Out Cleaning", multiplier: 2 },
  { value: "office", label: "Office Cleaning", multiplier: 1.3 },
];

export default function BookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const cleaner = getCleanerById(params.id);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    date: "",
    time: "",
    duration: 2,
    serviceType: "standard",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  if (!cleaner) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Cleaner not found</h1>
      </div>
    );
  }

  const selectedService = SERVICE_TYPES.find((s) => s.value === form.serviceType)!;
  const totalPrice = cleaner.hourlyRate * form.duration * selectedService.multiplier;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cleanerId: cleaner.id,
        ...form,
        totalPrice,
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
          Booking Confirmed!
        </h1>
        <p className="mt-4 text-gray-600">
          Your booking with {cleaner.name} has been submitted. You&apos;ll receive a
          confirmation email shortly at {form.email}.
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
            <div className="mt-2 flex justify-between border-t pt-2">
              <span className="font-medium text-gray-900">Total</span>
              <span className="text-lg font-bold text-brand-600">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push("/cleaners")}
          className="mt-8 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Browse More Cleaners
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Book a Cleaning</h1>

      {/* Cleaner summary */}
      <div className="mt-6 flex items-center gap-4 rounded-lg bg-gray-50 p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
          {cleaner.name.charAt(0)}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{cleaner.name}</h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StarRating rating={cleaner.rating} />
            <span>
              {cleaner.rating} ({cleaner.reviewCount} reviews)
            </span>
            <span>&middot; ${cleaner.hourlyRate}/hr</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {/* Contact info */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Your Information
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                type="text"
                required
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        </div>

        {/* Service details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Service Details
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Service Type
              </label>
              <select
                value={form.serviceType}
                onChange={(e) =>
                  setForm({ ...form, serviceType: e.target.value })
                }
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
              <label className="block text-sm font-medium text-gray-700">
                Duration (hours)
              </label>
              <select
                value={form.duration}
                onChange={(e) =>
                  setForm({ ...form, duration: Number(e.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                  <option key={h} value={h}>
                    {h} hour{h > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Preferred Date
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Preferred Time
              </label>
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
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-500">
                ${cleaner.hourlyRate}/hr &times; {form.duration}h &times;{" "}
                {selectedService.multiplier}x ({selectedService.label})
              </span>
            </div>
            <div className="text-2xl font-bold text-brand-600">
              ${totalPrice.toFixed(2)}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 py-3 text-lg font-semibold text-white hover:bg-brand-700"
        >
          Confirm Booking
        </button>
      </form>
    </div>
  );
}
