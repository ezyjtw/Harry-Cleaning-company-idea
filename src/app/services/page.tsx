import type { Metadata } from 'next';
import Link from 'next/link';

import type { ServiceCategory } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Our Services',
  description:
    'Browse our range of cleaning services — from regular weekly cleans to deep end-of-tenancy jobs. Book in minutes.',
};

const services: {
  id: ServiceCategory;
  title: string;
  description: string;
  price: string;
}[] = [
  {
    id: 'regular',
    title: 'Regular Cleaning',
    description:
      'Recurring weekly or fortnightly cleans to keep your home consistently fresh. Lock in a lower rate with a regular schedule.',
    price: 'From £18/hr',
  },
  {
    id: 'same-day',
    title: 'Same Day Cleaning',
    description:
      "Need a clean today? We'll match you with a vetted, available cleaner near you for a same-day visit at short notice.",
    price: 'From £22/hr',
  },
  {
    id: 'one-off',
    title: 'One-Off Cleaning',
    description:
      'A single clean for when you need a refresh. No commitment, no subscription — just a spotless home.',
    price: 'From £18/hr',
  },
  {
    id: 'deep',
    title: 'Deep Cleaning',
    description:
      'A thorough, top-to-bottom clean. Inside cupboards, behind appliances, skirting boards — the works.',
    price: 'From £25/hr',
  },
  {
    id: 'airbnb',
    title: 'AirBnB Cleaning',
    description:
      'Fast turnaround cleans between guests. Linen changes, restocking, and a spotless space for your next visitors.',
    price: 'Approx. £60',
  },
  {
    id: 'end-of-tenancy',
    title: 'End of Tenancy Cleaning',
    description:
      'Moving out? Get your deposit back with a professional end-of-tenancy deep clean that meets landlord standards.',
    price: 'Approx. £160',
  },
];

export default function ServicesPage() {
  return (
    <>
      <section className="bg-cream py-16 sm:py-20">
        <div className="container-page text-center">
          <h1 className="font-cormorant font-light text-ink text-4xl sm:text-5xl">
            What type of clean do you need?
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-jost font-light text-ink-2">
            Select a service to get started with your booking.
          </p>
        </div>
      </section>

      <section className="section bg-cream-2">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.id}`}
                className="group flex flex-col bg-cream p-7 transition hover:bg-white sm:p-8"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <h2 className="font-cormorant font-light text-ink text-xl group-hover:text-gold">
                  {service.title}
                </h2>
                <p className="mt-3 flex-1 font-jost font-light text-sm leading-relaxed text-ink-3">
                  {service.description}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-cormorant font-light text-lg text-ink">
                    {service.price}
                  </span>
                  <span className="font-jost text-[11px] uppercase tracking-[0.1em] text-gold group-hover:text-ink transition">
                    Get a Quote &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
