"use client";

import { useState } from "react";

export default function JoinAsCleanerPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    experience: "",
    bio: "",
    specialties: [] as string[],
    hourlyRate: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const specialtyOptions = [
    "Standard Cleaning",
    "Deep Cleaning",
    "Eco-Friendly",
    "Pet-Friendly",
    "Office Cleaning",
    "Move-In/Out",
    "Kitchen Specialist",
    "Bathroom Specialist",
    "Organizing",
    "Laundry & Ironing",
  ];

  const toggleSpecialty = (s: string) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(s)
        ? prev.specialties.filter((x) => x !== s)
        : [...prev.specialties, s],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await fetch("/api/cleaners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          &#10024;
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">
          Application Received!
        </h1>
        <p className="mt-4 text-gray-600">
          Thank you for applying to join Sparkle, {form.name}! We&apos;ll review
          your application and get back to you within 24-48 hours at{" "}
          {form.email}.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          In the meantime, prepare for the verification process by having your
          ID and any cleaning certifications ready.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900">Become a Cleaner</h1>
      <p className="mt-2 text-gray-600">
        Join our network of trusted cleaning professionals. Set your own rates,
        choose your schedule, and grow your business.
      </p>

      {/* Benefits */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Set Your Rates",
            desc: "You decide how much to charge. Keep the majority of your earnings.",
          },
          {
            title: "Flexible Schedule",
            desc: "Work when you want. Accept bookings that fit your availability.",
          },
          {
            title: "Grow Your Business",
            desc: "Build your reputation with reviews. Top cleaners get more visibility.",
          },
        ].map((b) => (
          <div key={b.title} className="rounded-lg bg-brand-50 p-4">
            <h3 className="font-semibold text-brand-700">{b.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{b.desc}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Personal Information
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
                Location
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Manhattan, NY"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Professional Details
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Years of Experience
              </label>
              <input
                type="number"
                required
                min="0"
                value={form.experience}
                onChange={(e) =>
                  setForm({ ...form, experience: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Desired Hourly Rate ($)
              </label>
              <input
                type="number"
                required
                min="15"
                value={form.hourlyRate}
                onChange={(e) =>
                  setForm({ ...form, hourlyRate: e.target.value })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Bio / About You
            </label>
            <textarea
              rows={4}
              required
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Tell potential customers about yourself, your experience, and what makes your service special..."
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Specialties (select all that apply)
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {specialtyOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    form.specialties.includes(s)
                      ? "bg-brand-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-brand-600 py-3 text-lg font-semibold text-white hover:bg-brand-700"
        >
          Submit Application
        </button>

        <p className="text-center text-xs text-gray-500">
          By submitting, you agree to our Terms of Service and consent to a
          background check as part of our verification process.
        </p>
      </form>
    </div>
  );
}
