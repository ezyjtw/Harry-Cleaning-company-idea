export default function AvailableNowBadge({ responseTime }: { responseTime?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Available Now
      {responseTime && (
        <span className="text-green-500 font-normal">&middot; {responseTime}</span>
      )}
    </span>
  );
}
