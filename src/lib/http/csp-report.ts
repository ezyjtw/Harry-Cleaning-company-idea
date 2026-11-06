// RENA-005 (B6.1): parsing of CSP violation reports for /api/csp-report,
// from report-uri (application/csp-report) and the Reporting API
// (application/reports+json). Only the document path, the directive and the
// blocked host survive: never a query string, a full URL or a script sample.

export type Violation = {
  documentPath: string | null;
  directive: string | null;
  blockedHost: string | null;
};

function pathOf(u: unknown): string | null {
  if (typeof u !== 'string' || !u) return null;
  try {
    return new URL(u).pathname;
  } catch {
    return null;
  }
}

function hostOf(u: unknown): string | null {
  if (typeof u !== 'string' || !u) return null;
  // Keywords the browser reports in place of a URL (inline, eval, data, ...).
  if (!u.includes(':') || !u.includes('/')) return u.slice(0, 20);
  try {
    return new URL(u).host || new URL(u).protocol;
  } catch {
    return null;
  }
}

/** Parse either report format into the logged fields; unknown shapes give []. */
export function parseCspReports(contentType: string, body: unknown): Violation[] {
  const pick = (r: Record<string, unknown>, a: string, b: string) => r[a] ?? r[b];
  const one = (r: unknown): Violation | null => {
    if (!r || typeof r !== 'object') return null;
    const o = r as Record<string, unknown>;
    const d =
      pick(o, 'effectiveDirective', 'effective-directive') ??
      pick(o, 'violatedDirective', 'violated-directive');
    return {
      documentPath: pathOf(pick(o, 'documentURL', 'document-uri')),
      directive: typeof d === 'string' ? d.split(' ')[0].slice(0, 40) : null,
      blockedHost: hostOf(pick(o, 'blockedURL', 'blocked-uri')),
    };
  };
  if (contentType.includes('application/reports+json') && Array.isArray(body))
    return body
      .filter(
        (e) => e && typeof e === 'object' && (e as { type?: unknown }).type === 'csp-violation'
      )
      .map((e) => one((e as { body?: unknown }).body))
      .filter((v): v is Violation => v !== null);
  if (body && typeof body === 'object' && 'csp-report' in body) {
    const v = one((body as Record<string, unknown>)['csp-report']);
    return v ? [v] : [];
  }
  return [];
}
