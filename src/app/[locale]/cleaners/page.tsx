import { listDirectoryCleaners } from '@/lib/services/area-search.service';

import CleanersDirectory from './CleanersDirectory';

// AI-crawler visibility: the directory previously rendered an EMPTY shell to
// non-JS fetchers (ChatGPT/Claude assistants, curl) because the entire list
// arrived via client-side fetch. The first page is now server-rendered — the
// same data through the same eligibility filter — and the client component
// hydrates from it. Postcode/filter interactions still fetch client-side.
// Refreshes every 5 minutes; a DB hiccup falls back to the client fetch.
export const revalidate = 300;

export default async function CleanersPage() {
  let initialCleaners: Awaited<ReturnType<typeof listDirectoryCleaners>> | null = null;
  try {
    initialCleaners = await listDirectoryCleaners(50);
  } catch {
    initialCleaners = null; // client fetch takes over — never break the page
  }
  return <CleanersDirectory initialCleaners={initialCleaners} />;
}
