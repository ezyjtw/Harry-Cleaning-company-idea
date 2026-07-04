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
    // A single horizontal band at every width: three cells in one slim row on
    // mobile (compact height, smaller display + labels), a taller centered row on
    // desktop. Never a tall stacked block.
    <section className="flex justify-center bg-ink px-4 py-3.5 md:px-14 md:py-5">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex-1 px-2 text-center md:flex-none md:px-14 ${
            i > 0 ? 'border-l border-white/10' : ''
          }`}
        >
          <div className="font-newsreader text-[16px] font-medium leading-none text-white md:text-[30px]">
            {stat.value}
          </div>
          <div className="mt-1 font-jost text-[8px] uppercase leading-tight tracking-[0.08em] text-white/60 md:mt-1.5 md:text-[11px] md:tracking-[0.1em]">
            {stat.label}
          </div>
        </div>
      ))}
    </section>
  );
}
