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
  icon: string;
  featured?: boolean;
}[] = [
  {
    id: 'regular',
    title: 'Regular Cleaning',
    description:
      'Recurring weekly or fortnightly cleans to keep your home consistently fresh. Lock in a lower rate with a regular schedule.',
    icon: '&#128694;',
    featured: true,
  },
  {
    id: 'one-off',
    title: 'One-Off Cleaning',
    description:
      'A single clean for when you need a refresh. No commitment, no subscription — just a spotless home.',
    icon: '&#10024;',
  },
  {
    id: 'same-day',
    title: 'Same Day Cleaning',
    description:
      "Need a clean today? We'll match you with available cleaners near you for a same-day booking.",
    icon: '&#9889;',
  },
  {
    id: 'deep',
    title: 'Deep Cleaning',
    description:
      'A thorough, top-to-bottom clean. Inside cupboards, behind appliances, skirting boards — the works.',
    icon: '&#128171;',
  },
  {
    id: 'airbnb',
    title: 'AirBnB Cleaning',
    description:
      'Fast turnaround cleans between guests. Linen changes, restocking, and a spotless space for your next visitors.',
    icon: '&#127968;',
  },
  {
    id: 'end-of-tenancy',
    title: 'End of Tenancy Cleaning',
    description:
      'Moving out? Get your deposit back with a professional end-of-tenancy deep clean that meets landlord standards.',
    icon: '&#128230;',
  },
];

export default function ServicesPage() {
  const featured = services.find((s) => s.featured);
  const others = services.filter((s) => !s.featured);

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
          {/* Featured: Regular Cleaning */}
          {featured && (
            <Link
              href={`/services/${featured.id}`}
              className="group flex flex-col items-center bg-cream p-10 text-center transition hover:bg-white sm:p-14"
              style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
            >
              <div
                className="flex h-20 w-20 items-center justify-center bg-cream-2 text-4xl transition group-hover:bg-cream sm:h-24 sm:w-24 sm:text-5xl"
                dangerouslySetInnerHTML={{ __html: featured.icon }}
              />
              <h2 className="mt-6 font-cormorant font-light text-ink text-xl group-hover:text-gold sm:text-2xl">
                {featured.title}
              </h2>
              <p className="mt-3 max-w-md font-jost font-light text-sm text-ink-2 sm:text-base">
                {featured.description}
              </p>
              <span className="mt-6 inline-block bg-ink px-8 py-3 font-jost text-[11px] uppercase tracking-[0.1em] text-cream transition group-hover:bg-gold sm:px-10 sm:py-3.5">
                Get a Quote
              </span>
            </Link>
          )}

          {/* Other services */}
          <div className="mt-8 grid gap-px bg-cream sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.id}`}
                className="group flex flex-col bg-cream p-6 transition hover:bg-white sm:p-8"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center bg-cream-2 text-2xl transition group-hover:bg-cream sm:h-14 sm:w-14 sm:text-3xl"
                  dangerouslySetInnerHTML={{ __html: service.icon }}
                />
                <h2 className="mt-4 font-cormorant font-light text-ink text-base group-hover:text-gold sm:mt-5 sm:text-lg">
                  {service.title}
                </h2>
                <p className="mt-2 flex-1 font-jost font-light text-sm text-ink-3">
                  {service.description}
                </p>
                <span className="mt-4 font-jost text-[11px] uppercase tracking-[0.1em] text-gold group-hover:text-ink sm:mt-5">
                  Get a Quote &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
