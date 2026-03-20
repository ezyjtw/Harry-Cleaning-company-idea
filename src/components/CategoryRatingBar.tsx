export default function CategoryRatingBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 font-jost text-[13px] font-light text-ink-2">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-2">
        <div className="h-full rounded-full bg-ink" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="w-8 text-right font-jost text-[13px] font-medium text-ink">
        {value.toFixed(1)}
      </span>
    </div>
  );
}
