// ─────────────────────────────────────────────────────────────
// F-B: cleaner badges — single source of truth for both badge rules.
// ─────────────────────────────────────────────────────────────

// PLACEHOLDER TITLE — James names the founding badge at the gate. Every render
// site pulls from here, so the rename is a one-line change.
export const FOUNDING_BADGE_LABEL = 'Founding Cleaner';

// Default size of the founding cohort; live value is the PlatformConfig key
// 'founding_cleaner_limit' (admin-editable), this is the fallback.
export const FOUNDING_CLEANER_DEFAULT_LIMIT = 30;
export const FOUNDING_CLEANER_LIMIT_KEY = 'founding_cleaner_limit';

// "New to Rena" expires at 5 completed bookings or 60 days post-go-live,
// whichever comes first (James-ruled). Go-live moment = liveNotifiedAt
// (the exactly-once stamp from maybeMarkLive); profiles that predate that
// stamp fall back to identity verification, then profile creation.
export const NEW_TO_RENA_MAX_JOBS = 5;
export const NEW_TO_RENA_MAX_DAYS = 60;

export function isNewToRena(completedJobs: number, goLiveAt: Date | null | undefined): boolean {
  if (completedJobs >= NEW_TO_RENA_MAX_JOBS) return false;
  if (goLiveAt) {
    const ageMs = Date.now() - goLiveAt.getTime();
    if (ageMs > NEW_TO_RENA_MAX_DAYS * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}
