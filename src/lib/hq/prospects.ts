// R9 HQ — Reachout pipeline: the ruled five statuses, shared by the API
// routes and the board so they can never drift.
export const PROSPECT_STATUSES = ['found', 'contacted', 'replied', 'stalled', 'joined'] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];
