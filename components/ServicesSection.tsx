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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-ink-3 transition-transform duration-200 motion-reduce:transition-none ${
        open ? 'rotate-180' : ''
      }`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
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
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  soon?: boolean;
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
      {soon && (
        <span
          className="rounded-full bg-primary-soft px-1.5 py-0.5 font-jost text-[10px] font-semibold uppercase tracking-normal text-primary"
          style={{ textIndent: 0 }}
        >
          Soon
        </span>
      )}
    </button>
  );
}

function priceParts(price: string) {
  const hasHr = /\/hr\s*$/.test(price);
  return { main: hasHr ? price.replace(/\/hr\s*$/, '') : price, hasHr };
}

export default function ServicesSection() {
  const t = useTranslations('Services');

  // Bookable services first; Same Day (coming soon) always last.
  const services = [
    {
      id: 'regular',
      label: t('regularLabel'),
      title: t('regular'),
      description: t('regularDesc'),
      price: t('regularPrice'),
      includes: t.raw('regularIncludes') as string[],
      soon: false,
    },
    {
      id: 'deep',
      label: t('deepLabel'),
      title: t('deep'),
      description: t('deepDesc'),
      price: t('deepPrice'),
      includes: t.raw('deepIncludes') as string[],
      soon: false,
    },
    {
      id: 'end-of-tenancy',
      label: t('eotLabel'),
      title: t('eot'),
      description: t('eotDesc'),
      price: t('eotPrice'),
      includes: t.raw('eotIncludes') as string[],
      soon: false,
    },
    {
      id: 'airbnb',
      label: t('airbnbLabel'),
      title: t('airbnb'),
      description: t('airbnbDesc'),
      price: t('airbnbPrice'),
      includes: t.raw('airbnbIncludes') as string[],
      soon: false,
    },
    {
      id: 'same-day',
      label: t('sameDayLabel'),
      title: t('sameDay'),
      description: t('sameDayDesc'),
      price: t('sameDayPrice'),
      includes: t.raw('sameDayIncludes') as string[],
      soon: true,
    },
  ];

  const firstBookableId = services.find((s) => !s.soon)?.id ?? services[0].id;
  const [active, setActive] = useState(0); // desktop tab
  const [openId, setOpenId] = useState<string>(firstBookableId); // mobile accordion

  const current = services[active];
  const currentImg = SERVICE_IMAGES[current.id];
  const currentPrice = priceParts(current.price);

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          {t('sectionTitle')}
        </p>
        <h2 className="mb-8 font-newsreader text-[32px] font-medium leading-tight text-ink md:mb-12 md:text-[42px]">
          {t('sectionSubtitle')}
        </h2>

        {/* ── Desktop (md+): tab row + panel ── */}
        <div className="hidden overflow-hidden rounded-[22px] border border-line bg-surface md:block">
          <div className="flex items-center gap-2 overflow-x-auto border-b border-line p-3 scrollbar-hide">
            {services.map((svc, i) => (
              <Tab
                key={svc.id}
                label={svc.label}
                active={active === i}
                soon={svc.soon}
                disabled={svc.soon}
                onClick={() => !svc.soon && setActive(i)}
              />
            ))}
          </div>

          <div className="grid min-h-[235px] grid-cols-[1.05fr_0.95fr]">
            <div className="p-9">
              <h3 className="mb-2 font-newsreader text-[26px] font-semibold text-ink">
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
                  {currentPrice.main}
                  {currentPrice.hasHr && (
                    <span className="font-jost text-[15px] font-normal text-ink-2">/hr</span>
                  )}
                </span>
                <Link
                  href={`/services/${current.id}`}
                  className="rounded-[10px] bg-primary px-6 py-3 text-center font-jost text-[14px] font-medium text-white transition-colors hover:bg-primary-hover"
                >
                  {t('getQuote')}
                </Link>
              </div>
            </div>
            <div className="relative overflow-hidden">
              {currentImg ? (
                <Image
                  key={current.id}
                  src={currentImg}
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

        {/* ── Mobile (below md): accordion ── */}
        <div className="overflow-hidden rounded-[22px] border border-line bg-surface md:hidden">
          {services.map((svc, i) => {
            const open = !svc.soon && openId === svc.id;
            const img = SERVICE_IMAGES[svc.id];
            const { main, hasHr } = priceParts(svc.price);
            return (
              <div key={svc.id} className={i > 0 ? 'border-t border-line' : ''}>
                <button
                  type="button"
                  disabled={svc.soon}
                  onClick={() => !svc.soon && setOpenId(open ? '' : svc.id)}
                  aria-expanded={open}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left ${
                    svc.soon ? 'cursor-default' : ''
                  }`}
                >
                  <span
                    className={`font-newsreader text-[16px] font-medium ${
                      svc.soon ? 'text-ink-3' : 'text-ink'
                    }`}
                  >
                    {svc.label}
                    {svc.soon && (
                      <span className="ml-2 rounded-full bg-primary-soft px-1.5 py-0.5 align-middle font-jost text-[10px] font-semibold uppercase tracking-normal text-primary">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-jost text-[13px] text-ink-3">{svc.price}</span>
                    {!svc.soon && <Chevron open={open} />}
                  </span>
                </button>

                {!svc.soon && (
                  <div
                    className={`overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none ${
                      open ? 'max-h-[760px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 pb-6">
                      <div className="relative mb-4 h-[110px] w-full overflow-hidden rounded-[12px]">
                        {img ? (
                          <Image src={img} alt={svc.title} fill className="object-cover" />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-primary-soft to-wash-to" />
                        )}
                      </div>
                      <p className="mb-4 text-sm leading-relaxed text-ink-2">{svc.description}</p>
                      <ul className="mb-5 space-y-2">
                        {svc.includes.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckIcon />
                            <span className="font-jost text-[13px] leading-snug text-ink">
                              {item}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-newsreader text-[22px] font-medium text-ink">
                          {main}
                          {hasHr && (
                            <span className="font-jost text-[14px] font-normal text-ink-2">
                              /hr
                            </span>
                          )}
                        </span>
                        <Link
                          href={`/services/${svc.id}`}
                          className="rounded-[10px] bg-primary px-5 py-2.5 font-jost text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
                        >
                          {t('getQuote')}
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
