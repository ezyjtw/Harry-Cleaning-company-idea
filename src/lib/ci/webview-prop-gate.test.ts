import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// RENA-035 (remediation register): the Android startup crash was the iOS-only
// WebView props (decelerationRate='normal' above all) reaching the Fabric host
// on Android, where react-native-webview 13.15.0's codegen declares the prop
// as a Double. The fix gates them behind Platform.OS === 'ios' in
// IOS_WEBVIEW_PROPS. This static test fails if any of those props reappears
// outside that block in either shell.

const IOS_ONLY_PROPS = [
  'decelerationRate',
  'bounces',
  'allowsBackForwardNavigationGestures',
  'allowsLinkPreview',
  'sharedCookiesEnabled',
];

const SHELLS = ['mobile/App.tsx', 'mobile-customer/App.tsx'];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function gatedBlock(src: string): string {
  const start = src.indexOf('const IOS_WEBVIEW_PROPS');
  expect(start, 'IOS_WEBVIEW_PROPS block missing').toBeGreaterThan(-1);
  const end = src.indexOf(': {};', start);
  expect(end, 'IOS_WEBVIEW_PROPS block end missing').toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('RENA-035 iOS-only WebView props stay gated', () => {
  for (const rel of SHELLS) {
    it(`${rel}: props appear only inside IOS_WEBVIEW_PROPS`, () => {
      const file = path.join(process.cwd(), rel);
      const src = stripComments(readFileSync(file, 'utf8'));
      const block = gatedBlock(src);
      expect(block).toMatch(/Platform\.OS === 'ios'/);
      const outside = src.replace(block, '');
      for (const prop of IOS_ONLY_PROPS) {
        const re = new RegExp(`\\b${prop}\\b`, 'g');
        const hits = outside.match(re) ?? [];
        expect(hits, `${prop} appears outside the gate in ${rel}`).toHaveLength(0);
        expect(block).toMatch(re);
      }
      expect(src).toMatch(/\{\.\.\.IOS_WEBVIEW_PROPS\}/);
    });
  }
});
