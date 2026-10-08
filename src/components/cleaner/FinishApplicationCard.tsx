import Link from 'next/link';

// RENA-100 (James-ruled 2026-10-08): the web-side door back into an unfinished
// application, shown on /cleaner and on Pro Today instead of the empty jobs
// state. It links through the normal signed-in /join route, which resumes at
// the saved step.
export default function FinishApplicationCard({
  step,
  total = 7,
}: {
  step: number;
  total?: number;
}) {
  return (
    <div
      className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
      data-testid="finish-application"
    >
      <p className="font-jost text-[11px] uppercase tracking-[0.2em] text-primary">Application</p>
      <h2 className="mt-2 font-newsreader text-2xl font-semibold text-ink">
        Finish your application
      </h2>
      <p className="mt-2 font-jost text-sm font-light text-ink-2">
        You&apos;re on step {step} of {total}. Everything you have added so far is saved.
      </p>
      <Link
        href="/join"
        className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-primary px-8 py-2.5 font-jost text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover"
      >
        Continue application
      </Link>
    </div>
  );
}
