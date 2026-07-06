import { notFound } from 'next/navigation';

// Retired. This page was a non-functional mock: hardcoded service types,
// pricing rules, and service areas that never matched the real system, with a
// Save button that persisted nothing. Real reference data (service types,
// fixed prices) is seed-governed and synced on every deploy; platform pricing
// config lives under /admin/pricing. Rather than wire an editor that would
// fight the seed-as-source-of-truth model, the route is retired.
export default function AdminSettingsPage() {
  notFound();
}
