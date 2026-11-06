import { CustomerCleanersSwitch } from '@/components/app/CustomerCleaners';
import { listDirectoryCleaners } from '@/lib/services/area-search.service';

import CleanersDirectory from './CleanersDirectory';

// AI-crawler visibility: the directory previously rendered an EMPTY shell to
// non-JS fetchers (ChatGPT/Claude assistants, curl) because the entire list
// arrived via client-side fetch. The first page is now server-rendered — the
// same data through the same eligibility filter — and the client component
// hydrates from it. Postcode/filter interactions still fetch client-side.
// RENA-051 (B6.3, named for James's ruling): kept per request, as in
// production today. Railway builds without the private network (and before
// the deploy's migrations), so a build-time render of this database-reading
// page would cache an empty fallback until it revalidated (benched: /cleaners
// served its no-data build render on the first request after start).
export const dynamic = 'force-dynamic';

export default async function CleanersPage() {
  let initialCleaners: Awaited<ReturnType<typeof listDirectoryCleaners>> | null = null;
  try {
    initialCleaners = await listDirectoryCleaners(50);
  } catch {
    initialCleaners = null; // client fetch takes over — never break the page
  }
  // Customer-shell switch (Phase 2): browsers get the directory exactly as
  // before (the switch renders children verbatim — SSR byte-identical); the
  // Rena customer shell gets the ruled row view after mount.
  return (
    <CustomerCleanersSwitch>
      <CleanersDirectory initialCleaners={initialCleaners} />
    </CustomerCleanersSwitch>
  );
}
