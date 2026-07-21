// H94 (James-ruled): one quiet "check your junk" line at email-expectation
// moments while new-domain reputation builds. A whisper in the form-hint
// grammar — never amber, never a banner. The second clause matters: it
// recruits the reputation-training "not junk" click. Ledger: revisit ~4–6
// weeks post-launch; when DMARC reports show Microsoft inboxing reliably,
// these come down.
export default function JunkMailHint({ variant = 'sent' }: { variant?: 'sent' | 'reply' }) {
  return (
    <p className="mt-2 font-jost text-xs font-light text-ink-3">
      {variant === 'reply'
        ? "Our reply might land in your junk or spam folder — marking us 'not junk' makes sure it reaches you."
        : "Can't find it? Check your junk or spam folder — and mark us 'not junk' so future emails reach you."}
    </p>
  );
}
