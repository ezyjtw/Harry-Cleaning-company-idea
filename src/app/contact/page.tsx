'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

const SUBJECT_OPTIONS = [
  'General Enquiry',
  'Booking Issue',
  'Cleaner Issue',
  'Billing',
  'Other',
] as const;

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  bookingRef: string;
}

const initialForm: ContactForm = {
  name: '',
  email: '',
  phone: '',
  subject: 'General Enquiry',
  message: '',
  bookingRef: '',
};

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  function validate(): boolean {
    const newErrors: Partial<Record<keyof ContactForm, string>> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!form.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (form.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ContactForm]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError('');

    if (!validate()) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          subject: form.subject,
          message: form.message.trim(),
          bookingRef: form.bookingRef.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setSubmitted(true);
    } catch {
      setServerError('Unable to send your message. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-brand-50 p-8 text-center sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <svg
              className="h-8 w-8 text-brand-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Message Sent!</h2>
          <p className="mt-3 text-gray-600">
            Thank you for getting in touch, {form.name.split(' ')[0]}. We have received your enquiry
            and will get back to you within 24 hours.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            A confirmation email has been sent to <strong>{form.email}</strong>.
          </p>
          <button
            onClick={() => {
              setForm(initialForm);
              setSubmitted(false);
            }}
            className="mt-8 rounded-lg bg-brand-600 px-6 py-2.5 font-semibold text-white hover:bg-brand-700 transition"
          >
            Send Another Message
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Contact Us</h1>
        <p className="mt-3 text-lg text-gray-600">
          Have a question or need help? Send us a message and we will get back to you within 24
          hours.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
        {serverError && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{serverError}</div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={form.name}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              errors.name ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
            }`}
            placeholder="Your full name"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              errors.email ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
            }`}
            placeholder="you@example.com"
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="07700 900000"
          />
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
            Subject
          </label>
          <select
            id="subject"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {SUBJECT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Booking Reference */}
        <div>
          <label htmlFor="bookingRef" className="block text-sm font-medium text-gray-700">
            Booking Reference <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="bookingRef"
            name="bookingRef"
            type="text"
            value={form.bookingRef}
            onChange={handleChange}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="e.g. BK-12345"
          />
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            value={form.message}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-lg border px-4 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
              errors.message ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
            }`}
            placeholder="Tell us how we can help..."
          />
          {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 transition"
        >
          {submitting ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </main>
  );
}
