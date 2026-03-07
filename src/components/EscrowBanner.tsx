import { getEscrowStatusLabel } from "@/lib/trust";
import type { EscrowStatus } from "@/lib/types";

interface Props {
  status: EscrowStatus;
  isFirstBooking: boolean;
  cleanerName: string;
  amount: number;
}

export default function EscrowBanner({
  status,
  isFirstBooking,
  cleanerName,
  amount,
}: Props) {
  const statusInfo = getEscrowStatusLabel(status);

  if (status === "none") return null;

  return (
    <div className={`rounded-lg border p-4 ${
      status === "held"
        ? "border-amber-200 bg-amber-50"
        : status === "released"
        ? "border-green-200 bg-green-50"
        : status === "disputed"
        ? "border-red-200 bg-red-50"
        : "border-blue-200 bg-blue-50"
    }`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {status === "held" && (
            <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
          )}
          {status === "released" && (
            <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          {status === "disputed" && (
            <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm">
            <span className={statusInfo.color.split(" ")[0]}>{statusInfo.label}</span>
          </div>
          {status === "held" && (
            <p className="mt-1 text-xs text-amber-700">
              {isFirstBooking ? (
                <>
                  This is your first booking with {cleanerName}.
                  Your payment of <strong>${amount.toFixed(2)}</strong> is held securely in escrow.
                  It will be released once you confirm the job is complete, or automatically after 24 hours.
                </>
              ) : (
                <>
                  Your payment of <strong>${amount.toFixed(2)}</strong> is held securely.
                  It will be automatically released 24 hours after the job is marked complete.
                </>
              )}
            </p>
          )}
          {status === "held" && isFirstBooking && (
            <div className="mt-3 flex gap-2">
              <button className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                Confirm &amp; Release Payment
              </button>
              <button className="rounded bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200">
                Open Dispute
              </button>
            </div>
          )}
          {status === "released" && (
            <p className="mt-1 text-xs text-green-700">
              Payment of ${amount.toFixed(2)} has been released to {cleanerName}.
            </p>
          )}
          {status === "disputed" && (
            <p className="mt-1 text-xs text-red-700">
              Payment is frozen while the dispute is being reviewed.
              Both parties can submit evidence. Resolution typically takes 24–48 hours.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
