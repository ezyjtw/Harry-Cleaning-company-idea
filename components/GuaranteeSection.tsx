'use client';

import { useTranslations } from 'next-intl';

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 2L4 5V9.5C4 13.5 6.5 17 10 18.5C13.5 17 16 13.5 16 9.5V5L10 2Z"
        stroke="#2F80ED"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 10L9.5 12L13 8"
        stroke="#00BFA6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IdIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="#2F80ED" strokeWidth="1.5" />
      <circle cx="8" cy="9" r="2" stroke="#00BFA6" strokeWidth="1.2" />
      <path d="M12 8H16M12 11H15" stroke="#2F80ED" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ProcessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6H16M4 10H16M4 14H11" stroke="#2F80ED" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M14 13L16 15L14 17"
        stroke="#00BFA6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="9" width="12" height="8" rx="2" stroke="#2F80ED" strokeWidth="1.5" />
      <path
        d="M7 9V6C7 4.34 8.34 3 10 3C11.66 3 13 4.34 13 6V9"
        stroke="#2F80ED"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13" r="1" fill="#00BFA6" />
    </svg>
  );
}

export default function GuaranteeSection() {
  const t = useTranslations('Guarantees');

  const guarantees = [
    { icon: <ShieldIcon />, title: t('vettedTitle'), body: t('vettedDesc') },
    { icon: <IdIcon />, title: t('idTitle'), body: t('idDesc') },
    { icon: <ProcessIcon />, title: t('onboardingTitle'), body: t('onboardingDesc') },
    { icon: <LockIcon />, title: t('insuredTitle'), body: t('insuredDesc') },
  ];

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-[1240px] px-5 py-14 md:px-14 md:py-20">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-20">
          {/* Left */}
          <div>
            <p className="mb-2 font-jost text-[12px] uppercase tracking-[0.16em] text-gold">
              {t('sectionTitle')}
            </p>
            <h2 className="mb-5 font-cormorant text-[32px] font-light leading-tight text-ink md:mb-6 md:text-[42px]">
              {t('sectionSubtitle')}
            </h2>
            <p className="mb-8 max-w-[440px] font-jost text-[15px] font-light leading-[1.8] text-ink-3 md:mb-10">
              {t('sectionDescription')}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/services"
                className="rounded-md bg-gold px-7 py-3.5 text-center font-jost text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                {t('bookClean')}
              </a>
              <a
                href="/guarantees"
                className="rounded-md px-7 py-3.5 text-center font-jost text-[14px] font-normal text-ink transition-colors hover:bg-cream-2"
                style={{ border: '1px solid rgba(27,42,74,0.15)' }}
              >
                {t('ourGuarantees')}
              </a>
            </div>
          </div>

          {/* Right */}
          <div className="rounded-lg bg-white" style={{ border: '1px solid rgba(27,42,74,0.06)' }}>
            {guarantees.map((g, i) => (
              <div
                key={g.title}
                className="flex gap-4 px-6 py-5"
                style={
                  i < guarantees.length - 1
                    ? { borderBottom: '1px solid rgba(27,42,74,0.06)' }
                    : undefined
                }
              >
                <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-lg bg-cream-2">
                  {g.icon}
                </div>
                <div>
                  <h4 className="mb-1 font-jost text-[14px] font-semibold text-ink">{g.title}</h4>
                  <p className="font-jost text-[13px] font-light leading-snug text-ink-3">
                    {g.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
