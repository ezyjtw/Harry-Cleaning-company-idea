import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL: string =
  (Constants.expoConfig?.extra?.baseUrl as string) || 'https://www.renacleaning.co.uk';
const SHELL_HEADER = { 'x-rena-shell': `pro-${Platform.OS}/${Constants.expoConfig?.version ?? '1'}` };
const UA_SUFFIX = `RenaPro/${Constants.expoConfig?.version ?? '1.0'}`;
const TOKEN_KEY = 'rena.pro.bearer';

const INK = '#16296b';
const PAGE = '#FAFBFC';
const LINE = '#E4E9F0';
const INK2 = '#3D5170';

// Tab bar: first tab = the purpose-built Today screen; the rest are portal routes.
const TABS = [
  { key: 'today', label: 'Today', path: '/en/app/today' },
  { key: 'jobs', label: 'Jobs', path: '/en/cleaner/jobs' },
  { key: 'availability', label: 'Availability', path: '/en/cleaner/availability' },
  { key: 'earnings', label: 'Earnings', path: '/en/cleaner/earnings' },
  { key: 'messages', label: 'Messages', path: '/en/messages' },
] as const;

type Phase = 'loading' | 'locked' | 'login' | 'shell';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  // The URL the first WebView loads after login: the session-bridge, which sets
  // the WebView session cookie and redirects into the app. Null once bridged.
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('today');

  // On cold start: if we have a stored token, require Face ID, then show the
  // shell (the WebView cookie persists across restarts). Otherwise, login.
  const boot = useCallback(async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      setPhase('login');
      return;
    }
    setPhase('locked');
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  const unlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      // No biometrics configured — fall through (the session cookie still gates).
      setPhase('shell');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Rena Pro',
      fallbackLabel: 'Use passcode',
    });
    if (res.success) setPhase('shell');
  }, []);

  useEffect(() => {
    if (phase === 'locked') unlock();
  }, [phase, unlock]);

  const onLoggedIn = useCallback(async (token: string, bridgeCode: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    const url = `${BASE_URL}/api/auth/session-bridge?code=${encodeURIComponent(
      bridgeCode
    )}&callbackUrl=${encodeURIComponent('/en/app/today')}`;
    setBridgeUrl(url);
    setActiveTab('today');
    setPhase('shell');
  }, []);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setBridgeUrl(null);
    setPhase('login');
  }, []);

  if (phase === 'loading' || phase === 'locked') {
    return (
      <SafeAreaProvider>
        <View style={styles.center}>
          <ActivityIndicator color={INK} />
          {phase === 'locked' && <Text style={styles.mutedSmall}>Unlock to continue</Text>}
        </View>
      </SafeAreaProvider>
    );
  }

  if (phase === 'login') {
    return (
      <SafeAreaProvider>
        <LoginScreen onLoggedIn={onLoggedIn} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.flex}>
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            // The Today tab loads the bridge URL first (sets the cookie); once
            // bridged it and every other tab load their route directly (shared
            // cookie jar). Keep tabs mounted to preserve scroll/state.
            const uri =
              tab.key === 'today' && bridgeUrl ? bridgeUrl : `${BASE_URL}${tab.path}`;
            return (
              <View
                key={tab.key}
                style={[styles.flex, { display: isActive ? 'flex' : 'none' }]}
              >
                <ShellWebView uri={uri} onSessionLost={logout} />
              </View>
            );
          })}
        </View>
        <TabBar active={activeTab} onSelect={setActiveTab} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─── WebView wrapper (shared cookies, shell headers, offline state) ───────────
function ShellWebView({ uri, onSessionLost }: { uri: string; onSessionLost: () => void }) {
  const [offline, setOffline] = useState(false);
  const ref = useRef<WebView>(null);

  // If the web session expires, the portal redirects to /login — bounce back to
  // the native login screen instead of showing the web form inside the shell.
  const onNav = (nav: WebViewNavigation) => {
    if (/\/login(\?|$)/.test(nav.url) || /\/api\/auth\/signin/.test(nav.url)) {
      onSessionLost();
    }
  };

  if (offline) {
    return (
      <View style={styles.center}>
        <Text style={styles.offlineTitle}>You&apos;re offline</Text>
        <Text style={styles.mutedSmall}>Check your connection and try again.</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => {
            setOffline(false);
            ref.current?.reload();
          }}
        >
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      ref={ref}
      source={{ uri, headers: SHELL_HEADER }}
      applicationNameForUserAgent={UA_SUFFIX}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      pullToRefreshEnabled
      allowsBackForwardNavigationGestures
      onNavigationStateChange={onNav}
      onError={() => setOffline(true)}
      onHttpError={() => {
        /* leave HTTP errors to the web pages' own states */
      }}
      style={styles.flex}
    />
  );
}

// ─── Native login ─────────────────────────────────────────────────────────────
function LoginScreen({
  onLoggedIn,
}: {
  onLoggedIn: (token: string, bridgeCode: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...SHELL_HEADER },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.token && data?.bridgeCode) {
        onLoggedIn(data.token, data.bridgeCode);
      } else {
        setError(data?.error || 'Could not sign in. Check your details and try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, styles.loginWrap]}>
      <Text style={styles.brand}>RENA PRO</Text>
      <Text style={styles.loginSub}>Sign in to your cleaner account</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor="#7A8A9E"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor="#7A8A9E"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.primaryBtn} onPress={submit} disabled={busy}>
        <Text style={styles.primaryBtnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────
function TabBar({ active, onSelect }: { active: string; onSelect: (k: string) => void }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((t) => (
        <Pressable key={t.key} style={styles.tab} onPress={() => onSelect(t.key)}>
          <Text style={[styles.tabText, active === t.key && styles.tabTextActive]}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PAGE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: PAGE, padding: 24 },
  mutedSmall: { marginTop: 10, color: INK2, fontSize: 13 },
  offlineTitle: { fontSize: 20, fontWeight: '600', color: INK, marginBottom: 6 },
  loginWrap: { padding: 24, justifyContent: 'center' },
  brand: { fontSize: 28, fontWeight: '700', color: INK, letterSpacing: 2, textAlign: 'center' },
  loginSub: { textAlign: 'center', color: INK2, marginTop: 6, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: INK,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  error: { color: '#dc2626', marginBottom: 12, fontSize: 13 },
  primaryBtn: {
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: LINE,
    backgroundColor: '#fff',
    paddingBottom: 18,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 11, color: INK2 },
  tabTextActive: { color: INK, fontWeight: '700' },
});
