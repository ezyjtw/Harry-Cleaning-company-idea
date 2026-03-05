export default function CategoryRatingBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-sm text-gray-600">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-medium text-gray-700">
        {value.toFixed(1)}
      </span>
    </div>
  );
}
