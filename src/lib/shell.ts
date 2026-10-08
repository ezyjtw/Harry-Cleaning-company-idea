// ─── Rena app-shell detection ────────────────────────────────────────────────
//
// TWO native shells exist and must never trigger each other's skins:
//   • Rena Pro (cleaners):  header `x-rena-shell: pro-ios/<build>`,
//     UA suffix `… RenaPro/<version>`
//   • Rena (customers):     header `x-rena-shell: app-ios/<build>`,
//     UA suffix `… RenaApp/<version>`
//
// Each shell identifies itself two ways (belt-and-suspenders — custom headers
// can be stripped on some sub-requests, the UA suffix survives more reliably).
// The web uses this to: hide marketing chrome inside the app (the native tab
// bar replaces it) and serve /app/* only to the Pro shell.

export const SHELL_HEADER = 'x-rena-shell';

/**
 * True if the request originates from the Rena PRO native shell. The header
 * check is value-aware (`pro-…` only) — the customer shell's `app-…` header
 * must never open Pro's server gates (every shipped Pro binary sends
 * `pro-<os>/<version>`, so this tightening changes nothing for Pro).
 */
export function isRenaShell(headers: { get(name: string): string | null }): boolean {
  const shellHeader = headers.get(SHELL_HEADER);
  if (shellHeader && /^pro-/i.test(shellHeader.trim())) return true;

  const ua = headers.get('user-agent') || '';
  return /\bRenaPro\//i.test(ua);
}

/**
 * Client-side shell detection for 'use client' components (the shell appends
 * `RenaPro/<version>` to the WebView User-Agent). Always false during SSR, so
 * server-rendered HTML is byte-identical for browser visitors — components
 * using this self-suppress only inside the shell, at hydration.
 */
export function isShellUA(): boolean {
  return typeof navigator !== 'undefined' && /\bRenaPro\//i.test(navigator.userAgent);
}

/**
 * Server-side CUSTOMER-shell detection — the Rena customer app's request
 * signature (`x-rena-shell: app-…` header, or the RenaApp/ UA suffix).
 * Value-aware like isRenaShell: the two shells never open each other's gates.
 */
export function isCustomerShell(headers: { get(name: string): string | null }): boolean {
  const shellHeader = headers.get(SHELL_HEADER);
  if (shellHeader && /^app-/i.test(shellHeader.trim())) return true;

  const ua = headers.get('user-agent') || '';
  return /\bRenaApp\//i.test(ua);
}

/**
 * Client-side CUSTOMER-shell detection (the Rena customer app appends
 * `RenaApp/<version>` to its WebView User-Agent). Matches RenaApp/ ONLY —
 * never a loosened regex (James-ruled): the two shells' skins must be
 * provably independent. Always false during SSR, same byte-identity
 * guarantee as isShellUA().
 */
export function isCustomerShellUA(): boolean {
  return typeof navigator !== 'undefined' && /\bRenaApp\//i.test(navigator.userAgent);
}

/**
 * Either shell — for the few GENUINELY shared in-shell rules (cookie banner,
 * chat widget, contact FAB suppress inside any native shell). Composed from
 * the two exact matchers, never a loosened regex (James-ruled).
 */
export function isAnyShellUA(): boolean {
  return isShellUA() || isCustomerShellUA();
}

/**
 * 1.0.1 cargo (James-sealed): camera-capable shell detection. The 1.0.0
 * binary lacks NSCameraUsageDescription and CRASHES on a camera tap, so its
 * camera-path controls stay hidden behind the interim notices; the 1.0.1+
 * binary carries the permission string and gets the real controls. Parses
 * the UA's `RenaPro/<version>` suffix; an unparseable version counts as NOT
 * capable — fail-closed, a notice beats a crash. Browsers (no suffix) are
 * never affected: every call site is already inside an isShellUA() branch.
 */
export function shellCameraCapable(): boolean {
  if (typeof navigator === 'undefined') return false;
  const m = navigator.userAgent.match(/\bRenaPro\/(\d+)\.(\d+)\.(\d+)/i);
  if (!m) return false;
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return maj > 1 || (maj === 1 && (min > 0 || pat >= 1));
}

// B5 (RENA-031/082): the one gate both signup routes use.
/**
 * Which app, if any, a signup response may offer a handoff code to: the
 * customer shell for a CLIENT account, the Pro shell for a CLEANER account,
 * nobody else (the website, the wrong app). Response shape only, never
 * authentication.
 */
export function shellHandoffApp(
  headers: { get(name: string): string | null },
  role: 'CLIENT' | 'CLEANER' | 'ADMIN'
): 'PRO' | 'CUSTOMER' | null {
  if (role === 'CLIENT' && isCustomerShell(headers)) return 'CUSTOMER';
  if (role === 'CLEANER' && isRenaShell(headers)) return 'PRO';
  return null;
}

/**
 * B5 (James-ruled 8 Oct): the capability a shell advertises when it redeems
 * the `signedUp` message. Old shells carry the bridge too, so neither the
 * bridge nor the version number counts; only this explicit token does.
 */
export const SIGNED_UP_HANDOFF_CAPABILITY = 'signedUpHandoffV1';

/**
 * Client-side capability check: the shell appends `RenaCap/<a,b,…>` to its
 * WebView User-Agent, so the value is there before the page decides.
 * Behavioural negotiation only: it chooses which path a page takes, never
 * authentication or authorisation, and server code never reads it (a
 * spoofed token only makes a browser wait for a message nobody redeems,
 * which the page's own safety net ends). Exact token match, never
 * containment. Always false during SSR.
 */
export function shellHasCapability(cap: string): boolean {
  if (typeof navigator === 'undefined') return false;
  const m = /(?:^|\s)RenaCap\/([A-Za-z0-9,]+)(?:\s|$)/.exec(navigator.userAgent);
  return !!m && m[1].split(',').includes(cap);
}

/** How long a completed signup page waits on the shell before moving on. */
export const SIGNED_UP_SAFETY_NET_MS = 10_000;

/**
 * B5 (RENA-031/082): hand a just-created account to the native shell. The
 * message carries only the short-lived, single-use handoff code and
 * non-secret display data (never a Bearer or a bridge code); the shell
 * redeems the code by native fetch. Posts only to a shell that advertises
 * the signedUpHandoffV1 capability (James-ruled 8 Oct): returns false when
 * the capability or the bridge is absent, so the caller keeps its website
 * path and never waits on a message an older shell would ignore.
 */
export function postSignedUpToShell(msg: {
  handoffCode: string;
  email: string;
  role: 'CLIENT' | 'CLEANER';
}): boolean {
  if (typeof window === 'undefined') return false;
  if (!shellHasCapability(SIGNED_UP_HANDOFF_CAPABILITY)) return false;
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage(m: string): void } })
    .ReactNativeWebView;
  if (!bridge || typeof bridge.postMessage !== 'function') return false;
  bridge.postMessage(JSON.stringify({ type: 'signedUp', ...msg }));
  return true;
}
