import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PUSH_SETTINGS_CAPABILITY, postPushSettingsToShell } from './shell';

// B5.8 settings door (RENA-046, James-ruled 23 Oct). The message goes only to
// a shell advertising pushSettingsV1 (the unpublished Pro-5 and Customer-5
// source); every published shell and every browser gets nothing, so no tap is lost on a shell that
// would ignore it. The served pages carry no door markup at all.
const BASE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
function asClient(ua: string, bridge?: (m: string) => void) {
  vi.stubGlobal('navigator', { userAgent: ua });
  vi.stubGlobal('window', bridge ? { ReactNativeWebView: { postMessage: bridge } } : {});
}
afterEach(() => vi.unstubAllGlobals());

describe('the push settings door', () => {
  it('a shell advertising pushSettingsV1 receives exactly {type: pushSettings}', () => {
    const post = vi.fn();
    asClient(`${BASE} RenaPro/1.0.3 RenaCap/signedUpHandoffV1,${PUSH_SETTINGS_CAPABILITY}`, post);
    expect(postPushSettingsToShell()).toBe(true);
    expect(post).toHaveBeenCalledWith(JSON.stringify({ type: 'pushSettings' }));
  });

  it.each([
    ['the current shells (handoff token only)', `${BASE} RenaPro/1.0.3 RenaCap/signedUpHandoffV1`],
    ['a legacy shell', `${BASE} RenaApp/1.0.1`],
    ['a lookalike token', `${BASE} RenaPro/1.0.3 RenaCap/pushSettingsV10`],
  ])('%s: nothing is posted', (_label, ua) => {
    const post = vi.fn();
    asClient(ua, post);
    expect(postPushSettingsToShell()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  it('a browser with the token but no bridge posts nothing', () => {
    asClient(`${BASE} RenaCap/${PUSH_SETTINGS_CAPABILITY}`);
    expect(postPushSettingsToShell()).toBe(false);
  });

  it('the Pro-5 and Customer-5 source advertise the token (published binaries do not)', () => {
    const root = join(__dirname, '..', '..');
    for (const app of ['mobile/App.tsx', 'mobile-customer/App.tsx'])
      expect(readFileSync(join(root, app), 'utf8')).toContain(
        "const SHELL_CAPABILITIES = ['signedUpHandoffV1', 'pushSettingsV1'];"
      );
  });

  it('the door decides after mount and renders nothing until then', () => {
    const src = readFileSync(
      join(__dirname, '..', 'components', 'app', 'PushSettingsDoor.tsx'),
      'utf8'
    );
    expect(src).toMatch(/useState\(false\)/);
    expect(src).toMatch(/if \(!available\) return null;/);
  });
});
