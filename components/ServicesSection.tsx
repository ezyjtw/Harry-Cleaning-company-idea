import Link from 'next/link';

const services = [
  {
    id: 'regular',
    tag: 'Most popular',
    title: 'Regular cleaning',
    body: 'Weekly or fortnightly visits with your preferred cleaner, locked in at a consistent time.',
    price: 'From £18 / hr',
  },
  {
    id: 'one-off',
    tag: 'Flexible',
    title: 'One-off clean',
    body: 'No subscription, no commitment. Book a single visit whenever your home needs attention.',
    price: 'From £18 / hr',
  },
  {
    id: 'same-day',
    tag: 'Urgent',
    title: 'Same-day clean',
    body: 'Available cleaners in your area, booked within the hour. Ideal for last-minute needs.',
    price: 'From £22 / hr',
  },
  {
    id: 'deep',
    tag: 'Thorough',
    title: 'Deep clean',
    body: 'Top-to-bottom. Inside appliances, skirting boards, and every corner you\u2019ve been putting off.',
    price: 'From £120',
  },
  {
    id: 'end-of-tenancy',
    tag: 'Moving out',
    title: 'End of tenancy',
    body: 'Landlord-ready cleaning with a satisfaction guarantee. Give yourself the best chance of your deposit back.',
    price: 'From £160',
  },
  {
    id: 'airbnb',
    tag: 'Hosts',
    title: 'Airbnb cleaning',
    body: 'Fast, reliable turnarounds between guests. Checklist-based, linen-ready, every time.',
    price: 'From £60',
  },
];

export default function ServicesSection() {
  return (
    <section className="bg-cream-2">
      <div className="mx-auto max-w-[1240px] px-14 py-20">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px w-6 bg-gold" />
          <span className="font-jost text-[11px] uppercase tracking-[0.18em] text-gold">
            Services
          </span>
        </div>
        <h2 className="mb-12 font-cormorant text-[42px] font-light leading-tight text-ink">
          Whatever your home <em className="text-ink">needs</em>
        </h2>

        <div className="grid grid-cols-3" style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}>
          {services.map((svc, i) => (
            <Link
              key={svc.title}
              href={`/services/${svc.id}`}
              className="group block p-8 transition-colors hover:bg-white"
              style={{
                borderRight: i % 3 !== 2 ? '0.5px solid rgba(14,14,12,0.1)' : undefined,
                borderBottom: i < 3 ? '0.5px solid rgba(14,14,12,0.1)' : undefined,
              }}
            >
              <p className="mb-3 font-jost text-[10px] uppercase tracking-[0.14em] text-gold">
                {svc.tag}
              </p>
              <h3 className="mb-2 font-jost text-[17px] font-normal text-ink">{svc.title}</h3>
              <p className="mb-4 font-jost text-[13px] font-light leading-relaxed text-ink-3">
                {svc.body}
              </p>
              <p className="font-jost text-[13px] font-light text-ink-2">
                {svc.price} <span className="text-gold">→</span>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
