'use client';

import { useTranslations } from 'next-intl';

export default function StatsBar() {
  const t = useTranslations('Stats');

  const stats = [
    { value: t('ratingValue'), label: t('ratingLabel') },
    { value: t('rebookValue'), label: t('rebookLabel') },
    { value: t('bookingTimeValue'), label: t('bookingTimeLabel') },
    { value: t('sameDayValue'), label: t('sameDayLabel') },
  ];

  return (
    <section className="grid grid-cols-2 gap-y-6 bg-ink px-5 py-6 md:flex md:justify-center md:px-14 md:py-5">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`px-4 text-center md:px-12 ${i % 2 === 0 ? 'border-r border-white/10 md:border-r-0' : ''} ${i < stats.length - 1 ? 'md:border-r md:border-white/10' : ''}`}
        >
          <div className="font-newsreader text-[26px] font-medium text-white md:text-[30px]">
            {stat.value}
          </div>
          <div className="mt-1 font-jost text-[10px] tracking-[0.09em] text-white/60 md:text-[11px]">
            {stat.label}
          </div>
        </div>
      ))}
    </section>
  );
}
