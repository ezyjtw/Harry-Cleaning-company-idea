const steps = [
  {
    num: '01',
    title: 'Enter your postcode',
    body: 'Tell us what you need and we\u2019ll show you available, vetted cleaners nearby with real ratings and reviews.',
  },
  {
    num: '02',
    title: 'Choose someone you trust',
    body: 'Browse profiles, read verified reviews from real customers, and pick the person that feels right for your home.',
  },
  {
    num: '03',
    title: 'They arrive, you relax',
    body: 'Your cleaner arrives on time. If anything falls short, contact us within 24 hours and we\u2019ll rebook at no cost.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-cream">
      <div className="mx-auto max-w-[1240px] px-5 py-12 md:px-14 md:py-20">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-6 bg-gold" />
          <span className="font-jost text-[11px] uppercase tracking-[0.18em] text-gold">
            How it works
          </span>
        </div>
        <h2 className="mb-8 font-cormorant text-[32px] font-light leading-tight text-ink md:mb-14 md:text-[42px]">
          Booked and sorted <em className="text-ink">in minutes</em>
        </h2>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          {steps.map((step) => (
            <div key={step.num}>
              <div className="mb-5 font-cormorant text-[56px] font-light leading-none text-cream-2">
                {step.num}
              </div>
              <div className="mb-5 h-px w-8 bg-gold" />
              <h3 className="mb-2.5 font-jost text-[16px] font-normal text-ink">{step.title}</h3>
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
