'use client';

import { useTranslations } from 'next-intl';

export default function HowItWorks() {
  const t = useTranslations('HowItWorks');

  const steps = [
    { num: '01', title: t('step1Title'), body: t('step1Description') },
    { num: '02', title: t('step2Title'), body: t('step2Description') },
    { num: '03', title: t('step3Title'), body: t('step3Description') },
  ];

  return (
    <section id="how-it-works" className="bg-cream">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-gold">
          {t('sectionTitle')}
        </p>
        <h2 className="mb-10 font-cormorant text-[32px] font-light leading-tight text-ink md:mb-14 md:text-[42px]">
          {t('sectionSubtitle')}
        </h2>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          {steps.map((step) => (
            <div key={step.num}>
              <div className="mb-5 font-cormorant text-[64px] font-semibold leading-none text-ink/10 md:text-[72px]">
                {step.num}
              </div>
              <div className="mb-5 h-[2px] w-8 rounded bg-gold" />
              <h3 className="mb-2.5 font-jost text-[16px] font-semibold text-ink">{step.title}</h3>
              <p className="font-jost text-[14px] font-light leading-[1.7] text-ink-3">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
