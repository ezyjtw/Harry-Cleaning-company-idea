'use client';

import { useState } from 'react';

const faqCategories = [
  {
    name: 'General',
    questions: [
      {
        q: 'What is Rena?',
        a: 'Rena is a cleaning marketplace that connects you with trusted, vetted independent cleaners in your area. We make it easy to find, book, and pay for professional cleaning services — all in one place.',
      },
      {
        q: 'How is Rena different from other cleaning services?',
        a: 'Unlike traditional cleaning agencies, Rena lets you choose your cleaner based on real reviews, ratings, and availability. We only add a small 6% service fee at checkout — far lower than the 20-30% markups charged by traditional agencies — which means better rates for you and higher earnings for cleaners.',
      },
      {
        q: 'What areas does Rena cover?',
        a: "We currently serve north-east London and Essex, with plans to expand across the UK. We only recruit cleaners who are reliable, vetted, and consistently deliver a high standard of service. Enter your postcode on the homepage to check availability. If we're not in your area yet, leave your email and we'll notify you as soon as we launch near you.",
      },
      {
        q: 'Do I need to create an account to book?',
        a: 'Yes, a free account is required to make bookings. This allows us to securely process payments, maintain your booking history, and enable communication with your cleaner.',
      },
    ],
  },
  {
    name: 'Booking',
    questions: [
      {
        q: 'How do I book a cleaner?',
        a: 'Simply browse cleaners in your area, select one you like, choose your service type, date, and time, then confirm your booking. You will receive an instant confirmation once the cleaner accepts.',
      },
      {
        q: 'Can I book a same-day clean?',
        a: 'Yes! Same-day bookings are available if requested before 12pm midday, subject to cleaner availability in your area. Look for cleaners with the "Available Now" badge.',
      },
      {
        q: 'Can I request a specific cleaner for recurring bookings?',
        a: 'Absolutely. Once you have found a cleaner you love, you can book them on a recurring weekly, fortnightly, or monthly schedule. Regular bookings often come at a discounted rate.',
      },
      {
        q: 'How far in advance should I book?',
        a: 'We recommend booking at least 48 hours in advance for the best availability. However, same-day bookings are available depending on cleaner availability in your area.',
      },
    ],
  },
  {
    name: 'Pricing',
    questions: [
      {
        q: 'How much does a cleaning cost?',
        a: 'Pricing varies by cleaner, service type, and duration. Cleaners set their own hourly rates, typically ranging from £14 to £25 per hour. You will always see the total price before confirming your booking.',
      },
      {
        q: 'Are there any hidden fees?',
        a: 'No. Rena has a transparent pricing model. The price shown at checkout is the price you pay. A 6% service fee is the only extra charge and it is always shown before you confirm — there are no surprise charges.',
      },
      {
        q: 'Do regular bookings cost less?',
        a: "Many cleaners offer discounted rates for recurring bookings (weekly or fortnightly). The discount is shown on each cleaner's profile so you can compare before booking.",
      },
    ],
  },
  {
    name: 'Cleaners',
    questions: [
      {
        q: 'How are cleaners vetted?',
        a: 'Every cleaner on Rena goes through a multi-step verification process including identity verification, proof of right to work, and reference checks. Cleaners who pass all steps earn the "Verified" badge.',
      },
      {
        q: 'Can I leave a review for my cleaner?',
        a: 'Yes, after every completed booking you can rate your cleaner on overall quality, thoroughness, punctuality, and communication. Reviews help other customers and reward great cleaners.',
      },
      {
        q: 'What if I am not happy with the clean?',
        a: 'We offer a satisfaction guarantee. If you are not satisfied, contact us within 24 hours. If your claim meets our in-house criteria, we will issue a full refund. We can also help you re-book another cleaner. See our Guarantees page for details.',
      },
      {
        q: 'Do cleaners bring their own supplies?',
        a: 'This varies by cleaner and is noted on their profile. Many cleaners bring standard cleaning supplies, but you can discuss specific requirements or preferences through our messaging system before the booking.',
      },
    ],
  },
  {
    name: 'Payments',
    questions: [
      {
        q: 'How do payments work?',
        a: 'Payments are processed securely through our platform. For first-time bookings with a new cleaner, your payment is held securely and only released after the job is completed to your satisfaction.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express) as well as Apple Pay and Google Pay. All payments are processed through Stripe for maximum security.',
      },
      {
        q: 'When am I charged?',
        a: 'You are charged when your booking is confirmed. For first-time bookings with a new cleaner, the funds are held securely and released to the cleaner once the job is marked as complete.',
      },
    ],
  },
  {
    name: 'Safety',
    questions: [
      {
        q: 'Is it safe to let a cleaner into my home?',
        a: 'Safety is our top priority. All cleaners are ID-verified and personally vetted. Our review system provides transparency, and we hold your payment securely to protect you on first bookings with new cleaners.',
      },
      {
        q: 'Are cleaners insured?',
        a: 'Yes. All cleaners on the Rena platform are required to have public liability insurance. In the unlikely event of accidental damage, you are covered. See our Guarantees page for full details.',
      },
      {
        q: 'How do I report a problem?',
        a: 'You can raise a dispute directly through your booking page, or contact our support team. We take all concerns seriously and aim to resolve disputes within 48 hours.',
      },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="font-newsreader text-4xl font-semibold tracking-tight text-ink">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 font-jost text-lg font-light text-ink-2">
            Everything you need to know about using Rena. Can&apos;t find your answer?{' '}
            <a href="mailto:support@renacleaning.co.uk" className="text-gold hover:underline">
              Contact our support team
            </a>
            .
          </p>
        </div>

        <div className="mt-16 space-y-12">
          {faqCategories.map((category) => (
            <section key={category.name} aria-labelledby={`faq-${category.name.toLowerCase()}`}>
              <div className="pb-3" style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}>
                <div className="mb-2 h-px w-12 bg-gold" />
                <h2
                  id={`faq-${category.name.toLowerCase()}`}
                  className="font-newsreader text-2xl font-semibold text-ink"
                >
                  {category.name}
                </h2>
              </div>
              <dl className="mt-6 space-y-0" style={{ borderColor: 'rgba(14,14,12,0.1)' }}>
                {category.questions.map((item, idx) => {
                  const key = `${category.name}-${idx}`;
                  const isOpen = openItems[key] || false;

                  return (
                    <div
                      key={key}
                      className="py-4"
                      style={{ borderBottom: '0.5px solid rgba(14,14,12,0.1)' }}
                    >
                      <dt>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left"
                          onClick={() => toggleItem(key)}
                          aria-expanded={isOpen}
                          aria-controls={`answer-${key}`}
                        >
                          <span className="font-jost text-base font-normal text-ink">{item.q}</span>
                          <span className="ml-6 flex-shrink-0">
                            <svg
                              className={`h-5 w-5 text-ink-3 transition-transform duration-200 ${
                                isOpen ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </span>
                        </button>
                      </dt>
                      {isOpen && (
                        <dd
                          id={`answer-${key}`}
                          className="mt-3 font-jost text-base font-light text-ink-2 leading-relaxed"
                        >
                          {item.a}
                        </dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>

        {/* CTA */}
        <div
          className="mt-16 bg-cream-2 p-8 text-center"
          style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
        >
          <h3 className="font-newsreader text-xl font-semibold text-ink">Still have questions?</h3>
          <p className="mt-2 font-jost font-light text-ink-2">
            Our support team is here to help. Get in touch and we will get back to you within 24
            hours.
          </p>
          <a
            href="mailto:support@renacleaning.co.uk"
            className="mt-4 inline-block bg-ink px-6 py-3 font-jost font-normal text-cream transition-colors hover:opacity-90"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
