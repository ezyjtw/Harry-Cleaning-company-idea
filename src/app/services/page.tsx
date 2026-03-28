'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ServiceCategory } from '@/lib/types';

const services: {
  id: ServiceCategory;
  title: string;
  tagline: string;
  summary: string;
  details: string[];
  price: string;
  priceNote?: string;
  badge?: string;
  icon: React.ReactNode;
  idealFor: string;
}[] = [
  {
    id: 'regular',
    title: 'Regular Cleaning',
    tagline: 'Your home, consistently spotless',
    summary:
      'Recurring weekly or fortnightly cleans to keep your home consistently fresh. Lock in a preferred cleaner and a time that suits you — same person, same standard, every visit.',
    details: [
      'Dusting all accessible surfaces, shelves, and furniture',
      'Vacuuming and mopping all floors',
      'Kitchen surfaces wiped down, sink cleaned, appliance exteriors polished',
      'Bathrooms cleaned including toilet, shower, bath, and mirrors',
      'Bins emptied and liners replaced',
      'Beds made and light tidying',
    ],
    price: 'From £14/hr',
    priceNote: 'Save up to 10% with a recurring schedule',
    badge: 'Most Popular',
    idealFor: 'Busy households wanting a reliable, ongoing clean',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
  },
  {
    id: 'same-day',
    title: 'Same Day Cleaning',
    tagline: 'A vetted cleaner at your door — today',
    summary:
      'Need a clean today? We match you with a vetted, available cleaner near you at short notice. Same high standards, just faster booking.',
    details: [
      'All standard cleaning tasks covered',
      'Matched with a nearby, available cleaner within hours',
      'Ideal for unexpected guests, viewings, or last-minute needs',
      'Same high standards as a regular clean, just faster booking',
      'Subject to cleaner availability in your area',
    ],
    price: 'From £18/hr',
    idealFor: 'Last-minute guests, property viewings, or urgent tidying',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    id: 'deep',
    title: 'Deep Cleaning',
    tagline: 'Every corner, every surface — thoroughly',
    summary:
      'A thorough top-to-bottom clean. Inside cupboards, behind appliances, skirting boards — the works. Perfect as a seasonal refresh or before starting regular cleans.',
    details: [
      'Everything in a standard clean, plus much more',
      'Inside oven, fridge, and kitchen cupboards cleaned',
      'Behind and beneath furniture and appliances',
      'Skirting boards, door frames, and light switches wiped',
      'Limescale removal in bathrooms',
      'Window sills and interior glass cleaned',
    ],
    price: 'From £20/hr',
    priceNote: 'Typically 3–8 hours depending on property size',
    badge: 'Best Value',
    idealFor: 'Seasonal refreshes, pre-event prep, or a fresh start',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    ),
  },
  {
    id: 'airbnb',
    title: 'AirBnB Cleaning',
    tagline: 'Guest-ready, every single time',
    summary:
      'Fast turnaround cleans between guests. Linen changes, restocking, and a spotless space. Consistent quality your guests will notice in their reviews.',
    details: [
      'Full property clean to guest-ready standard',
      'Linen and towel changes',
      'Restocking of essentials (toiletries, tea, coffee) if provided',
      'Kitchen reset — dishwasher emptied, surfaces cleared and wiped',
      'Bathroom deep clean with fresh towels laid out',
      'Quick turnaround times to fit between check-out and check-in',
    ],
    price: 'From £55',
    priceNote: 'Fixed price based on property size',
    idealFor: 'Airbnb hosts, holiday lets, and short-stay properties',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
        />
      </svg>
    ),
  },
  {
    id: 'end-of-tenancy',
    title: 'End of Tenancy Cleaning',
    tagline: 'Get your deposit back',
    summary:
      'Moving out? Get your deposit back with a professional clean that meets landlord and letting agency standards. Comprehensive, thorough, and designed to pass inspection.',
    details: [
      'Comprehensive clean of every room to landlord and agency standards',
      'Full oven clean — inside, racks, door glass, and exterior',
      'Fridge and freezer defrosted and cleaned',
      'All cupboards and drawers cleaned inside and out',
      'Limescale removed from taps, showerheads, and tiles',
      'Windows cleaned internally, sills and frames wiped',
      'Carpets vacuumed, hard floors mopped and edges done',
      'Skirting boards, light fittings, and switches cleaned throughout',
    ],
    price: 'From £175',
    priceNote: 'Fixed price by property size — typically 4–13 hours',
    idealFor: 'Tenants moving out who want their full deposit returned',
    icon: (
      <svg
        className="h-7 w-7"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819"
        />
      </svg>
    ),
  },
];

