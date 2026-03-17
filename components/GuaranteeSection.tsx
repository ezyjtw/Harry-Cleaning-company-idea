function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7 1L2 3V6.5C2 9.5 4 12 7 13C10 12 12 9.5 12 6.5V3L7 1Z"
        stroke="#b8975a"
        strokeWidth="1"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="8" height="6" stroke="#b8975a" strokeWidth="1" />
      <path d="M5 6V4C5 2.9 5.9 2 7 2C8.1 2 9 2.9 9 4V6" stroke="#b8975a" strokeWidth="1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 7L6 10L11 4" stroke="#b8975a" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5.5" stroke="#b8975a" strokeWidth="1" />
      <path d="M7 4V7.5L9.5 9" stroke="#b8975a" strokeWidth="1" strokeLinecap="square" />
    </svg>
  );
}

const guarantees = [
  {
    icon: <ShieldIcon />,
    title: 'DBS checked and ID verified',
    body: 'Every cleaner passes identity and criminal record checks before their first booking.',
  },
  {
    icon: <LockIcon />,
    title: 'Payment held until you\u2019re satisfied',
    body: 'On first bookings, payment is only released once you confirm the job meets your standard.',
  },
  {
    icon: <CheckIcon />,
    title: 'Something not right? We\u2019ll fix it',
    body: 'Contact us within 24 hours of any clean that didn\u2019t meet the standard and we\u2019ll rebook at no cost.',
  },
  {
    icon: <ClockIcon />,
    title: 'No lock-in, no hidden fees',
    body: 'Cancel or reschedule with 24 hours\u2019 notice. The price you see is the price you pay.',
  },
];

export default function GuaranteeSection() {
  return (
    <section className="bg-cream">
      <div className="mx-auto grid max-w-[1240px] grid-cols-2 gap-20 px-14 pb-20">
        {/* Left */}
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px w-6 bg-gold" />
            <span className="font-jost text-[11px] uppercase tracking-[0.18em] text-gold">
              Our promise
            </span>
          </div>
          <h2 className="mb-6 font-cormorant text-[42px] font-light leading-tight text-ink">
            You&apos;re covered, <em className="text-ink">every time</em>
          </h2>
          <p className="mb-10 max-w-[440px] font-jost text-[15px] font-light leading-[1.8] text-ink-2">
            We don&apos;t simply list cleaners and hope for the best. Every booking is backed by
            thorough vetting, secure payments, and a service guarantee that actually means
            something.
          </p>
          <div className="flex gap-3">
            <a
              href="/book"
              className="bg-ink px-7 py-3.5 font-jost text-[14px] font-normal text-cream"
            >
              Book a clean
            </a>
            <a
              href="/guarantees"
              className="px-7 py-3.5 font-jost text-[14px] font-normal text-ink"
              style={{ border: '0.5px solid #0e0e0c' }}
            >
              Our guarantees
            </a>
          </div>
        </div>

        {/* Right */}
        <div style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          {guarantees.map((g, i) => (
            <div
              key={g.title}
              className="flex gap-4 px-6 py-5"
              style={
                i < guarantees.length - 1
                  ? { borderBottom: '0.5px solid rgba(14,14,12,0.06)' }
                  : undefined
              }
            >
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center"
                style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
              >
                {g.icon}
              </div>
              <div>
                <h4 className="mb-1 font-jost text-[14px] font-normal text-ink">{g.title}</h4>
                <p className="font-jost text-[13px] font-light leading-snug text-ink-3">{g.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
