'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const SERVICE_IMAGES: Record<string, string> = {
  regular: '/images/Regular cleaning.png',
  'same-day': '/images/Same day cleaning.png',
  deep: '/images/Deep cleaning.png',
  'end-of-tenancy': '/images/End of Tenancy.png',
  airbnb: '/images/Air BnB cleaning.png',
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 text-trust"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

// One tab component, used for every service → uniform padding/gap/tracking by
// construction. Labels are letter-spaced with a matching text-indent so they
// stay optically centred despite the trailing tracking.
function Tab({
  label,
  active,
  soon,
  soonLabel,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  soon?: boolean;
  soonLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-[9px] font-jost text-[12px] font-semibold uppercase tracking-[0.06em] transition-colors ${
        active ? 'bg-primary text-white' : soon ? 'text-ink-3' : 'text-ink-2 hover:text-ink'
      } ${disabled ? 'cursor-default' : ''}`}
      style={{ textIndent: '0.06em' }}
    >
      {label}
      {soon && soonLabel && (
        <span
          className="rounded-full bg-primary-soft px-1.5 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-normal text-primary"
          style={{ textIndent: 0 }}
        >
          {soonLabel}
        </span>
      )}
    </button>
  );
}

export default function ServicesSection() {
  const [active, setActive] = useState(0);
  const t = useTranslations('Services');

  const services = [
    {
      id: 'regular',
      title: t('regular'),
      description: t('regularDesc'),
      price: t('regularPrice'),
      includes: t.raw('regularIncludes') as string[],
    },
    {
      id: 'same-day',
      title: t('sameDay'),
      description: t('sameDayDesc'),
      price: t('sameDayPrice'),
      includes: t.raw('sameDayIncludes') as string[],
    },
    {
      id: 'deep',
      title: t('deep'),
      description: t('deepDesc'),
      price: t('deepPrice'),
      includes: t.raw('deepIncludes') as string[],
    },
    {
      id: 'end-of-tenancy',
      title: t('eot'),
      description: t('eotDesc'),
      price: t('eotPrice'),
      includes: t.raw('eotIncludes') as string[],
    },
    {
      id: 'airbnb',
      title: t('airbnb'),
      description: t('airbnbDesc'),
      price: t('airbnbPrice'),
      includes: t.raw('airbnbIncludes') as string[],
    },
  ];

  const current = services[active];
  const img = SERVICE_IMAGES[current.id];
  const hasHr = /\/hr\s*$/.test(current.price);
  const priceMain = hasHr ? current.price.replace(/\/hr\s*$/, '') : current.price;

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          {t('sectionTitle')}
        </p>
        <h2 className="mb-8 font-newsreader text-[32px] font-medium leading-tight text-ink md:mb-12 md:text-[42px]">
          {t('sectionSubtitle')}
        </h2>

        <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
          {/* Tab row — horizontally scrollable on mobile, hairline bottom border */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-line p-3 scrollbar-hide">
            {services.map((svc, i) => {
              const isSameDay = svc.id === 'same-day';
              return (
                <Tab
                  key={svc.id}
                  label={svc.title}
                  active={active === i}
                  soon={isSameDay}
                  soonLabel={isSameDay ? 'Soon' : undefined}
                  disabled={isSameDay}
                  onClick={() => !isSameDay && setActive(i)}
                />
              );
            })}
          </div>

          {/* Panel */}
          <div className="flex flex-col md:grid md:min-h-[235px] md:grid-cols-[1.05fr_0.95fr]">
            {/* LEFT — content */}
            <div className="order-2 p-6 md:order-1 md:p-9">
              <h3 className="mb-2 font-newsreader text-[22px] font-semibold text-ink md:text-[26px]">
                {current.title}
              </h3>
              <p className="mb-5 max-w-[440px] text-sm leading-relaxed text-ink-2">
                {current.description}
              </p>

              <ul className="mb-6 space-y-2">
                {current.includes.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="font-jost text-[13px] leading-snug text-ink">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <span className="font-newsreader text-[24px] font-medium text-ink">
                  {priceMain}
                  {hasHr && (
                    <span className="font-jost text-[15px] font-normal text-ink-2">/hr</span>
                  )}
                </span>
                <Link
                  href={`/services/${current.id}`}
                  className="w-full rounded-[10px] bg-primary px-6 py-3 text-center font-jost text-[14px] font-medium text-white transition-colors hover:bg-primary-hover sm:w-auto"
                >
                  {t('getQuote')}
                </Link>
              </div>
            </div>

            {/* RIGHT — full-bleed photo (or wash-gradient placeholder) */}
            <div className="relative order-1 h-[180px] w-full overflow-hidden md:order-2 md:h-auto md:min-h-[235px]">
              {img ? (
                <Image
                  key={current.id}
                  src={img}
                  alt={current.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary-soft to-wash-to" />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
