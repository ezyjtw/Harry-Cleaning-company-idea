'use client';

// RENA-059 (D-b, B1b, James-ruled): the in-shell analytics ask. Two choices,
// the same ones the website offers in substance (analytics on or off;
// marketing is never switched on here), plus the privacy and settings door.
// Shown once on the first signed-in entry pane when the account has no
// answer; changeable later from the profile room. Shell-only: the website
// never renders it (CookieConsent gates on the shell user agent).
export default function ShellConsentSheet({
  onAllow,
  onEssential,
}: {
  onAllow: () => void;
  onEssential: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end bg-ink/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shell-consent-title"
      data-testid="shell-consent-sheet"
    >
      <div className="w-full rounded-t-2xl bg-surface px-5 pb-8 pt-6 shadow-lg">
        <h2 id="shell-consent-title" className="font-newsreader text-xl font-semibold text-ink">
          Help us improve Rena
        </h2>
        <p className="mt-2 font-jost text-[14px] font-light leading-relaxed text-ink-2">
          With your permission we measure how the app is used, such as which screens you visit and
          where a step goes wrong, so we can fix it. Nothing is measured unless you allow it. You
          can change this any time from your profile.
        </p>
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={onAllow}
            data-testid="shell-consent-allow"
            className="w-full rounded-[10px] bg-primary py-3.5 font-jost text-[13px] font-semibold uppercase tracking-[0.1em] text-white active:opacity-90"
          >
            Allow analytics
          </button>
          <button
            type="button"
            onClick={onEssential}
            data-testid="shell-consent-essential"
            className="w-full rounded-[10px] border border-line bg-surface py-3.5 font-jost text-[13px] font-semibold uppercase tracking-[0.1em] text-ink active:bg-page"
          >
            Essential only
          </button>
        </div>
        <a
          href="/privacy#cookies"
          data-testid="shell-consent-privacy"
          className="mt-4 block text-center font-jost text-[13px] text-ink-3 underline"
        >
          Privacy and settings
        </a>
      </div>
    </div>
  );
}
