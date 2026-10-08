// RENA-101 (James-ruled 2026-10-08, the auditor's condition d): ONE
// eligibility rule for a cleaner's public face. The directory (through
// eligibleCleanerWhere, which adds discovery-only conditions on top), the
// /api/cleaners/[id] API and the /cleaners/[id] page all read these flags,
// so they can never fork.
export const PUBLIC_PROFILE_FLAGS = [
  'verified',
  'insuranceVerified',
  'stripeChargesEnabled',
  'stripePayoutsEnabled',
  'visibleInDirectory',
] as const;

export type PublicProfileFlags = Record<(typeof PUBLIC_PROFILE_FLAGS)[number], boolean>;

/** The rule as a Prisma CleanerProfile where fragment. */
export function publicProfileWhere(): PublicProfileFlags {
  return Object.fromEntries(PUBLIC_PROFILE_FLAGS.map((f) => [f, true])) as PublicProfileFlags;
}

/** The same rule over a loaded profile row. */
export function isPublicProfile(p: PublicProfileFlags): boolean {
  return PUBLIC_PROFILE_FLAGS.every((f) => p[f] === true);
}
