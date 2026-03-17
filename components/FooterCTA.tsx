export default function FooterCTA() {
  return (
    <section
      className="bg-cream-2 px-14 py-24 text-center"
      style={{ borderTop: '0.5px solid rgba(14,14,12,0.1)' }}
    >
      <h2 className="mb-3 font-cormorant text-[54px] font-light text-ink">
        Your home, <em className="text-gold">properly clean</em>
      </h2>
      <p className="mb-9 font-jost text-[16px] font-light text-ink-2">
        Find a trusted cleaner near you — book in under two minutes.
      </p>
      <div className="flex justify-center gap-3">
        <a
          href="/cleaners"
          className="bg-ink px-9 py-3.5 font-jost text-[14px] font-normal text-cream"
        >
          Find cleaners near me
        </a>
        <a
          href="#how-it-works"
          className="px-9 py-3.5 font-jost text-[14px] font-normal text-ink"
          style={{ border: '0.5px solid #0e0e0c' }}
        >
          How it works
        </a>
      </div>
    </section>
  );
}
