import { getVerificationLevel, getVerificationBadge } from "@/lib/trust";

interface Props {
  identityVerified: boolean;
  backgroundChecked: boolean;
  size?: "sm" | "md";
}

export default function VerificationBadge({
  identityVerified,
  backgroundChecked,
  size = "sm",
}: Props) {
  const level = getVerificationLevel(identityVerified, backgroundChecked);
  const badge = getVerificationBadge(level);

  if (level === "unverified") return null;

  const sizeClasses =
    size === "md"
      ? "px-3 py-1 text-sm"
      : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${badge.color} ${sizeClasses}`}
    >
      {level === "full" ? (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 106 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9h3M12 12h3M12 15h2"
            clipRule="evenodd"
          />
        </svg>
      )}
      {badge.label}
    </span>
  );
}
