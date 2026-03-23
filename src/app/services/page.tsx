'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ServiceCategory } from '@/lib/types';

const services: {
  id: ServiceCategory;
  title: string;
  summary: string;
  details: string[];
  price: string;
}[] = [
  {
    id: 'regular',
    title: 'Regular Cleaning',
    summary: 'Recurring weekly or fortnightly cleans to keep your home consistently fresh.',
    details: [
      'Dusting all accessible surfaces, shelves, and furniture',
      'Vacuuming and mopping all floors',
      'Kitchen surfaces wiped down, sink cleaned, appliance exteriors polished',
      'Bathrooms cleaned including toilet, shower, bath, and mirrors',
      'Bins emptied and liners replaced',
      'Beds made and light tidying',
      'Lock in a lower rate with a regular schedule — save up to 10%',
    ],
    price: 'From £15.40/hr',
  },
  {
    id: 'same-day',
    title: 'Same Day Cleaning',
    summary:
      'Need a clean today? We match you with a vetted, available cleaner near you at short notice.',
    details: [
      'All standard cleaning tasks covered',
      'Matched with a nearby, available cleaner within hours',
      'Ideal for unexpected guests, viewings, or last-minute needs',
      'Same high standards as a regular clean, just faster booking',
      'Subject to cleaner availability in your area',
    ],
    price: 'From £20.02/hr',
  },
  {
    id: 'deep',
    title: 'Deep Cleaning',
    summary:
      'A thorough top-to-bottom clean. Inside cupboards, behind appliances, skirting boards — the works.',
    details: [
      'Everything in a standard clean, plus much more',
      'Inside oven, fridge, and kitchen cupboards cleaned',
      'Behind and beneath furniture and appliances',
      'Skirting boards, door frames, and light switches wiped',
      'Limescale removal in bathrooms',
      'Window sills and interior glass cleaned',
      'Ideal before or after a big event, or as a seasonal refresh',
    ],
    price: 'From £22.33/hr',
  },
  {
    id: 'airbnb',
    title: 'AirBnB Cleaning',
    summary:
      'Fast turnaround cleans between guests. Linen changes, restocking, and a spotless space.',
    details: [
      'Full property clean to guest-ready standard',
      'Linen and towel changes',
      'Restocking of essentials (toiletries, tea, coffee) if provided',
      'Kitchen reset — dishwasher emptied, surfaces cleared and wiped',
      'Bathroom deep clean with fresh towels laid out',
      'Quick turnaround times to fit between check-out and check-in',
      'Consistent quality your guests will notice in their reviews',
    ],
    price: 'From £55',
  },
  {
    id: 'end-of-tenancy',
    title: 'End of Tenancy Cleaning',
    summary:
      'Moving out? Get your deposit back with a professional clean that meets landlord standards.',
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
  },
];

export default function ServicesPage() {
  const [openId, setOpenId] = useState<ServiceCategory | null>(null);

  const toggle = (id: ServiceCategory) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <>
      <section className="bg-cream py-16 sm:py-20">
        <div className="container-page text-center">
          <h1 className="font-cormorant font-light text-ink text-4xl sm:text-5xl">
            What type of clean do you need?
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-jost font-light text-ink-2">
            Select a service below to learn more, then get a quote in minutes.
          </p>
        </div>
      </section>

      <section className="section bg-cream-2">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-0">
            {services.map((service) => {
              const isOpen = openId === service.id;
              return (
                <div key={service.id} style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
                  {/* Headline row */}
                  <button
                    type="button"
                    onClick={() => toggle(service.id)}
                    className="w-full flex items-center justify-between bg-cream px-7 py-6 text-left transition hover:bg-white sm:px-8"
                  >
                    <div>
                      <h2 className="font-cormorant font-light text-ink text-xl sm:text-2xl">
                        {service.title}
                      </h2>
                      <span className="mt-1 block font-cormorant font-light text-lg text-ink-3">
                        {service.price}
                      </span>
                    </div>
                    <span
                      className={`font-jost text-lg text-ink-3 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    >
                      &#9660;
                    </span>
                  </button>

                  {/* Expandable detail box */}
                  {isOpen && (
                    <div
                      className="bg-cream-2 px-7 pb-8 pt-6 sm:px-8"
                      style={{
                        borderTop: '0.5px solid rgba(14,14,12,0.1)',
                      }}
                    >
                      <p className="font-jost font-light text-sm text-ink-2 leading-relaxed">
                        {service.summary}
                      </p>

                      <h3 className="mt-6 font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3">
                        What&apos;s included
                      </h3>
                      <ul className="mt-4 space-y-2.5">
                        {service.details.map((detail, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 font-jost font-light text-sm text-ink-2"
                          >
                            <span className="mt-0.5 shrink-0 text-gold">&#10003;</span>
                            {detail}
                          </li>
                        ))}
                      </ul>

                      <Link
                        href={`/services/${service.id}`}
                        className="mt-8 inline-block bg-ink px-8 py-3.5 font-jost text-[11px] uppercase tracking-[0.1em] text-cream hover:bg-gold transition"
                      >
                        Get a Quote
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