export default function ServicesPage() {
  const [expandedId, setExpandedId] = useState<ServiceCategory | null>(null);

  const toggle = (id: ServiceCategory) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <>
      {/* Hero */}
      <section className="bg-ink py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-jost text-[12px] uppercase tracking-[0.16em] text-gold">
            Our Services
          </p>
          <h1 className="mt-4 font-cormorant font-light text-cream text-4xl sm:text-5xl lg:text-[56px] leading-tight">
            Professional cleaning, <span className="italic">tailored to you</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl font-jost font-light text-cream/70 text-lg leading-relaxed">
            From regular upkeep to deep cleans and move-out turnarounds — every service is delivered
            by vetted, reviewed cleaners you choose yourself.
          </p>
          <div className="mt-4 mx-auto w-8 h-px bg-gold" />
        </div>
      </section>

      {/* Services grid */}
      <section className="bg-cream py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {services.map((service, index) => {
              const isExpanded = expandedId === service.id;
              const isEven = index % 2 === 0;

              return (
                <div
                  key={service.id}
                  className="group relative bg-white transition-shadow duration-300 hover:shadow-lg"
                  style={{ border: '0.5px solid rgba(27,42,74,0.1)' }}
                >
                  {/* Badge */}
                  {service.badge && (
                    <div className="absolute -top-3 right-6 sm:right-8">
                      <span className="inline-block bg-gold px-4 py-1 font-jost text-[10px] uppercase tracking-[0.14em] text-white">
                        {service.badge}
                      </span>
                    </div>
                  )}

                  {/* Main card content */}
                  <div
                    className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
                  >
                    {/* Left/Right column — visual panel */}
                    <div className="flex items-center justify-center bg-cream-2 px-8 py-10 lg:w-[320px] lg:shrink-0 lg:py-12">
                      <div className="text-center">
                        <div
                          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-gold"
                          style={{ border: '0.5px solid rgba(27,42,74,0.08)' }}
                        >
                          {service.icon}
                        </div>
                        <p className="mt-5 font-cormorant text-3xl font-light text-ink sm:text-[34px]">
                          {service.price}
                        </p>
                        {service.priceNote && (
                          <p className="mt-2 font-jost text-[12px] font-light text-ink-3">
                            {service.priceNote}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right/Left column — text content */}
                    <div className="flex-1 px-7 py-8 sm:px-10 sm:py-10">
                      <p className="font-jost text-[11px] uppercase tracking-[0.14em] text-gold">
                        {service.tagline}
                      </p>
                      <h2 className="mt-2 font-cormorant font-light text-ink text-2xl sm:text-3xl">
                        {service.title}
                      </h2>
                      <p className="mt-4 font-jost font-light text-[15px] text-ink-2 leading-relaxed max-w-xl">
                        {service.summary}
                      </p>

                      {/* Ideal for */}
                      <div className="mt-5 flex items-start gap-2.5">
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-gold"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                          />
                        </svg>
                        <p className="font-jost text-[13px] text-ink-3">
                          <span className="font-medium text-ink-2">Ideal for: </span>
                          {service.idealFor}
                        </p>
                      </div>

                      {/* Toggle details button */}
                      <button
                        type="button"
                        onClick={() => toggle(service.id)}
                        className="mt-6 flex items-center gap-2 font-jost text-[12px] uppercase tracking-[0.1em] text-gold transition-colors hover:text-ink"
                      >
                        {isExpanded ? 'Hide details' : "See what's included"}
                        <svg
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                          />
                        </svg>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div
                          className="mt-6 fade-in"
                          style={{ borderTop: '0.5px solid rgba(27,42,74,0.08)' }}
                        >
                          <h3 className="mt-6 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                            What&apos;s included
                          </h3>
                          <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                            {service.details.map((detail, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <svg
                                  className="mt-1 h-4 w-4 shrink-0 text-gold"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="font-jost font-light text-[14px] text-ink-2">
                                  {detail}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Link
                          href={`/services/${service.id}`}
                          className="inline-block bg-ink px-8 py-3.5 text-center font-jost text-[11px] uppercase tracking-[0.14em] text-cream transition-colors hover:bg-gold"
                        >
                          Get a Quote
                        </Link>
                        <Link
                          href="/cleaners"
                          className="inline-block px-8 py-3.5 text-center font-jost text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:bg-cream-2"
                          style={{ border: '0.5px solid rgba(27,42,74,0.15)' }}
                        >
                          Browse Cleaners
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust / Why Rena section */}
      <section className="bg-cream-2 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="font-jost text-[12px] uppercase tracking-[0.16em] text-gold">Why Rena</p>
            <h2 className="mt-3 font-cormorant font-light text-ink text-3xl sm:text-4xl">
              Every clean, guaranteed
            </h2>
            <div className="mx-auto mt-4 w-8 h-px bg-gold" />
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                title: 'Vetted Cleaners',
                desc: 'Every cleaner is background-checked, reviewed, and rated by real customers before they join.',
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Transparent Pricing',
                desc: 'No hidden fees. You see the full price before booking, with just a 6% service fee at checkout.',
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                ),
              },
              {
                title: 'Satisfaction Guarantee',
                desc: "Not happy? We'll send another cleaner or refund you. Your payment is held in escrow until you're satisfied.",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white px-6 py-8 text-center transition-shadow hover:shadow-md"
                style={{ border: '0.5px solid rgba(27,42,74,0.08)' }}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-2 text-gold">
                  {item.icon}
                </div>
                <h3 className="mt-5 font-cormorant text-lg font-light text-ink">{item.title}</h3>
                <p className="mt-3 font-jost text-[13px] font-light text-ink-3 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-ink py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-cormorant font-light text-cream text-3xl sm:text-4xl">
            Ready to book your clean?
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-jost font-light text-cream/70 leading-relaxed">
            Get a quote in under two minutes. Choose your service, pick your cleaner, and book a
            time that works for you.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/services/regular"
              className="inline-block bg-gold px-10 py-4 font-jost text-[12px] uppercase tracking-[0.14em] text-white transition-opacity hover:opacity-90"
            >
              Get a Quote
            </Link>
            <Link
              href="/pricing"
              className="inline-block px-10 py-4 font-jost text-[12px] uppercase tracking-[0.14em] text-cream transition-colors hover:text-white"
              style={{ border: '0.5px solid rgba(247,249,252,0.25)' }}
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
