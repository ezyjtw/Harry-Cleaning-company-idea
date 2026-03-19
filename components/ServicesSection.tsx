'use client';

import Link from 'next/link';
import { useState } from 'react';

const services = [
  {
    id: 'regular',
    title: 'Regular cleaning',
    description:
      'Weekly or fortnightly visits with your preferred cleaner. Consistent quality at a time that works for you.',
    price: 'From £18/hr',
    priceNote: 'per hour',
  },
  {
    id: 'one-off',
    title: 'One-off clean',
    description:
      'No subscription, no commitment. Book a single visit whenever your home needs attention.',
    price: 'From £18/hr',
    priceNote: 'per hour',
  },
  {
    id: 'deep',
    title: 'Deep cleaning',
    description:
      'Top-to-bottom. Inside appliances, skirting boards, and every corner. A thorough reset for your home.',
    price: 'From £25/hr',
    priceNote: 'per hour',
  },
  {
    id: 'end-of-tenancy',
    title: 'End of tenancy',
    description:
      'Landlord-ready cleaning with a satisfaction guarantee. Give yourself the best chance of your deposit back.',
    price: 'Approx. £160',
    priceNote: 'per property',
  },
  {
    id: 'airbnb',
    title: 'Airbnb cleaning',
    description:
      'Fast, reliable turnarounds between guests. Checklist-based, linen-ready, every time.',
    price: 'Approx. £60',
    priceNote: 'per turnover',
  },
];

export default function ServicesSection() {
  const [active, setActive] = useState(0);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-gold">
          Our services
        </p>
        <h2 className="mb-10 font-cormorant text-[32px] font-light leading-tight text-ink md:mb-14 md:text-[42px]">
          Whatever your home needs
        </h2>

        {/* Tabs */}
        <div
          className="mb-8 flex gap-1 overflow-x-auto md:mb-10"
          style={{ borderBottom: '1px solid rgba(27,42,74,0.08)' }}
        >
          {services.map((svc, i) => (
            <button
              key={svc.id}
              onClick={() => setActive(i)}
              className={`whitespace-nowrap px-4 py-3 font-jost text-[13px] transition-colors md:px-6 md:text-[14px] ${
                active === i
                  ? 'border-b-2 border-gold font-medium text-ink'
                  : 'font-normal text-ink-3 hover:text-ink-2'
              }`}
            >
              {svc.title}
            </button>
          ))}
        </div>

        {/* Active service content */}
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="mb-3 font-jost text-[22px] font-semibold text-ink md:text-[26px]">
              {services[active].title}
            </h3>
            <p className="mb-6 font-jost text-[15px] font-light leading-[1.8] text-ink-3 md:text-[16px]">
              {services[active].description}
            </p>
            <div className="mb-6 flex items-baseline gap-2">
              <span className="font-cormorant text-[36px] font-light text-ink md:text-[42px]">
                {services[active].price}
              </span>
              <span className="font-jost text-[13px] text-ink-3">{services[active].priceNote}</span>
            </div>
            <Link
              href={`/services/${services[active].id}`}
              className="inline-block rounded-md bg-gold px-7 py-3 font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Learn more
            </Link>
          </div>

          {/* Service cards grid on right */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {services.map((svc, i) => (
              <button
                key={svc.id}
                onClick={() => setActive(i)}
                className={`rounded-lg p-5 text-left transition-all ${
                  active === i ? 'bg-cream-2 ring-1 ring-gold/30' : 'bg-cream hover:bg-cream-2'
                }`}
              >
                <p className="mb-1 font-jost text-[14px] font-semibold text-ink">{svc.title}</p>
                <p className="font-jost text-[12px] text-ink-3">{svc.price}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
