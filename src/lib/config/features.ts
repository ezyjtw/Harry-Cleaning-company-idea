export const SAME_DAY_FEATURE_ENABLED = false;

// R1-B (James-ruled): the T-48h off-session occurrence charge. ON in prod —
// the whole recurring money loop hangs off this. OFF kills the charge sweep
// AND the T-24h auto-cancel sweep (occurrences would simply sit SCHEDULED).
export const RECURRING_AUTOCHARGE = true;

export const ADMIN_DESTRUCTIVE_ENABLED = process.env.ADMIN_DESTRUCTIVE_ENABLED === 'true';

// H88 (James-ruled): live chat is pulled from launch — the FAB opens the
// contact form instead. The widget and /api/chat stay in the codebase and
// return via the future admin program when a human can genuinely back them.
export const LIVE_CHAT_ENABLED = process.env.LIVE_CHAT_ENABLED === 'true';
