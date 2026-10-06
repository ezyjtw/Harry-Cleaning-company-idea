/* eslint-disable no-console */
// RENA-066 (register, B1b): CI entry for the log-hygiene grep. Logic lives in
// src/lib/ci/log-hygiene.ts (unit tested).
import { HYGIENE_ROOTS, findViolations, listSourceFiles } from '../src/lib/ci/log-hygiene';

const files = HYGIENE_ROOTS.flatMap((r) => listSourceFiles(r));
const hits = findViolations(files);
if (hits.length) {
  console.error(`Log hygiene: ${hits.length} console call(s) carry personal data or payloads:`);
  for (const h of hits) console.error(`  ${h}`);
  console.error('Use src/lib/log.ts (allowlisted fields) instead.');
  process.exit(1);
}
console.log(`Log hygiene: ${files.length} files clean.`);
