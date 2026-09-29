// Android 11+ package visibility for the wrong-app door: canOpenURL('renapro://')
// silently returns false without a <queries> declaration, and app.json has no
// first-class key for it. The iOS twin is LSApplicationQueriesSchemes. The
// door's guidance fallback stays as the belt if the query is ever refused.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo config plugins are CommonJS by contract
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidQueries(config, { schemes = [] } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [{}];
    const q = manifest.queries[0];
    q.intent = q.intent || [];
    for (const scheme of schemes) {
      const exists = q.intent.some((i) =>
        (i.data || []).some((d) => d.$ && d.$['android:scheme'] === scheme)
      );
      if (!exists) {
        q.intent.push({
          action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
          data: [{ $: { 'android:scheme': scheme } }],
        });
      }
    }
    return cfg;
  });
};
