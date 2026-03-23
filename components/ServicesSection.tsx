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
  },
  {
    id: 'same-day',
    title: 'Same day cleaning',
    description:
      "Need a cleaner today? We'll match you with a vetted, available cleaner near you for a same-day visit.",
    price: 'From £22/hr',
  },
  {
    id: 'deep',
    title: 'Deep cleaning',
    description:
      'Top-to-bottom. Inside appliances, skirting boards, and every corner. A thorough reset for your home.',
    price: 'From £25/hr',
  },
  {
    id: 'end-of-tenancy',
    title: 'End of tenancy',
    description:
      'Landlord-ready cleaning with a satisfaction guarantee. Give yourself the best chance of your deposit back.',
    price: 'Approx. £160',
  },
  {
    id: 'airbnb',
    title: 'Airbnb cleaning',
    description:
      'Fast, reliable turnarounds between guests. Checklist-based, linen-ready, every time.',
    price: 'Approx. £60',
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

        <div
          className="grid grid-cols-2 gap-0 sm:grid-cols-3 md:grid-cols-5"
          style={{ border: '1px solid rgba(27,42,74,0.08)' }}
        >
          {services.map((svc, i) => (
            <button
              key={svc.id}
              onClick={() => setActive(i)}
              className={`p-5 text-left transition-all md:p-6 ${
                active === i ? 'bg-cream-2' : 'bg-white hover:bg-cream'
              }`}
              style={{
                borderBottom: '1px solid rgba(27,42,74,0.06)',
                borderRight: '1px solid rgba(27,42,74,0.06)',
              }}
            >
              <p className="mb-1 font-jost text-[15px] font-semibold text-ink">{svc.title}</p>
              <p className="font-jost text-[12px] text-gold">{svc.price}</p>
            </button>
          ))}
        </div>

        {/* Expanded detail */}
        <div
          className="p-6 md:p-10"
          style={{ border: '1px solid rgba(27,42,74,0.08)', borderTop: 'none' }}
        >
          <div className="max-w-[600px]">
            <h3 className="mb-3 font-jost text-[20px] font-semibold text-ink md:text-[24px]">
              {services[active].title}
            </h3>
            <p className="mb-6 font-jost text-[15px] font-light leading-[1.8] text-ink-3">
              {services[active].description}
            </p>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <span className="font-cormorant text-[32px] font-light text-ink md:text-[38px]">
                {services[active].price}
              </span>
              <Link
                href={`/services/${services[active].id}`}
                className="rounded-md bg-gold px-7 py-3 font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                Get a Quote
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
