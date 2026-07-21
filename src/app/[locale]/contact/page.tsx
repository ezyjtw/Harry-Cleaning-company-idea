'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

import JunkMailHint from '@/components/JunkMailHint';

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
      <main className="min-h-screen bg-cream">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
          <div
            className="bg-cream-2 p-8 text-center sm:p-12"
            style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
          >
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center bg-cream"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <svg
                className="h-8 w-8 text-gold"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-6 font-newsreader text-2xl font-semibold text-ink">Message Sent!</h2>
            <p className="mt-3 font-jost font-light text-ink-2">
              Thank you for getting in touch, {form.name.split(' ')[0]}. We have received your
              enquiry and will get back to you within 24 hours.
            </p>
            <p className="mt-2 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
              A confirmation email has been sent to{' '}
              <strong className="font-normal">{form.email}</strong>.
            </p>
            <JunkMailHint variant="reply" />
            <button
              onClick={() => {
                setForm(initialForm);
                setSubmitted(false);
              }}
              className="mt-8 bg-ink px-6 py-2.5 font-jost font-normal text-cream transition hover:opacity-90"
            >
              Send Another Message
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-newsreader text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-3 font-jost text-lg font-light text-ink-2">
            Have a question or need help? Send us a message and we will get back to you within 24
            hours.
          </p>
          <p className="mt-2 font-jost text-[13px] font-light tracking-wide text-ink-3">
            Proudly serving north-east London and surrounding areas of Essex.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6" noValidate>
          {serverError && (
            <div
              className="bg-red-50 p-4 font-jost text-sm text-red-700"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              {serverError}
            </div>
          )}

          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              style={{
                border: errors.name ? '0.5px solid #ef4444' : '0.5px solid rgba(14,14,12,0.1)',
              }}
              className="mt-1 block w-full bg-cream px-4 py-2.5 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
              placeholder="Your full name"
            />
            {errors.name && <p className="mt-1 font-jost text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              style={{
                border: errors.email ? '0.5px solid #ef4444' : '0.5px solid rgba(14,14,12,0.1)',
              }}
              className="mt-1 block w-full bg-cream px-4 py-2.5 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 font-jost text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Phone <span className="text-ink-3">(optional)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              className="mt-1 block w-full bg-cream px-4 py-2.5 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
              placeholder="07700 900000"
            />
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="subject"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Subject
            </label>
            <select
              id="subject"
              name="subject"
              value={form.subject}
              onChange={handleChange}
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              className="mt-1 block w-full bg-cream px-4 py-2.5 font-jost font-light text-ink focus:outline-none focus:ring-1 focus:ring-ink"
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
            <label
              htmlFor="bookingRef"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Booking Reference <span className="text-ink-3">(optional)</span>
            </label>
            <input
              id="bookingRef"
              name="bookingRef"
              type="text"
              value={form.bookingRef}
              onChange={handleChange}
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              className="mt-1 block w-full bg-cream px-4 py-2.5 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
              placeholder="e.g. BK-12345"
            />
          </div>

          {/* Message */}
          <div>
            <label
              htmlFor="message"
              className="block font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3"
            >
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={5}
              value={form.message}
              onChange={handleChange}
              style={{
                border: errors.message ? '0.5px solid #ef4444' : '0.5px solid rgba(14,14,12,0.1)',
              }}
              className="mt-1 block w-full bg-cream px-4 py-2.5 font-jost font-light text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-ink"
              placeholder="Tell us how we can help..."
            />
            {errors.message && (
              <p className="mt-1 font-jost text-sm text-red-600">{errors.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-ink py-3 font-jost font-normal text-cream transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>

        {/* Registered office */}
        <div
          className="mt-12 bg-cream p-6 text-center"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <p className="font-jost text-[11px] uppercase tracking-[0.14em] text-ink-3">
            Registered office
          </p>
          <p className="mt-2 font-jost font-light text-ink">Rena Cleaning Network</p>
          <p className="font-jost font-light text-ink-2">66 Paul Street, London EC2A 4NA</p>
          <p className="mt-2 font-jost text-sm font-light text-ink-2">
            Email:{' '}
            <a href="mailto:support@renacleaning.co.uk" className="text-primary underline">
              support@renacleaning.co.uk
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
