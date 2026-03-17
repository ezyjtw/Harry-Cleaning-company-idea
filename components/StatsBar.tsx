const stats = [
  { value: '4.8', label: 'Average rating' },
  { value: '96%', label: 'Rebook their cleaner' },
  { value: '<2 min', label: 'Average booking time' },
  { value: 'Same day', label: 'Available in most areas' },
];

export default function StatsBar() {
  return (
    <section className="flex justify-center bg-ink px-14 py-5">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`px-12 text-center ${i < stats.length - 1 ? 'border-r border-white/10' : ''}`}
        >
          <div className="font-cormorant text-[30px] font-light text-gold-2">{stat.value}</div>
          <div className="mt-1 font-jost text-[11px] tracking-[0.09em] text-white/40">
            {stat.label}
          </div>
        </div>
      ))}
    </section>
  );
}
