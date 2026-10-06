import { redactText } from './redact';

// RENA-066 (D-l, B1b, James-ruled): the one Sentry scrubber, imported by the
// server init (instrumentation.ts) and the browser init (SentryInit.tsx).
// Pure: no Node modules. Browser error telemetry stays outside analytics
// consent (it is error monitoring, disclosed as such on the privacy page);
// this scrubber is what keeps it free of personal data.
//
// Strips request headers, cookies, query strings and bodies; reduces the user
// to an id; drops extra and context payloads; redacts exception and message
// text; drops console breadcrumbs and strips query strings and bodies from the
// rest. sendDefaultPii stays false and the console integration is removed.

type AnyRecord = Record<string, unknown>;

interface ScrubbableEvent {
  request?: AnyRecord & { url?: string };
  user?: AnyRecord & { id?: unknown };
  extra?: AnyRecord;
  contexts?: AnyRecord;
  tags?: AnyRecord;
  message?: string;
  exception?: { values?: Array<AnyRecord & { value?: string }> };
  breadcrumbs?: ScrubbableBreadcrumb[];
}

interface ScrubbableBreadcrumb {
  category?: string;
  message?: string;
  data?: AnyRecord;
}

// Context keys Sentry needs to group and triage; everything else is dropped.
const SAFE_CONTEXTS = new Set([
  'os',
  'browser',
  'device',
  'runtime',
  'app',
  'culture',
  'trace',
  'cloud_resource',
]);

export function stripQuery(url: unknown): unknown {
  if (typeof url !== 'string') return url;
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const cut = [q, h].filter((i) => i >= 0);
  return cut.length ? url.slice(0, Math.min(...cut)) : url;
}

export function scrubBreadcrumb<T>(input: T): T | null {
  const crumb = input as unknown as ScrubbableBreadcrumb;
  if (!crumb) return input;
  if (crumb.category === 'console') return null;
  const out: ScrubbableBreadcrumb = { ...crumb };
  if (out.message) out.message = redactText(out.message);
  if (out.data) {
    const data: AnyRecord = {};
    for (const key of ['url', 'to', 'from']) {
      if (key in out.data) data[key] = stripQuery(out.data[key]);
    }
    for (const key of ['method', 'status_code']) {
      if (key in out.data) data[key] = out.data[key];
    }
    out.data = data;
  }
  return out as unknown as T;
}

export function scrubEvent<T>(input: T): T {
  const event = input as unknown as ScrubbableEvent;
  if (!event) return input;
  if (event.request) {
    const { method, url } = event.request;
    event.request = {
      ...(method ? { method } : {}),
      ...(url ? { url: stripQuery(url) as string } : {}),
    };
  }
  if (event.user) {
    const id = event.user.id;
    event.user = id !== undefined && id !== null ? { id } : {};
  }
  if (event.extra) delete event.extra;
  if (event.contexts) {
    const kept: AnyRecord = {};
    for (const [k, v] of Object.entries(event.contexts)) if (SAFE_CONTEXTS.has(k)) kept[k] = v;
    event.contexts = kept;
  }
  if (event.message) event.message = redactText(event.message);
  if (event.exception?.values) {
    for (const v of event.exception.values) {
      if (typeof v.value === 'string') v.value = redactText(v.value);
    }
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((b) => scrubBreadcrumb(b))
      .filter((b): b is ScrubbableBreadcrumb => b !== null);
  }
  return input;
}

/** Options shared by the server and browser init. */
export const sentryScrubOptions = {
  sendDefaultPii: false,
  beforeSend: <T>(event: T): T => scrubEvent(event),
  beforeBreadcrumb: <T>(crumb: T): T | null => scrubBreadcrumb(crumb),
};

/** Remove the console integration from a default integration list. */
export function withoutConsoleIntegration<T extends { name: string }>(integrations: T[]): T[] {
  return integrations.filter((i) => i.name !== 'Console' && i.name !== 'CaptureConsole');
}
