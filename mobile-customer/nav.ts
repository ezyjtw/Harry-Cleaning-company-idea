// Cross-tab navigation judgment (R4 storm fix). Pure functions, imported by
// App.tsx and driven directly by the rig's judgment-table test.

/**
 * An in-page link to a TAB-ROOT route must switch the native tab, never
 * navigate inside the current tab's WebView. Matches ONLY the five tab
 * roots — deeper routes (/account/settings, /cleaners/abc, /booking/xyz)
 * stay in-pane by design. Regex, not new URL(): RN's URL polyfill is
 * unreliable. /account/bookings is matched before the bare /account so
 * My Cleans doesn't read as Home.
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
 * Forward a cross-tab URL to the target pane ONLY when it genuinely carries
 * something the landing page will read: a non-empty query string or a
 * non-empty hash. A bare tab root, a stray trailing '?' or '#', carry
 * nothing — those taps switch silently (no page load), the pre-R4 grammar.
 */
export function meaningfulPayload(url: string): boolean {
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const queryPart = q >= 0 ? url.slice(q + 1, h > q ? h : undefined) : '';
  const hashPart = h >= 0 ? url.slice(h + 1) : '';
  return queryPart.length > 0 || hashPart.length > 0;
}
