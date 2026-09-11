import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

// The customer mark: the white RENA wordmark extracted from the confirmed
// icon source (public/rena-logo.png) onto a transparent ground. White by
// nature — on the app's light surfaces it renders navy via tintColor, on the
// navy arrival surfaces it stays white. One asset, both grounds.
const logoLockup = require('./assets/logo-lockup.png');
// The full splash artwork doubles as the JS arrival overlay, so the OS splash
// and the overlay are pixel-identical — no seam, no colour jump.
const splashArt = require('./assets/splash.png');

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL: string =
  (Constants.expoConfig?.extra?.baseUrl as string) || 'https://www.renacleaning.co.uk';
const SHELL_HEADER = {
  'x-rena-shell': `app-${Platform.OS}/${Constants.expoConfig?.version ?? '1'}`,
};
const UA_SUFFIX = `RenaApp/${Constants.expoConfig?.version ?? '1.0'}`;
const TOKEN_KEY = 'rena.customer.bearer';
const PUSH_TOKEN_KEY = 'rena.customer.pushtoken';
// Where the Pro app lives when it isn't installed. Empty until the App Store
// listing exists — the wrong-app door shows TestFlight/invite guidance instead.
const PRO_STORE_URL: string = (Constants.expoConfig?.extra?.proStoreUrl as string) || '';

// ─── Push: PRESENT BUT INERT (James-ruled, the C7 law carried over) ──────────
// The binary ships push-capable — aps-environment entitlement, remote-
// notification background mode, the expo-notifications module, deep-link
// routing — but NOTHING prompts for permission or registers a token until
// James spends the activation word for THIS app. The flag is the gate.
const PUSH_ACTIVATED = false;

// Deregistration rides every path that clears the bearer (fires before the
// bearer is deleted — the endpoint is authed). Fail-soft; with activation
// still gated there is never a token to remove, so this is dormant plumbing.
async function deregisterPush(): Promise<void> {
  try {
    const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
    if (!pushToken) return;
    const bearer = await SecureStore.getItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    if (!bearer) return;
    await fetch(`${BASE_URL}/api/push/expo/deregister`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        ...SHELL_HEADER,
      },
      body: JSON.stringify({ expoPushToken: pushToken }),
    });
  } catch {
    /* fail-soft */
  }
}

// Design tokens (light theme, mirrors the web).
const INK = '#16296b';
const PAGE = '#FAFBFC';
const SURFACE = '#ffffff';
const LINE = '#E4E9F0';
const INK2 = '#3D5170';
const MUTED = '#7A8A9E';

// Brand typography — the design law carries from Pro: bold geometric sans
// (Jost) app-wide, loaded from the committed OFL TTFs so native text matches
// the web exactly (no system-font stand-in).
const FONTS = {
  'Jost-Regular': require('./assets/fonts/Jost-Regular.ttf'),
  'Jost-Medium': require('./assets/fonts/Jost-Medium.ttf'),
  'Jost-SemiBold': require('./assets/fonts/Jost-SemiBold.ttf'),
};
const SANS = 'Jost-Regular';
const SANS_MEDIUM = 'Jost-Medium';
const SANS_SEMI = 'Jost-SemiBold';

// Keep the native splash up until the JS arrival overlay has taken over, so there
// is never a white frame between the OS splash and our first paint.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Tab bar (James-ruled, the approved mockup): five slots, BOOK raised centre.
// Home points at /account as the placeholder until the L2 Home builds in
// Phase 2; the rest wrap their portal routes.
const TABS = [
  { key: 'home', label: 'Home', path: '/en/account', icon: 'home' },
  { key: 'mycleans', label: 'My Cleans', path: '/en/account/bookings', icon: 'sparkles' },
  { key: 'book', label: 'Book', path: '/en/services', icon: 'add' },
  { key: 'cleaners', label: 'Cleaners', path: '/en/cleaners', icon: 'people' },
  { key: 'messages', label: 'Messages', path: '/en/messages', icon: 'chatbubble-ellipses' },
] as const;

type Phase = 'boot' | 'locked' | 'start' | 'login' | 'signup' | 'forgot' | 'wrongApp' | 'shell';

