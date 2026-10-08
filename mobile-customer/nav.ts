// RENA customer app navigation (B5). Pure functions imported by App.tsx and
// driven by src/lib/ci/shell-nav.test.ts. The shared core below is identical
// to mobile/nav.ts; only this app's tables and constants differ.

export const TAB_KEYS = ['home', 'mycleans', 'book', 'cleaners', 'messages'] as const;
export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_ROOTS: Record<TabKey, string> = {
  home: '/app/home',
  mycleans: '/account/bookings',
  book: '/app/book',
  cleaners: '/cleaners',
  messages: '/messages',
};

/** First match wins. Paths are compared after the /en prefix is stripped. */
const OWNERS: { exact?: string; prefix?: string; tab: TabKey }[] = [
  { exact: '/app/home', tab: 'home' },
  { exact: '/app/book', tab: 'book' },
  { exact: '/account/bookings', tab: 'mycleans' },
  { prefix: '/account/bookings/', tab: 'mycleans' },
  { prefix: '/booking/', tab: 'mycleans' },
  { prefix: '/pay/', tab: 'mycleans' },
  { exact: '/cleaners', tab: 'cleaners' },
  { prefix: '/cleaners/', tab: 'cleaners' },
  { exact: '/messages', tab: 'messages' },
  { prefix: '/messages/', tab: 'messages' },
  { exact: '/account', tab: 'home' },
  { prefix: '/account/', tab: 'home' },
  { prefix: '/services/', tab: 'book' },
  { prefix: '/book/', tab: 'book' },
];

/** /open/customer/<rest> resolves <rest>; Pro's /open/pro/ is unowned here. */
const OPEN_PREFIX = '/open/customer/';
const IS_PRO = false;
const APP_ROLE = 'CLIENT' as const;
/** Same-origin pages a Stripe top-frame flow may start from (checkout, approve-topup, pay). */
const STRIPE_FLOW_STARTS = ['/book/', '/services/', '/booking/', '/pay/'];

