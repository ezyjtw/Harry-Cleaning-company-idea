'use client';

import { useTranslations } from 'next-intl';

export default function FooterCTA() {
  const t = useTranslations('FooterCTA');

  return (
    <section
      className="bg-cream-2 px-5 py-16 text-center md:px-14 md:py-24"
      style={{ borderTop: '1px solid rgba(27,42,74,0.06)' }}
    >
      <h2 className="mb-3 font-cormorant text-[36px] font-light text-ink md:text-[54px]">
        {t('title')}
      </h2>
      <p className="mb-9 font-jost text-[15px] font-light text-ink-3 md:text-[16px]">
        {t('subtitle')}
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <a
          href="/cleaners"
          className="rounded-md bg-gold px-9 py-3.5 font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('findCleaners')}
        </a>
        <a
          href="#how-it-works"
          className="rounded-md px-9 py-3.5 font-jost text-[14px] font-normal text-ink transition-colors hover:bg-cream"
          style={{ border: '1px solid rgba(27,42,74,0.15)' }}
        >
          {t('howItWorks')}
        </a>
      </div>
      <p className="mt-8 font-jost text-[13px] font-light text-ink-3">
        {t('areYouCleaner')}{' '}
        <a href="/join" className="font-normal text-ink hover:text-gold transition">
          {t('joinNetwork')}
        </a>
      </p>
    </section>
  );
}
