/* eslint-disable no-console */
// B7.14: fetch Cloudflare's published edge ranges and compare them with the
// committed constants in src/lib/http/cloudflare-ranges.ts. Exits 1 with the
// difference when they diverge, so the monthly workflow can open an issue.
// Never edits the constants: a range change is a sanctioned gate (RENA-002).
//   npx tsx scripts/check-cloudflare-ranges.ts
import {
  CLOUDFLARE_IPS_V4_URL,
  CLOUDFLARE_IPS_V6_URL,
  formatDifferences,
  parsePublishedList,
  rangeDifferences,
} from '../src/lib/ci/cloudflare-ranges-check';

async function fetchList(url: string): Promise<string[]> {
  const res = await fetch(url, { headers: { 'user-agent': 'rena-cloudflare-range-check' } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return parsePublishedList(await res.text());
}

async function main(): Promise<void> {
  const [v4, v6] = await Promise.all([
    fetchList(CLOUDFLARE_IPS_V4_URL),
    fetchList(CLOUDFLARE_IPS_V6_URL),
  ]);
  const diffs = rangeDifferences(v4, v6);
  if (diffs.length) {
    console.error(`Cloudflare ranges changed:\n${formatDifferences(diffs)}`);
    process.exit(1);
  }
  console.log(`Cloudflare ranges unchanged (${v4.length} v4, ${v6.length} v6).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
