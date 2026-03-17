const reviews = [
  {
    text: 'Found a wonderful cleaner through Rena — she\u2019s been coming fortnightly for four months now. The booking process was genuinely the easiest part.',
    name: 'Sarah M.',
    location: 'Islington, London',
  },
  {
    text: 'Used Rena for an end-of-tenancy clean. The place was immaculate, the landlord was impressed, and I got my full deposit back. Worth every penny.',
    name: 'James T.',
    location: 'Clapham, London',
  },
  {
    text: 'Needed a same-day clean before guests arrived. Had someone booked within 20 minutes. The cleaner was professional, thorough, and on time.',
    name: 'Priya K.',
    location: 'Hackney, London',
  },
];

export default function ReviewsSection() {
  return (
    <section className="bg-ink">
      <div className="mx-auto max-w-[1240px] px-14 py-20">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-6 bg-gold-2" />
          <span className="font-jost text-[11px] uppercase tracking-[0.18em] text-gold-2">
            Reviews
          </span>
        </div>
        <h2 className="mb-12 font-cormorant text-[42px] font-light leading-tight text-cream">
          What people <em className="text-cream">actually say</em>
        </h2>

        <div className="grid grid-cols-3" style={{ border: '0.5px solid rgba(255,255,255,0.1)' }}>
          {reviews.map((review, i) => (
            <div
              key={review.name}
              className="p-8"
              style={
                i < reviews.length - 1
                  ? { borderRight: '0.5px solid rgba(255,255,255,0.08)' }
                  : undefined
              }
            >
              <div className="mb-3 font-jost text-[12px] tracking-[3px] text-gold-2">★★★★★</div>
              <p className="mb-4 font-jost text-[14px] font-light leading-[1.8] text-white/65">
                &ldquo;{review.text}&rdquo;
              </p>
              <p>
                <span className="font-jost text-[12px] tracking-wide text-gold-2">
                  {review.name}
                </span>
                <span className="font-jost text-[12px] font-light text-white/35">
                  {' '}
                  · {review.location}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
