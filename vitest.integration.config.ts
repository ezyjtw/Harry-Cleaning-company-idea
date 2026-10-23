import { defineConfig } from 'vitest/config';

import base from './vitest.config';

// RENA-105 (B6, James-ruled): the database integration suites share one
// Postgres, and the money ledger's S1 and S2 refuse, by design, while any
// booking that is not theirs exists (their sweeps read the whole database).
// Run in parallel, another suite's booking exists at that moment (proven
// 2026-10-23: 0 bookings before and after, 1 foreign booking seen by S1 and
// S2 mid-run). This config is the one way to run them together locally:
// every suite enabled, one file at a time. `npm run test:integration`.
// CI is unaffected: each suite already runs as its own sequential step.
export const INTEGRATION_FLAGS = [
  'SCHEDULER_LEASE_INTEGRATION',
  'AUTH_SESSION_INTEGRATION',
  'NATIVE_HANDOFF_INTEGRATION',
  'CLEANER_APPLICATION_INTEGRATION',
  'BOOKING_LIFECYCLE_INTEGRATION',
  'MONEY_LEDGER_INTEGRATION',
] as const;

// Spread, not mergeConfig: mergeConfig concatenates include lists, which
// would run every unit test as well.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    env: Object.fromEntries(INTEGRATION_FLAGS.map((f) => [f, '1'])),
  },
});
