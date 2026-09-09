'use client';

// P3 camera interim notice (James-ruled): shown IN-SHELL ONLY on the
// camera-required identity steps — the /join H97 selfie and both /verify
// steps — while the binary lacks NSCameraUsageDescription. H97 stays
// untouched: camera-only remains the rule; the VENUE moves temporarily to
// the website. Removed when the 1.0.1 build carries the permission string.
export default function ShellCameraNotice() {
  return (
    <div className="rounded-xl border border-line bg-page p-4" data-testid="shell-camera-notice">
      <p className="font-jost text-[14px] font-medium text-ink">
        Camera Arrives In The Next Update
      </p>
      <p className="mt-1 font-jost text-[13px] font-light text-ink-2">
        Finish this step at renacleaning.co.uk — your progress is saved.
      </p>
    </div>
  );
}