// ─── Cross-tab nav fix (carried from Pro): an in-page link to a TAB-ROOT route
// must switch the native tab, never navigate inside the current tab's WebView.
// Matches ONLY the five tab roots — deeper routes (/account/settings,
// /cleaners/abc, /booking/xyz) stay in-pane by design. Regex, not new URL():
// RN's URL polyfill is unreliable. /account/bookings is matched before the
// bare /account so My Cleans doesn't read as Home.
function tabRootKey(url: string): string | null {
  const m = url.match(
    /^https?:\/\/[^/]+\/(?:en\/)?(?:(account\/bookings)|(account)|(services)|(cleaners)|(messages))\/?(?:[?#].*)?$/
  );
  if (!m) return null;
  if (m[1]) return 'mycleans';
  if (m[2]) return 'home';
  if (m[3]) return 'book';
  if (m[4]) return 'cleaners';
  return 'messages';
}

// How an arriving notification presents if the app is foregrounded — set once
// at module scope per expo-notifications docs. Inert until activation.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * Deep links: resolve any of our URL shapes to a shell tab key —
 * rena://mycleans, rena://account/bookings, https://…/en/messages, and
 * notification payloads carrying data.url in those shapes. Unknown URLs
 * resolve to null and are ignored (never a crash, never a wrong screen).
 */
function tabForUrl(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const segments = [parsed.hostname, ...(parsed.path ? parsed.path.split('/') : [])]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    for (const seg of segments) {
      if (TABS.some((t) => t.key === seg)) return seg;
    }
    // URL-shaped paths that aren't tab keys still resolve via the tab roots.
    return tabRootKey(url);
  } catch {
    return null;
  }
}

// THE HAPTICS MAP (law — carried from Pro; web pages fire these via
// window.ReactNativeWebView.postMessage({type:'haptic',style})).
function fireHaptic(style: string) {
  try {
    if (style === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (style === 'warning')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (style === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (style === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    /* haptics unavailable (e.g. simulator) — ignore */
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RootView />
    </SafeAreaProvider>
  );
}

function RootView() {
  const [fontsLoaded] = useFonts(FONTS);
  const [phase, setPhase] = useState<Phase>('boot');
  // The URL the first WebView loads after login: the session-bridge, which sets
  // the WebView session cookie and redirects into the app. Null once bridged.
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('home');

  // ── Arrival overlay: the splash artwork itself, full-bleed, so OS splash →
  // JS overlay is pixel-identical (navy gradient, white mark). It fades to
  // reveal the light Start/lock/shell surfaces — the one designed transition. ──
  const overlay = useRef(new Animated.Value(1)).current;
  const [overlayMounted, setOverlayMounted] = useState(true);
  const reveal = useCallback(() => {
    Animated.timing(overlay, { toValue: 0, duration: 450, useNativeDriver: true }).start(() =>
      setOverlayMounted(false)
    );
  }, [overlay]);

  const boot = useCallback(async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    // Hand off from the OS splash to our identical JS overlay before deciding.
    await SplashScreen.hideAsync().catch(() => {});
    setPhase(token ? 'locked' : 'start');
  }, []);

  useEffect(() => {
    boot();
  }, [boot]);

  // ── Deep links: a link can arrive before the shell is up (cold start lands
  // on the lock screen) — park the resolved tab and apply on shell entry.
  const pendingTab = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const applyLink = useCallback((url: string | null | undefined) => {
    if (!url) return;
    const tab = tabForUrl(url);
    if (!tab) return;
    if (phaseRef.current === 'shell') setActiveTab(tab);
    else pendingTab.current = tab;
  }, []);

  useEffect(() => {
    Linking.getInitialURL()
      .then(applyLink)
      .catch(() => {});
    const linkSub = Linking.addEventListener('url', (e) => applyLink(e.url));
    // Notification taps route through the same resolver — dormant until push
    // activation sends the first push, harmless meanwhile.
    const noteSub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as { url?: unknown } | null;
      if (data && typeof data.url === 'string') applyLink(data.url);
    });
    return () => {
      linkSub.remove();
      noteSub.remove();
    };
  }, [applyLink]);

  useEffect(() => {
    if (phase === 'shell' && pendingTab.current) {
      setActiveTab(pendingTab.current);
      pendingTab.current = null;
    }
  }, [phase]);

  // Face-ID-first lock screen for returning users (the Pro pattern): Face ID
  // fires immediately; a failed or cancelled prompt settles onto the same
  // screen with a quiet note — password and switch-account live behind links.
  const [lockFailed, setLockFailed] = useState(false);
  const unlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setPhase('shell');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Rena',
      fallbackLabel: 'Use passcode',
    });
    if (res.success) {
      setLockFailed(false);
      setPhase('shell');
    } else {
      setLockFailed(true);
    }
  }, []);

  useEffect(() => {
    if (phase === 'locked') unlock();
  }, [phase, unlock]);

  // Reveal the content the moment we land on a real screen AND the brand fonts
  // are ready — so no system-font text ever flashes behind the fade.
  useEffect(() => {
    if ((phase === 'start' || phase === 'shell' || phase === 'locked') && fontsLoaded) reveal();
  }, [phase, fontsLoaded, reveal]);

  const onLoggedIn = useCallback(async (token: string, bridgeCode: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    const url = `${BASE_URL}/api/auth/session-bridge?code=${encodeURIComponent(
      bridgeCode
    )}&callbackUrl=${encodeURIComponent('/en/account')}`;
    setBridgeUrl(url);
    setActiveTab('home');
    setPhase('shell');
  }, []);

  // Role gate (James-ruled, both directions always with a door): a CLEANER
  // login in the customer shell never enters — the bearer is never stored,
  // and the friendly full-screen door points at Rena Pro.
  const onWrongApp = useCallback(() => {
    setPhase('wrongApp');
  }, []);

  const logout = useCallback(async () => {
    await deregisterPush();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // A signed-out app must not keep a stale count on the icon.
    Notifications.setBadgeCountAsync(0).catch(() => {});
    setBridgeUrl(null);
    setPhase('login');
  }, []);

  // Leaving the lock screen for the password form or another account clears
  // the stored bearer either way; the destinations differ.
  const goToPasswordLogin = useCallback(async () => {
    await deregisterPush();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setBridgeUrl(null);
    setLockFailed(false);
    setPhase('login');
  }, []);
  const switchAccount = useCallback(async () => {
    await deregisterPush();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setBridgeUrl(null);
    setLockFailed(false);
    setPhase('start');
  }, []);

  // Push registration — GATED. Wired and ready, but PUSH_ACTIVATED is false
  // until James spends the activation word for this app: no permission prompt,
  // no token, no sends. iOS grants the permission ask exactly one clean
  // chance, so it stays unspent until the moment is chosen.
  const registerPush = useCallback(async () => {
    try {
      const bearer = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!bearer) return;
      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== 'granted' && current.canAskAgain !== false) {
        status = (await Notifications.requestPermissionsAsync()).status;
      }
      if (status !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const expo = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (!expo?.data) return;
      const stored = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
      if (stored === expo.data) return; // this device is already registered
      const res = await fetch(`${BASE_URL}/api/push/expo/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
          ...SHELL_HEADER,
        },
        body: JSON.stringify({
          expoPushToken: expo.data,
          platform: Platform.OS === 'android' ? 'android' : 'ios',
        }),
      });
      if (res.ok) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, expo.data);
    } catch {
      /* fail-soft */
    }
  }, []);
  useEffect(() => {
    if (phase === 'shell' && PUSH_ACTIVATED) registerPush();
  }, [phase, registerPush]);

  return (
    <View style={styles.root}>
      {/* The arrival overlay is navy — light status bar text while it shows. */}
      <StatusBar style={overlayMounted ? 'light' : 'dark'} />

      {phase === 'locked' && (
        <LockScreen
          failed={lockFailed}
          onUnlock={() => {
            fireHaptic('light');
            unlock();
          }}
          onUsePassword={() => {
            fireHaptic('light');
            goToPasswordLogin();
          }}
          onSwitchAccount={() => {
            fireHaptic('light');
            switchAccount();
          }}
        />
      )}
      {phase === 'start' && (
        <StartScreen onLogin={() => setPhase('login')} onSignup={() => setPhase('signup')} />
      )}
      {phase === 'login' && (
        <LoginScreen
          onLoggedIn={onLoggedIn}
          onWrongApp={onWrongApp}
          onBack={() => setPhase('start')}
          onForgot={() => setPhase('forgot')}
        />
      )}
      {phase === 'signup' && <SignupScreen onBack={() => setPhase('start')} />}
      {phase === 'forgot' && <ForgotScreen onBack={() => setPhase('login')} />}
      {phase === 'wrongApp' && <WrongAppScreen onSwitchAccount={() => setPhase('login')} />}
      {phase === 'shell' && (
        <ShellScreen
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          bridgeUrl={bridgeUrl}
          onBridged={() => setBridgeUrl(null)}
          onSessionLost={logout}
        />
      )}

      {overlayMounted && (
        <Animated.View style={[styles.arrival, { opacity: overlay }]} pointerEvents="none">
          <Image source={splashArt} style={styles.arrivalArt} resizeMode="cover" />
        </Animated.View>
      )}
    </View>
  );
}

// ─── The editorial settle — fade + 4px rise, ~300ms, staggered ~60ms ──────────
function useSettle(steps: number) {
  const values = useRef(Array.from({ length: steps }, () => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.parallel(
      values.map((v, i) =>
        Animated.timing(v, { toValue: 1, duration: 300, delay: i * 60, useNativeDriver: true })
      )
    ).start();
  }, [values]);
  return values.map((v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
  }));
}

// ─── Start screen (customer voice) ────────────────────────────────────────────
// Light surface per the design law; the white mark renders navy via tintColor.
// Account-only, zero guest surfaces: the only doors are Log In and Sign Up.
function StartScreen({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const insets = useSafeAreaInsets();
  const [lockupSettle, taglineSettle, actionsSettle] = useSettle(3);
  return (
    <View style={[styles.startWrap, { paddingTop: insets.top + 24 }]}>
      <View style={styles.startHero}>
        <Animated.Image
          source={logoLockup}
          style={[styles.startWordmark, lockupSettle]}
          resizeMode="contain"
          tintColor={INK}
        />
        <Animated.View style={[styles.startTaglineBlock, taglineSettle]}>
          <Text style={styles.startEyebrow}>CLEANING NETWORK</Text>
          <Text style={styles.startTitle}>Your home, sorted.</Text>
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.startActions, { paddingBottom: insets.bottom + 16 }, actionsSettle]}
      >
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={() => {
            fireHaptic('light');
            onLogin();
          }}
        >
          <Text style={styles.primaryBtnText}>Log In</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => {
            fireHaptic('light');
            onSignup();
          }}
        >
          <Text style={styles.secondaryBtnText}>Create an Account</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Face-ID-first lock screen (returning users) ──────────────────────────────
function LockScreen({
  failed,
  onUnlock,
  onUsePassword,
  onSwitchAccount,
}: {
  failed: boolean;
  onUnlock: () => void;
  onUsePassword: () => void;
  onSwitchAccount: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [lockupSettle, bodySettle, actionsSettle] = useSettle(3);
  return (
    <View style={[styles.startWrap, { paddingTop: insets.top + 24 }]}>
      <View style={[styles.startHero, styles.lockHero]}>
        <Animated.Image
          source={logoLockup}
          style={[styles.startWordmark, lockupSettle]}
          resizeMode="contain"
          tintColor={INK}
        />
        <Animated.View style={[{ alignItems: 'center' }, bodySettle]}>
          <Text style={styles.lockTitle}>Welcome back</Text>
          <Text style={styles.mutedSmall}>
            {failed ? 'Face ID didn’t complete — try again.' : 'Unlock with Face ID to continue.'}
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.startActions, { paddingBottom: insets.bottom + 16 }, actionsSettle]}
      >
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onUnlock}
        >
          <Text style={styles.primaryBtnText}>Unlock</Text>
        </Pressable>
        <View style={styles.lockLinksRow}>
          <Pressable onPress={onUsePassword} hitSlop={10}>
            <Text style={styles.lockLink}>Use password instead</Text>
          </Pressable>
          <Text style={styles.lockLinkDot}>·</Text>
          <Pressable onPress={onSwitchAccount} hitSlop={10}>
            <Text style={styles.lockLink}>Switch account</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Native login ─────────────────────────────────────────────────────────────
function LoginScreen({
  onLoggedIn,
  onWrongApp,
  onBack,
  onForgot,
}: {
  onLoggedIn: (token: string, bridgeCode: string) => void;
  onWrongApp: () => void;
  onBack: () => void;
  onForgot: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
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
        // Role gate: a cleaner account never enters the customer shell — the
        // bearer is NOT stored; the door screen points at Rena Pro instead.
        if (data?.user?.role === 'CLEANER') {
          fireHaptic('warning');
          onWrongApp();
          return;
        }
        fireHaptic('success');
        onLoggedIn(data.token, data.bridgeCode);
      } else {
        fireHaptic('error');
        setError(data?.error || 'Could not sign in. Check your details and try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.flex, styles.loginWrap, { paddingTop: insets.top + 8 }]}
    >
      <Pressable style={styles.backRow} onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={INK2} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.loginBody}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={logoLockup}
          style={styles.loginWordmark}
          resizeMode="contain"
          tintColor={INK}
        />
        <Text style={styles.loginSub}>Sign in to your Rena account</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={MUTED}
        />
        <View style={styles.pwRow}>
          <TextInput
            style={[styles.input, styles.pwInput]}
            placeholder="Password"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={setPassword}
            placeholderTextColor={MUTED}
          />
          <Pressable style={styles.pwEye} onPress={() => setShowPw((v) => !v)} hitSlop={10}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={INK2} />
          </Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={submit}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>{busy ? 'Signing In…' : 'Sign In'}</Text>
        </Pressable>
        <Pressable onPress={onForgot} hitSlop={8} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={{ fontFamily: SANS_MEDIUM, color: INK2, fontSize: 14, lineHeight: 20 }}>
            Forgot password?
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Role gate door (James-ruled: friendly, never a dead end) ─────────────────
// Shown when a CLEANER account signs in here. Offers the Pro deep link (or
// TestFlight guidance while no store listing exists) and a different-account
// door. No session was stored — Back to login is a clean slate.
function WrongAppScreen({ onSwitchAccount }: { onSwitchAccount: () => void }) {
  const insets = useSafeAreaInsets();
  const [lockupSettle, bodySettle, actionsSettle] = useSettle(3);
  const [proMissing, setProMissing] = useState(false);

  const openPro = useCallback(async () => {
    fireHaptic('light');
    try {
      const can = await Linking.canOpenURL('renapro://');
      if (can) {
        await Linking.openURL('renapro://');
        return;
      }
    } catch {
      /* fall through to guidance */
    }
    if (PRO_STORE_URL) {
      Linking.openURL(PRO_STORE_URL).catch(() => setProMissing(true));
    } else {
      setProMissing(true);
    }
  }, []);

  return (
    <View style={[styles.startWrap, { paddingTop: insets.top + 24 }]}>
      <View style={[styles.startHero, styles.lockHero]}>
        <Animated.Image
          source={logoLockup}
          style={[styles.startWordmark, lockupSettle]}
          resizeMode="contain"
          tintColor={INK}
        />
        <Animated.View style={[{ alignItems: 'center', paddingHorizontal: 8 }, bodySettle]}>
          <Text style={styles.lockTitle}>You’re a cleaner</Text>
          <Text style={[styles.mutedSmall, { textAlign: 'center' }]}>
            This is the app customers use to book cleans. Your app is Rena Pro — your jobs, earnings
            and availability all live there.
          </Text>
          {proMissing && (
            <Text style={[styles.mutedSmall, { textAlign: 'center' }]}>
              Rena Pro is currently on TestFlight — open it from your TestFlight invite. The App
              Store listing is coming soon.
            </Text>
          )}
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.startActions, { paddingBottom: insets.bottom + 16 }, actionsSettle]}
      >
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={openPro}
        >
          <Text style={styles.primaryBtnText}>Open Rena Pro</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            fireHaptic('light');
            onSwitchAccount();
          }}
          hitSlop={8}
          style={{ alignSelf: 'center', paddingVertical: 8 }}
        >
          <Text style={styles.lockLink}>Log in with a different account</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Forgot password, in-shell (marketing chrome hidden) ─────────────────────
function ForgotScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <View style={[styles.subHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.backRow} onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={INK2} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <SeamlessWebView
        uri={`${BASE_URL}/en/forgot-password`}
        injectBefore={HIDE_CHROME_JS + SEAM_KILL_JS}
        loaderTone="light"
      />
    </View>
  );
}

// The marketing nav/footer are stripped by native-injected CSS as a belt to
// the web-side rena-customer-shell body class's suspenders — zero
// unconditional web change either way, so the website is untouched.
const HIDE_CHROME_JS = `
  (function(){
    var s=document.createElement('style');
    s.innerHTML='#layout-nav,#layout-footer{display:none!important}'
      + 'a[aria-label="Contact us"],button[aria-label="Open chat"],button[aria-label="Close chat"]{display:none!important}';
    document.documentElement.appendChild(s);
  })(); true;
`;

// ─── Create an Account (in-shell /signup, chrome hidden) ─────────────────────
function SignupScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <View style={[styles.subHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.backRow} onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={INK2} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <SeamlessWebView
        uri={`${BASE_URL}/en/signup`}
        injectBefore={HIDE_CHROME_JS + SEAM_KILL_JS}
        loaderTone="light"
      />
    </View>
  );
}

// ─── Shell (tabbed WebViews) ──────────────────────────────────────────────────
function ShellScreen({
  activeTab,
  setActiveTab,
  bridgeUrl,
  onBridged,
  onSessionLost,
}: {
  activeTab: string;
  setActiveTab: (k: string) => void;
  bridgeUrl: string | null;
  onBridged: () => void;
  onSessionLost: () => void;
}) {
  const selectTab = useCallback(
    (k: string) => {
      fireHaptic('light');
      setActiveTab(k);
    },
    [setActiveTab]
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.flex}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          // The Home tab loads the bridge URL first (sets the cookie); once
          // bridged it and every other tab load their route directly (shared
          // cookie jar). Keep tabs mounted to preserve scroll/state.
          const uri = tab.key === 'home' && bridgeUrl ? bridgeUrl : `${BASE_URL}${tab.path}`;
          return (
            <TabPane key={tab.key} active={isActive}>
              <SeamlessWebView
                uri={uri}
                injectBefore={HIDE_CHROME_JS + SEAM_KILL_JS}
                onSessionLost={onSessionLost}
                onBridged={tab.key === 'home' ? onBridged : undefined}
                tabKey={tab.key}
                onCrossTab={selectTab}
              />
            </TabPane>
          );
        })}
      </View>
      <TabBar active={activeTab} onSelect={selectTab} />
    </SafeAreaView>
  );
}

// ─── Tab cross-fade — the incoming pane fades in over 150ms ───────────────────
function TabPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  const fade = useRef(new Animated.Value(active ? 1 : 0)).current;
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) {
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    wasActive.current = active;
  }, [active, fade]);
  return (
    <Animated.View style={[styles.flex, { display: active ? 'flex' : 'none', opacity: fade }]}>
      {children}
    </Animated.View>
  );
}

// ─── WebView wrapper: seam-kill loader, shell headers, haptics + PTR bridge ────
const SEAM_KILL_JS = `
  (function(){
    var s=document.createElement('style');
    s.innerHTML='*{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}'
      + 'input,textarea,select,[contenteditable]{-webkit-user-select:text!important;user-select:text!important;}'
      + 'html{-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent;overscroll-behavior-y:contain;}';
    document.documentElement.appendChild(s);
    var m=document.querySelector('meta[name=viewport]');
    if(!m){m=document.createElement('meta');m.name='viewport';(document.head||document.documentElement).appendChild(m);}
    m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  })();
  (function(){
    var startY=0,pulling=false,TH=72;
    var el=document.createElement('div');
    el.style.cssText='position:fixed;top:0;left:0;right:0;display:flex;justify-content:center;padding-top:12px;transform:translateY(-46px);transition:transform .18s ease;z-index:99999;pointer-events:none;';
    el.innerHTML='<div id="__rspin" style="width:26px;height:26px;border-radius:50%;border:2px solid #E4E9F0;border-top-color:#16296b;box-sizing:border-box;"></div>';
    var sty=document.createElement('style');sty.innerHTML='@keyframes __rspin{to{transform:rotate(360deg)}}';document.documentElement.appendChild(sty);
    function mount(){if(document.body&&!el.parentNode)document.body.appendChild(el);}
    document.addEventListener('DOMContentLoaded',mount);mount();
    function top(){return (document.scrollingElement||document.documentElement||document.body).scrollTop;}
    window.addEventListener('touchstart',function(e){if(top()<=0){startY=e.touches[0].clientY;pulling=true;}},{passive:true});
    window.addEventListener('touchmove',function(e){if(!pulling)return;var d=e.touches[0].clientY-startY;if(d>0){el.style.transform='translateY('+Math.min(d*0.5-46,26)+'px)';}},{passive:true});
    window.addEventListener('touchend',function(e){if(!pulling)return;pulling=false;var d=e.changedTouches[0].clientY-startY;if(d>TH){document.getElementById('__rspin').style.animation='__rspin .6s linear infinite';el.style.transform='translateY(20px)';setTimeout(function(){el.style.transform='translateY(-46px)';document.getElementById('__rspin').style.animation='';},650);if(typeof window.__renaRefresh==='function'){window.__renaRefresh();}else{location.reload();}}else{el.style.transform='translateY(-46px)';}},{passive:true});
  })();
  true;
`;

function SeamlessWebView({
  uri,
  injectBefore,
  onSessionLost,
  onBridged,
  tabKey,
  onCrossTab,
  loaderTone = 'light',
}: {
  uri: string;
  injectBefore: string;
  onSessionLost?: () => void;
  onBridged?: () => void;
  /** Which tab this pane belongs to — enables the cross-tab nav intercept. */
  tabKey?: string;
  /** Called with the target tab key when an in-page link hits another tab's root. */
  onCrossTab?: (key: string) => void;
  loaderTone?: 'light' | 'navy';
}) {
  const [offline, setOffline] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const ref = useRef<WebView>(null);
  // Cold-start false-alarm fix (carried from Pro): a single onError never
  // declares offline — up to two silent retries run behind the loader
  // (0.6s / 1.2s back-off); only a third consecutive failure shows the
  // offline screen. A successful load resets the budget.
  const retryBudget = useRef(0);
  const retryPending = useRef(false);

  useEffect(() => {
    if (loaded) {
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }
  }, [loaded, fade]);

  // If the web session expires, the site redirects to /login — bounce back to
  // the native login screen instead of showing the web form inside the shell.
  const onNav = (nav: WebViewNavigation) => {
    if (onSessionLost && (/\/login(\?|$)/.test(nav.url) || /\/api\/auth\/signin/.test(nav.url))) {
      onSessionLost();
    }
    // Cross-tab nav fix: SPA pushState navigations can't be cancelled by
    // onShouldStartLoadWithRequest — when one lands on another tab's root,
    // switch the native tab and step this pane's history back to its own route.
    if (tabKey && onCrossTab) {
      const target = tabRootKey(nav.url);
      if (target && target !== tabKey) {
        onCrossTab(target);
        ref.current?.injectJavaScript('window.history.back(); true;');
        return;
      }
    }
    // The Home tab boots on the single-use session-bridge URL, which redirects
    // to /account. Once landed past the bridge, clear bridgeUrl so Home
    // reverts to loading its route directly — otherwise a reload re-requests
    // the spent code and renders the bridge's 401.
    if (
      onBridged &&
      /\/account(\?|#|$)/.test(nav.url) &&
      !nav.url.includes('/api/auth/session-bridge')
    ) {
      onBridged();
    }
  };

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'haptic') fireHaptic(String(msg.style || 'light'));
    } catch {
      /* ignore non-JSON messages */
    }
  };

  if (serverError) {
    return (
      <View style={styles.center}>
        <Image
          source={logoLockup}
          style={styles.loaderWordmark}
          resizeMode="contain"
          tintColor={INK}
        />
        <Text style={[styles.offlineTitle, { marginTop: 22 }]}>We&apos;re having a moment</Text>
        <Text style={styles.mutedSmall}>
          Something went wrong on our side. Your bookings are safe.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, styles.retryBtn, pressed && styles.pressed]}
          onPress={() => {
            setServerError(false);
            setLoaded(false);
            fade.setValue(1);
            ref.current?.reload();
          }}
        >
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  if (offline) {
    return (
      <View style={styles.center}>
        <Text style={styles.offlineTitle}>You&apos;re offline</Text>
        <Text style={styles.mutedSmall}>Check your connection and try again.</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, styles.retryBtn, pressed && styles.pressed]}
          onPress={() => {
            retryBudget.current = 0; // fresh silent-retry budget for the manual retry
            setOffline(false);
            setLoaded(false);
            fade.setValue(1);
            ref.current?.reload();
          }}
        >
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <WebView
        ref={ref}
        source={{ uri, headers: SHELL_HEADER }}
        applicationNameForUserAgent={UA_SUFFIX}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        pullToRefreshEnabled={false}
        bounces
        decelerationRate="normal"
        allowsBackForwardNavigationGestures
        allowsLinkPreview={false}
        injectedJavaScriptBeforeContentLoaded={injectBefore}
        onShouldStartLoadWithRequest={(req) => {
          if (tabKey && onCrossTab) {
            const target = tabRootKey(req.url);
            if (target && target !== tabKey) {
              onCrossTab(target);
              return false;
            }
          }
          return true;
        }}
        onNavigationStateChange={onNav}
        onMessage={onMessage}
        onLoadEnd={() => {
          if (retryPending.current) return; // silent retry in flight — keep the loader up
          retryBudget.current = 0; // real load landed — reset the silent-retry budget
          setLoaded(true);
        }}
        onError={() => {
          if (retryBudget.current < 2) {
            retryBudget.current += 1;
            retryPending.current = true;
            setLoaded(false);
            fade.setValue(1);
            setTimeout(() => {
              retryPending.current = false;
              ref.current?.reload();
            }, 600 * retryBudget.current);
            return;
          }
          setOffline(true);
        }}
        onHttpError={(e) => {
          // A 5xx on OUR origin gets the designed interstitial; sub-resource
          // and third-party errors stay with the web pages' own states.
          const { statusCode, url } = e.nativeEvent;
          if (statusCode >= 500 && typeof url === 'string' && url.startsWith(BASE_URL)) {
            setServerError(true);
          }
        }}
        style={[styles.flex, { backgroundColor: loaderTone === 'navy' ? INK : PAGE }]}
      />
      {!loaded && (
        <Animated.View
          style={[
            styles.webLoader,
            { opacity: fade, backgroundColor: loaderTone === 'navy' ? INK : PAGE },
          ]}
          pointerEvents="none"
        >
          <Image
            source={logoLockup}
            style={styles.loaderWordmark}
            resizeMode="contain"
            tintColor={loaderTone === 'navy' ? undefined : INK}
          />
          <ActivityIndicator
            color={loaderTone === 'navy' ? '#fff' : INK}
            style={{ marginTop: 18 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Tab bar: five slots, BOOK raised centre (the approved mockup) ────────────
function TabBar({ active, onSelect }: { active: string; onSelect: (k: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t) => {
        const on = active === t.key;
        if (t.key === 'book') {
          // The raised centre BOOK slot: a navy circle lifted above the bar.
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => onSelect(t.key)} hitSlop={6}>
              <View style={[styles.bookCircle, on && styles.bookCircleActive]}>
                <Ionicons name="add" size={30} color="#fff" />
              </View>
              <Text style={[styles.tabText, styles.bookText, on && styles.tabTextActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={t.key} style={styles.tab} onPress={() => onSelect(t.key)} hitSlop={6}>
            <Ionicons
              name={(on ? t.icon : `${t.icon}-outline`) as keyof typeof Ionicons.glyphMap}
              size={23}
              color={on ? INK : MUTED}
            />
            <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE },
  flex: { flex: 1, backgroundColor: PAGE },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PAGE,
    padding: 24,
  },
  pressed: { opacity: 0.85 },
  mutedSmall: { fontFamily: SANS, marginTop: 10, color: INK2, fontSize: 13, lineHeight: 18 },

  // Arrival overlay: the splash artwork full-bleed (navy gradient, white mark).
  arrival: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1F2C4C',
  },
  arrivalArt: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined },

  // Start screen — the customer lockup is a single wordmark line (~3.3:1),
  // rendered navy on the light surface.
  startWrap: {
    flex: 1,
    backgroundColor: PAGE,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  startHero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  startWordmark: { width: 224, height: 68 },
  startTaglineBlock: { alignItems: 'center', marginTop: 26 },
  startEyebrow: {
    fontFamily: SANS_SEMI,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 2.2,
    color: MUTED,
  },
  startTitle: {
    fontFamily: SANS_SEMI,
    fontSize: 30,
    color: INK,
    lineHeight: 38,
    marginTop: 8,
    textAlign: 'center',
  },
  startActions: { gap: 12 },

  // Lock screen
  lockHero: { alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: SANS_SEMI, fontSize: 24, lineHeight: 32, color: INK, marginTop: 18 },
  lockLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  lockLink: {
    fontFamily: SANS_MEDIUM,
    color: INK2,
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 6,
  },
  lockLinkDot: { fontFamily: SANS, color: MUTED, fontSize: 14, lineHeight: 20 },

  // WebView seam-kill loader — single-line wordmark ratio.
  webLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWordmark: { width: 158, height: 48 },

  // Login
  loginWrap: { backgroundColor: PAGE, paddingHorizontal: 24 },
  loginBody: { flexGrow: 1, justifyContent: 'center', paddingBottom: 48 },
  loginWordmark: { width: 178, height: 54, alignSelf: 'center', marginBottom: 10 },
  loginSub: {
    fontFamily: SANS,
    textAlign: 'center',
    color: INK2,
    marginTop: 4,
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 21,
  },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 20,
    color: INK,
    marginBottom: 12,
    backgroundColor: SURFACE,
  },
  error: { fontFamily: SANS, color: '#dc2626', marginBottom: 12, fontSize: 13, lineHeight: 18 },
  pwRow: { position: 'relative' },
  pwInput: { paddingRight: 44 },
  pwEye: { position: 'absolute', right: 14, top: 15 },

  // Sub-screen header (signup / forgot)
  subHeader: { backgroundColor: PAGE, paddingHorizontal: 16, paddingBottom: 8 },
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: SANS, color: INK2, fontSize: 16, lineHeight: 22, marginLeft: 2 },

  // Buttons
  primaryBtn: {
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: SANS_SEMI, color: '#fff', fontSize: 16, lineHeight: 22 },
  secondaryBtn: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: SANS_SEMI, color: INK, fontSize: 16, lineHeight: 22 },
  retryBtn: { marginTop: 18, paddingHorizontal: 28 },

  offlineTitle: {
    fontFamily: SANS_SEMI,
    fontSize: 20,
    lineHeight: 27,
    color: INK,
    marginBottom: 6,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    backgroundColor: SURFACE,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabText: { fontFamily: SANS_SEMI, fontSize: 10.5, lineHeight: 15, color: MUTED },
  tabTextActive: { fontFamily: SANS_SEMI, color: INK },
  // The raised BOOK circle: navy, lifted above the bar line.
  bookCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    shadowColor: '#0A1230',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  bookCircleActive: { backgroundColor: '#203a85' },
  bookText: { marginTop: 2 },
});
