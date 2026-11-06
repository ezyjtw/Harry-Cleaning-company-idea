// RENA-051 (B6.3): the public routes prerendered as ISR, and their revalidate
// seconds. Every other baselined route renders per request: the auth pages,
// /services/<category> (its client page reads searchParams), /get-app/*, and
// the three database-reading pages kept dynamic for James's ruling (/,
// /cleaners, /cleaning/chingford). The hash tool's --modes check asserts a
// build's .next/prerender-manifest.json against this table exactly.
export const ISR_ROUTES: Readonly<Record<string, number>> = {
  '/about': 3600,
  '/account-deletion': 3600,
  '/cleaning': 3600,
  '/contact': 3600,
  '/faq': 3600,
  '/guarantees': 3600,
  '/how-it-works': 3600,
  '/job-check': 3600,
  '/join': 3600,
  '/offline': 3600,
  '/pricing': 3600,
  '/privacy': 3600,
  '/regular-clean': 3600,
  '/services': 3600,
  '/terms': 3600,
  '/unsubscribe': 3600,
};

/** Differences between a prerender manifest's locale routes and the table. */
export function modeDifferences(manifest: {
  routes: Record<string, { initialRevalidateSeconds: number | false }>;
}): string[] {
  const seen: Record<string, number | false> = {};
  for (const [route, r] of Object.entries(manifest.routes)) {
    if (route === '/en') seen['/'] = r.initialRevalidateSeconds;
    else if (route.startsWith('/en/')) seen[route.slice(3)] = r.initialRevalidateSeconds;
  }
  const out: string[] = [];
  for (const [route, s] of Object.entries(ISR_ROUTES))
    if (seen[route] !== s) out.push(`${route}: expected ISR ${s}, got ${seen[route] ?? 'dynamic'}`);
  for (const route of Object.keys(seen))
    if (!(route in ISR_ROUTES)) out.push(`${route}: prerendered but not in the table`);
  return out;
}
