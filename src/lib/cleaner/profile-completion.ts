/**
 * Canonical "profile details complete" definition — the SINGLE source of truth.
 *
 * A cleaner's core profile is complete when they have a bio, a postcode, and at
 * least one specialty. This previously existed as three drifting copies (the
 * dashboard API's `profileComplete`, the profile API's `onboardingComplete`, and
 * the sidebar completion widget). They are now unified onto this one function so
 * the dashboard setup checklist, the onboarding gate, and any other caller all
 * agree.
 *
 * Note: callers that need MORE than profile-details completeness (e.g. the
 * onboarding gate also requires a password) should compose this with their extra
 * clause rather than re-deriving the bio/postcode/specialties check.
 */
export interface ProfileCompletionInput {
  bio: string | null;
  postcode: string | null;
  specialties: string[];
}

export function isProfileComplete(p: ProfileCompletionInput): boolean {
  return !!p.bio && !!p.postcode && p.specialties.length > 0;
}
