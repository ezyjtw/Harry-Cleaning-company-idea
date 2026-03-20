const stats = [
  { value: '4.8', label: 'Average rating' },
  { value: '96%', label: 'Rebook their cleaner' },
  { value: '<2 min', label: 'Average booking time' },
  { value: 'Same day', label: 'Available in most areas' },
];

export default function StatsBar() {
  return (
    <section className="grid grid-cols-2 gap-y-6 bg-ink px-5 py-6 md:flex md:justify-center md:px-14 md:py-5">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`px-4 text-center md:px-12 ${i % 2 === 0 ? 'border-r border-white/10 md:border-r-0' : ''} ${i < stats.length - 1 ? 'md:border-r md:border-white/10' : ''}`}
        >
          <div className="font-cormorant text-[26px] font-light text-gold-2 md:text-[30px]">
            {stat.value}
          </div>
          <div className="mt-1 font-jost text-[10px] tracking-[0.09em] text-white/60 md:text-[11px]">
            {stat.label}
          </div>
        </div>
      ))}
    </section>
  );
}
