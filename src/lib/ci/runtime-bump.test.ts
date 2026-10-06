import { describe, expect, it } from 'vitest';

import { evaluateShell, isNativeFile, nativeView } from './runtime-bump';

const base = {
  expo: {
    name: 'Rena Pro',
    version: '1.0.3',
    runtimeVersion: { policy: 'appVersion' },
    updates: { url: 'https://u.expo.dev/x' },
    extra: { baseUrl: 'https://www.renacleaning.co.uk', customerStoreUrl: '' },
    plugins: ['expo-secure-store', ['expo-notifications', { color: '#16296b' }]],
    android: { package: 'uk.co.renacleaning.pro', permissions: ['NOTIFICATIONS'] },
  },
};

const basePkg = { dependencies: { expo: '~54.0.0', 'react-native-webview': '13.15.0' } };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

describe('RENA-042 runtime-bump check', () => {
  it('nativeView drops the OTA-safe keys and keeps the rest', () => {
    const view = nativeView(base);
    expect(Object.keys(view).sort()).toEqual(['android', 'name', 'plugins']);
  });

  it('passes when nothing native changed (store URL filled in extra)', () => {
    const head = clone(base);
    head.expo.extra.customerStoreUrl = 'https://apps.apple.com/app/id1';
    const v = evaluateShell({
      shell: 'mobile',
      baseAppJson: base,
      headAppJson: head,
      basePackageJson: basePkg,
      headPackageJson: basePkg,
      changedFiles: ['mobile/app.json', 'mobile/App.tsx'],
    });
    expect(v.nativeReasons).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('fails when a config plugin is added without a version bump', () => {
    const head = clone(base);
    (head.expo.plugins as unknown[]).unshift([
      'expo-splash-screen',
      { android: { image: './assets/logo-lockup.png' } },
    ]);
    const v = evaluateShell({
      shell: 'mobile',
      baseAppJson: base,
      headAppJson: head,
      basePackageJson: basePkg,
      headPackageJson: basePkg,
      changedFiles: ['mobile/app.json'],
    });
    expect(v.nativeReasons).toEqual(['app.json native key changed: plugins']);
    expect(v.ok).toBe(false);
  });

  it('passes the same plugin change when the version is bumped', () => {
    const head = clone(base);
    (head.expo.plugins as unknown[]).unshift(['expo-splash-screen', {}]);
    head.expo.version = '1.0.4';
    const v = evaluateShell({
      shell: 'mobile',
      baseAppJson: base,
      headAppJson: head,
      basePackageJson: basePkg,
      headPackageJson: basePkg,
      changedFiles: ['mobile/app.json'],
    });
    expect(v.versionChanged).toBe(true);
    expect(v.ok).toBe(true);
  });

  it('fails on a dependency version change without a bump', () => {
    const headPkg = clone(basePkg);
    headPkg.dependencies['react-native-webview'] = '13.16.0';
    const v = evaluateShell({
      shell: 'mobile-customer',
      baseAppJson: base,
      headAppJson: base,
      basePackageJson: basePkg,
      headPackageJson: headPkg,
      changedFiles: ['mobile-customer/package.json', 'mobile-customer/package-lock.json'],
    });
    expect(v.nativeReasons).toEqual([
      'dependency changed: react-native-webview 13.15.0 -> 13.16.0',
    ]);
    expect(v.ok).toBe(false);
  });

  it('fails on icon, splash, plugin or google-services changes, ignores fonts', () => {
    expect(isNativeFile('mobile', 'mobile/assets/icon.png')).toBe(true);
    expect(isNativeFile('mobile', 'mobile/assets/splash.png')).toBe(true);
    expect(isNativeFile('mobile', 'mobile/google-services.json')).toBe(true);
    expect(isNativeFile('mobile-customer', 'mobile-customer/plugins/withAndroidQueries.js')).toBe(
      true
    );
    expect(isNativeFile('mobile', 'mobile/assets/fonts/Jost-Regular.ttf')).toBe(false);
    expect(isNativeFile('mobile', 'mobile/App.tsx')).toBe(false);
    expect(isNativeFile('mobile', 'mobile-customer/assets/icon.png')).toBe(false);

    const v = evaluateShell({
      shell: 'mobile',
      baseAppJson: base,
      headAppJson: base,
      basePackageJson: basePkg,
      headPackageJson: basePkg,
      changedFiles: ['mobile/assets/splash.png', 'mobile/assets/fonts/Jost-Regular.ttf'],
    });
    expect(v.nativeReasons).toEqual(['native file changed: mobile/assets/splash.png']);
    expect(v.ok).toBe(false);
  });

  it('treats key reordering as no change', () => {
    const head = {
      expo: {
        android: { permissions: ['NOTIFICATIONS'], package: 'uk.co.renacleaning.pro' },
        plugins: base.expo.plugins,
        name: 'Rena Pro',
        version: '1.0.3',
        extra: base.expo.extra,
        updates: base.expo.updates,
        runtimeVersion: base.expo.runtimeVersion,
      },
    };
    const v = evaluateShell({
      shell: 'mobile',
      baseAppJson: base,
      headAppJson: head,
      basePackageJson: basePkg,
      headPackageJson: basePkg,
      changedFiles: ['mobile/app.json'],
    });
    expect(v.nativeReasons).toEqual([]);
  });
});