export function buildNavCtx(
  baseUrl: string,
  platform: 'ios' | 'android',
  devHost: string | null = null
): NavCtx {
  const host = ((baseUrl.match(/^https?:\/\/([^/:?#]+)/) || [])[1] || '').toLowerCase();
  return { origin: `https://${host}`, host, scheme: 'rena', platform, devHost };
}

/**
 * Kept from the R4 storm fix: an in-page link to a TAB-ROOT route must
 * switch the native tab. Matches ONLY the five tab roots.
 */
export function tabRootKey(url: string): string | null {
  const m = url.match(
    /^https?:\/\/[^/]+\/(?:en\/)?(?:(account\/bookings)|(app\/home)|(app\/book)|(cleaners)|(messages))\/?(?:[?#].*)?$/
  );
  if (!m) return null;
  if (m[1]) return 'mycleans';
  if (m[2]) return 'home';
  if (m[3]) return 'book';
  if (m[4]) return 'cleaners';
  return 'messages';
}

/**
 * Kept from R4: forward a cross-tab URL only when it carries a non-empty
 * query or hash; a bare root, a stray '?' or '#', switch silently.
 */
export function meaningfulPayload(url: string): boolean {
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const queryPart = q >= 0 ? url.slice(q + 1, h > q ? h : undefined) : '';
  const hashPart = h >= 0 ? url.slice(h + 1) : '';
  return queryPart.length > 0 || hashPart.length > 0;
}

// ─── Shared core (identical in mobile/nav.ts and mobile-customer/nav.ts) ─────
//
// B5 (RENA-022, 024, 029, 036, 037, 039, 047, 031/082): pure, deterministic
// functions; no reliance on the global URL (React Native's polyfill is
// unreliable). App.tsx imports them; src/lib/ci/shell-nav.test.ts drives the
// tables. Host names are compared case-insensitively; paths case-sensitively
// (James-ruled: /Messages is unowned).

export interface NavCtx {
  /** https://<host> of the website the shell wraps. */
  origin: string;
  /** Lowercased host of origin. */
  host: string;
  /** This app's custom scheme (renapro or rena). */
  scheme: string;
  platform: 'ios' | 'android';
  /** Dev only: the http host allowed in __DEV__; null in production. */
  devHost: string | null;
}

export interface ParsedUrl {
  scheme: string;
  host: string;
  /** Path as sent (before the /en locale prefix is stripped). */
  rawPath: string;
  /** Path with /en stripped and trailing slashes removed (root stays '/'). */
  path: string;
  /** Query without the '?', '' when absent or empty. */
  query: string;
  /** Hash without the '#', '' when absent or empty. */
  hash: string;
}

const HIER = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i;
const OPAQUE = /^([a-z][a-z0-9+.-]*):(.*)$/i;
const HOST_OK = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i;

function normalisePath(raw: string): string {
  let p = raw === '' ? '/' : raw;
  if (p === '/en') p = '/';
  else if (p.startsWith('/en/')) p = p.slice(3);
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/**
 * Parse an absolute hierarchical URL. A host with userinfo, a port or any
 * non-host character is null; allowPort (development only) accepts and drops
 * a numeric port.
 */
export function parseHierarchical(raw: string, allowPort = false): ParsedUrl | null {
  const m = raw.match(HIER);
  if (!m) return null;
  let host = m[2];
  if (allowPort) host = host.replace(/:\d{1,5}$/, '');
  if (!host || !HOST_OK.test(host)) return null;
  const rawPath = m[3] || '/';
  if (rawPath !== '/' && !rawPath.startsWith('/')) return null;
  return {
    scheme: m[1].toLowerCase(),
    host: host.toLowerCase(),
    rawPath,
    path: normalisePath(rawPath),
    query: m[4] ?? '',
    hash: m[5] ?? '',
  };
}

/**
 * The shell's URL grammar: relative paths are absolutised against ctx.origin;
 * <ctx.scheme>://<rest> is rewritten to https://<ctx.host>/<rest>.
 */
export function parseRenaUrl(raw: string, ctx: NavCtx): ParsedUrl | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (s.startsWith('/') && !s.startsWith('//')) return parseHierarchical(ctx.origin + s);
  const prefix = `${ctx.scheme}://`;
  if (s.toLowerCase().startsWith(prefix)) {
    return parseHierarchical(`https://${ctx.host}/${s.slice(prefix.length).replace(/^\/+/, '')}`);
  }
  return parseHierarchical(s);
}

export function toAbsolute(p: ParsedUrl): string {
  return `https://${p.host}${p.path}${p.query ? `?${p.query}` : ''}${p.hash ? `#${p.hash}` : ''}`;
}

/** Parsed, https, exact host, no userinfo or port. */
export function isRenaOrigin(url: string, ctx: NavCtx): boolean {
  const p = parseHierarchical((url ?? '').trim());
  return !!p && p.scheme === 'https' && p.host === ctx.host;
}

// ─── B5.1 the deep link resolver ─────────────────────────────────────────────

export type LinkResolution =
  | { kind: 'tab'; tab: TabKey; forward: string | null }
  | { kind: 'ignore'; reason: 'empty' | 'unparsable' | 'foreign' | 'unowned' };

function ownerOf(path: string): TabKey | null {
  for (const o of OWNERS) {
    if (o.exact !== undefined && path === o.exact) return o.tab;
    if (o.prefix !== undefined && path.startsWith(o.prefix)) return o.tab;
  }
  return null;
}

export function resolveLink(raw: string, ctx: NavCtx, depth = 0): LinkResolution {
  const s = (raw ?? '').trim();
  if (!s) return { kind: 'ignore', reason: 'empty' };
  // The legacy bare tab form: <scheme>://<tabkey> (single segment, no query or hash).
  const legacy = s.match(new RegExp(`^${ctx.scheme}:\\/\\/([a-z]+)\\/?$`, 'i'));
  if (legacy && (TAB_KEYS as readonly string[]).includes(legacy[1])) {
    return { kind: 'tab', tab: legacy[1] as TabKey, forward: null };
  }
  const p = parseRenaUrl(s, ctx);
  if (!p) return { kind: 'ignore', reason: 'unparsable' };
  if (p.scheme !== 'https' || p.host !== ctx.host) return { kind: 'ignore', reason: 'foreign' };
  if (depth === 0 && p.path.startsWith(OPEN_PREFIX)) {
    const rest = p.path.slice(OPEN_PREFIX.length - 1);
    return resolveLink(
      `${rest}${p.query ? `?${p.query}` : ''}${p.hash ? `#${p.hash}` : ''}`,
      ctx,
      1
    );
  }
  const tab = ownerOf(p.path);
  if (!tab) return { kind: 'ignore', reason: 'unowned' };
  const bare = p.path === TAB_ROOTS[tab] && !p.query && !p.hash;
  return { kind: 'tab', tab, forward: bare ? null : toAbsolute(p) };
}

/** The tab whose root this URL is (any query or hash allowed), else null. */
export function tabRootOf(url: string, ctx: NavCtx): TabKey | null {
  const p = parseRenaUrl(url, ctx);
  if (!p || p.scheme !== 'https' || p.host !== ctx.host) return null;
  for (const k of TAB_KEYS) if (TAB_ROOTS[k] === p.path) return k;
  return null;
}

// ─── B5.2 the navigation classifier and the statement validator ──────────────

export type NavVerdict =
  | 'ALLOW_IN_PANE'
  | 'BLOCK'
  | 'OPEN_EXTERNAL'
  | 'OS_HANDLE'
  | 'STATEMENT'
  | 'STRIPE_RETURN'
  | 'CROSS_TAB';

export interface NavRequest {
  url: string;
  isTopFrame?: boolean;
  navigationType?: string;
}

export interface NavState {
  stripeFlow: boolean;
  /** The last same-origin top-frame path this pane landed on. */
  lastSameOriginPath: string | null;
}

export const INITIAL_NAV_STATE: NavState = { stripeFlow: false, lastSameOriginPath: null };

const STRIPE_HOSTS = new Set([
  'checkout.stripe.com',
  'connect.stripe.com',
  'js.stripe.com',
  'hooks.stripe.com',
  'm.stripe.network',
  'pay.stripe.com',
]);

export function isStripeHost(host: string): boolean {
  const h = host.toLowerCase();
  return STRIPE_HOSTS.has(h) || h.endsWith('.stripe.com');
}

const STRIPE_EXIT_PATHS = ['/cleaner/onboarding-complete', '/cleaner/stripe/connect'];

function startsStripeFlow(path: string | null): boolean {
  return !!path && STRIPE_FLOW_STARTS.some((p) => path.startsWith(p));
}

function parsedForClassifier(url: string, ctx: NavCtx): ParsedUrl | 'opaque' | null {
  const s = (url ?? '').trim();
  if (!s) return null;
  if (HIER.test(s)) return parseHierarchical(s, !!ctx.devHost);
  return OPAQUE.test(s) ? 'opaque' : null;
}

export function classifyNavigation(req: NavRequest, state: NavState, ctx: NavCtx): NavVerdict {
  // 1. Sub frames (Stripe Elements, 3DS challenge iframes) are never touched.
  if (req.isTopFrame === false) return 'ALLOW_IN_PANE';
  const s = (req.url ?? '').trim();
  const p = parsedForClassifier(s, ctx);
  // 2. Unparsable (including a userinfo or port trick in the host).
  if (p === null) return 'BLOCK';
  if (p === 'opaque') {
    const scheme = (s.match(OPAQUE) as RegExpMatchArray)[1].toLowerCase();
    // 3. The OS handles mail, phone and text.
    if (scheme === 'mailto' || scheme === 'tel' || scheme === 'sms') return 'OS_HANDLE';
    // 4. about:blank (the iOS window.open interim) stays; every other scheme is blocked.
    if (scheme === 'about' && s.slice(scheme.length + 1).toLowerCase() === 'blank') {
      return 'ALLOW_IN_PANE';
    }
    return 'BLOCK';
  }
  if (p.scheme !== 'https' && p.scheme !== 'http') return 'BLOCK';
  // 5. Plain http is blocked, except the dev origin in development.
  if (p.scheme === 'http') return ctx.devHost && p.host === ctx.devHost ? 'ALLOW_IN_PANE' : 'BLOCK';
  // 6. Same origin.
  if (p.host === ctx.host) {
    if (IS_PRO && ctx.platform === 'android' && p.rawPath === '/api/cleaner/statement') {
      return 'STATEMENT';
    }
    if (IS_PRO && state.stripeFlow && !STRIPE_EXIT_PATHS.includes(p.path)) return 'STRIPE_RETURN';
    for (const k of TAB_KEYS) if (TAB_ROOTS[k] === p.path) return 'CROSS_TAB';
    return 'ALLOW_IN_PANE';
  }
  // 7. Stripe stays in the pane only during a payment or Connect flow.
  if (isStripeHost(p.host)) {
    return state.stripeFlow || startsStripeFlow(state.lastSameOriginPath)
      ? 'ALLOW_IN_PANE'
      : 'OPEN_EXTERNAL';
  }
  // 8. Any other https top frame opens in the system browser.
  return 'OPEN_EXTERNAL';
}

/** The pane's flow state after acting on a verdict for a top-frame request. */
export function nextNavState(
  state: NavState,
  req: NavRequest,
  verdict: NavVerdict,
  ctx: NavCtx
): NavState {
  if (req.isTopFrame === false) return state;
  const p = parsedForClassifier(req.url, ctx);
  if (!p || p === 'opaque') return state;
  if (p.scheme === 'https' && p.host === ctx.host) {
    if (verdict === 'ALLOW_IN_PANE' || verdict === 'STRIPE_RETURN') {
      return { stripeFlow: false, lastSameOriginPath: p.path };
    }
    return state;
  }
  if (verdict === 'ALLOW_IN_PANE' && isStripeHost(p.host)) {
    return { ...state, stripeFlow: true };
  }
  return state;
}

/**
 * RENA-036: the only URL either shell attaches its Bearer to. https, the exact
 * host, the exact path /api/cleaner/statement (no prefix match, no locale).
 */
export function isStatementUrl(url: string, ctx: NavCtx): boolean {
  const p = parseHierarchical((url ?? '').trim());
  return (
    !!p && p.scheme === 'https' && p.host === ctx.host && p.rawPath === '/api/cleaner/statement'
  );
}

/**
 * STRING-LAW (B5.2): the one script the iOS onOpenWindow path injects. Built
 * at runtime by a template with no backslash in its text (so cooked equals
 * raw): a plain assignment of a JSON-encoded string. JSON.stringify escapes quotes, backslashes and control characters;
 * the U+2028 and U+2029 separators are escaped too so older engines can never
 * read them as line terminators. The cooked-parse proof
 * (src/lib/ci/shell-nav.test.ts) parses and runs the delivered string.
 */
export function locationAssignScript(url: string): string {
  const literal = JSON.stringify(String(url))
    .split(String.fromCharCode(0x2028))
    .join('\\u2028')
    .split(String.fromCharCode(0x2029))
    .join('\\u2029');
  return `window.location.href = ${literal}; true;`;
}

// ─── B5.3 session loss (James-ruled) ─────────────────────────────────────────
//
// 2xx resets; 401 counts; a definitive 403 RESETS; 5xx, 429 and network
// failures neither count nor reset. Two genuine 401s, at least 5 s apart and
// within 3 minutes of the first, log out.

export interface SessionLossState {
  consecutive401: number;
  firstAt: number | null;
}

export const INITIAL_SESSION_LOSS: SessionLossState = { consecutive401: 0, firstAt: null };
export const SESSION_LOSS_MIN_GAP_MS = 5000;
export const SESSION_LOSS_WINDOW_MS = 180000;

export function nextSessionLostAction(
  prev: SessionLossState,
  status: number | 'network',
  now: number
): { state: SessionLossState; logout: boolean } {
  if (status === 'network' || status === 429 || (typeof status === 'number' && status >= 500)) {
    return { state: prev, logout: false };
  }
  if (status === 401) {
    const fresh =
      prev.firstAt === null || now - prev.firstAt > SESSION_LOSS_WINDOW_MS
        ? { consecutive401: 1, firstAt: now }
        : { consecutive401: prev.consecutive401 + 1, firstAt: prev.firstAt };
    const logout =
      fresh.consecutive401 >= 2 &&
      fresh.firstAt !== null &&
      now - fresh.firstAt >= SESSION_LOSS_MIN_GAP_MS &&
      now - fresh.firstAt <= SESSION_LOSS_WINDOW_MS;
    return { state: fresh, logout };
  }
  // 2xx, a definitive 403, and any other answer: reset.
  return { state: INITIAL_SESSION_LOSS, logout: false };
}

// ─── B5.4 the signup and join handoff message ────────────────────────────────

export interface SignedUpMessage {
  type: 'signedUp';
  handoffCode: string;
  email: string;
  role: 'CLIENT' | 'CLEANER';
}

/**
 * The page posts only the single-use handoff code and display data (never a
 * Bearer). A message for the other app's role, an unknown type, a missing or
 * malformed field, or bad JSON is null.
 */
export function parseShellMessage(raw: string): SignedUpMessage | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.type !== 'signedUp') return null;
  if (typeof o.handoffCode !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(o.handoffCode)) return null;
  if (typeof o.email !== 'string' || o.email.length > 320 || !o.email.includes('@')) return null;
  if (o.role !== APP_ROLE) return null;
  return { type: 'signedUp', handoffCode: o.handoffCode, email: o.email, role: APP_ROLE };
}

/**
 * B5.4 fallback (deviation 8): a same-origin landing on the website portal
 * (/account, /cleaner, /dashboard) while the shell is still in its signup or
 * join phase means the handoff message never arrived (an old page build, a
 * lost post). The shell then switches to native login.
 */
export function isPortalLanding(url: string, ctx: NavCtx): boolean {
  const p = parseRenaUrl(url, ctx);
  if (!p || p.scheme !== 'https' || p.host !== ctx.host) return false;
  return ['/account', '/cleaner', '/dashboard'].some(
    (r) => p.path === r || p.path.startsWith(`${r}/`)
  );
}

// ─── B5.8 the notification permission decision ───────────────────────────────

/** At shell entry: register silently when granted; show the card once; else nothing. */
export function pushEntryDecision(input: {
  asked: boolean;
  granted: boolean;
}): 'register' | 'show_card' | 'none' {
  if (input.granted) return 'register';
  if (!input.asked) return 'show_card';
  return 'none';
}

/** The settings door: ask again when the OS still allows it, else open Settings. */
export function pushDoorDecision(input: {
  granted: boolean;
  canAskAgain: boolean;
}): 'already_on' | 'ask' | 'open_settings' {
  if (input.granted) return 'already_on';
  return input.canAskAgain ? 'ask' : 'open_settings';
}
