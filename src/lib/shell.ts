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
