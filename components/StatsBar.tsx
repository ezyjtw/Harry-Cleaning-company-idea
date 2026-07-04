'use client';

import { useTranslations } from 'next-intl';

export default function StatsBar() {
  const t = useTranslations('Stats');

  // James-signed trust strip: three cells. Display line is Newsreader 500
  // (display-figure weight — applies to the word cells too), labels are Jost caps
  // white/60. All type flows through the CSS-var pipeline (no inline font-family).
  const stats = [
    { value: t('ratingValue'), label: t('ratingLabel') },
    { value: t('insuredValue'), label: t('insuredLabel') },
    { value: t('recommendedValue'), label: t('recommendedLabel') },
  ];

  return (
    <section className="bg-ink px-5 py-6 md:flex md:justify-center md:px-14 md:py-5">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`px-4 py-4 text-center md:px-14 md:py-0 ${
            i > 0 ? 'border-t border-white/10 md:border-l md:border-t-0' : ''
          }`}
        >
          <div className="font-newsreader text-[26px] font-medium text-white md:text-[30px]">
            {stat.value}
          </div>
          <div className="mt-1 font-jost text-[10px] uppercase tracking-[0.1em] text-white/60 md:text-[11px]">
            {stat.label}
          </div>
        </div>
      ))}
    </section>
  );
}
