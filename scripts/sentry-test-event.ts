/* eslint-disable no-console */
// RENA-068 (remediation register, B0): prove the Sentry wiring end to end.
//
// Server half (this script):
//   SENTRY_DSN=<dsn> npx tsx scripts/sentry-test-event.ts
// sends one tagged message and one tagged exception through the same SDK the
// server runtime uses (@sentry/node, which @sentry/nextjs wraps), waits for the
// transport to flush, and prints the event ids to look up in the project.
// Nothing is sent without SENTRY_DSN; the script refuses to run against a DSN
// that is not explicitly passed, so a production DSN is never picked up by
// accident from a .env file.
//
// Browser half (manual, documented here because the browser SDK initialises
// inside the React tree and has no script entry point): open the rig site with
// NEXT_PUBLIC_SENTRY_DSN set, open DevTools, run
//   setTimeout(() => { throw new Error('rena-sentry-browser-test'); });
// and confirm the event in the project. The browser SDK captures unhandled
// errors by itself once SentryInit has run.

import * as Sentry from '@sentry/node';

async function main(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.error(
      'SENTRY_DSN is not set. Pass it explicitly: SENTRY_DSN=... npx tsx scripts/sentry-test-event.ts'
    );
    process.exit(2);
  }
  const environment = process.env.SENTRY_TEST_ENVIRONMENT ?? 'rig-test';

  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
  Sentry.setTag('rena.test', 'RENA-068');

  const stamp = new Date().toISOString();
  const messageId = Sentry.captureMessage(`rena-sentry-server-test ${stamp}`, 'info');
  const exceptionId = Sentry.captureException(new Error(`rena-sentry-server-exception ${stamp}`));

  const flushed = await Sentry.flush(10_000);
  console.log(`environment: ${environment}`);
  console.log(`message event id:   ${messageId}`);
  console.log(`exception event id: ${exceptionId}`);
  console.log(
    flushed
      ? 'transport flushed: look both ids up in the Sentry project.'
      : 'transport did NOT flush within 10 s: check the DSN and network.'
  );
  process.exit(flushed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
