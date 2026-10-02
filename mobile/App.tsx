import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
// R4 lane 4: legacy API for downloadAsync-with-headers — the module ships in
// every SDK 54 binary as a dependency of expo itself (verify against the
// build's fingerprint before OTA, per the ruled gate).
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

// James's official "RENA Cleaner" logo lockup, extracted from the supplied asset
// with its exact colours untouched (navy RENA in Etna + teal "Cleaner"), on a
// transparent ground so it sits on the app's light surfaces. Used on every native
// surface — no recoloured variant exists (the whole shell is light).
const logoLockup = require('./assets/logo-lockup.png');
// Appearance item 1 (James-ruled): the OS splash artwork itself — the arrival
// overlay and every web loader render THIS, full-bleed contain on #EBEBEB, so
// splash → loader → page is one unbroken picture with a breathing mark.
const splashMark = require('./assets/splash.png');

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL: string =
  (Constants.expoConfig?.extra?.baseUrl as string) || 'https://www.renacleaning.co.uk';
const SHELL_HEADER = {
  'x-rena-shell': `pro-${Platform.OS}/${Constants.expoConfig?.version ?? '1'}`,
};
const UA_SUFFIX = `RenaPro/${Constants.expoConfig?.version ?? '1.0'}`;
const BASE_HOST = (BASE_URL.match(/^https?:\/\/([^/:?#]+)/) || [])[1] || '';
const TOKEN_KEY = 'rena.pro.bearer';
// Where the customer app lives when it isn't installed. Empty until its App
// Store listing exists — the wrong-app door shows guidance text instead.
const CUSTOMER_STORE_URL: string = (Constants.expoConfig?.extra?.customerStoreUrl as string) || '';
// C7 activation (1.0.1 cargo): the device's registered Expo push token —
// stored so re-registration is a no-op and logout can deregister it.
const PUSH_TOKEN_KEY = 'rena.pro.pushtoken';

// C7 ACTIVATION (1.0.1 cargo — James's activation word SPENT for this build):
// deregistration rides every path that clears the bearer. Fires BEFORE the
// bearer is deleted (the endpoint is authed); fail-soft — a missed
// deregister only leaves a dormant token row, never a broken logout.
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
// Appearance item 1 (James-ruled): the OS splash ground — the arrival overlay
// and web loaders sit on this exact colour so the open is one picture.
const SPLASH_GREY = '#EBEBEB';
const SURFACE = '#ffffff';
const LINE = '#E4E9F0';
const INK2 = '#3D5170';
const MUTED = '#7A8A9E';
// Pro Navy design law (James-ruled, supersedes the earlier no-teal ruling):
// teal-green holds MONEY, and only money — the web money surfaces use the teal
// token for figures in motion. The shell itself renders no money natively, so
// no teal constant lives here; the lockup's teal stays confined to the logo.
// Primary UI accent is INK (#16296b).

// Brand typography — Pro Navy design law: bold geometric sans (Jost) app-wide,
// Newsreader retired from the app entirely. Loaded from the committed OFL TTFs
// so native text matches the web exactly (no system-font stand-in). Keys match
// the file family names registered via useFonts().
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

// Tab bar: first tab = the purpose-built Today screen; the rest are portal routes.
// R5b port: paths are unprefixed — the site 307s /en/<route> to /<route>
// (en is the default locale), so the old /en/ paths paid a redirect on
// EVERY pane document load. tabRootKey matches both shapes.
// R12 Lane 4: the three rooms with nothing honest to show pre-verification.
const LOCKED_UNTIL_VERIFIED: ReadonlySet<string> = new Set(['jobs', 'earnings', 'messages']);
const EMPTY_LOCK: ReadonlySet<string> = new Set();

const TABS = [
  { key: 'today', label: 'Today', path: '/app/today', icon: 'today' },
  { key: 'jobs', label: 'Jobs', path: '/app/jobs', icon: 'briefcase' },
  { key: 'availability', label: 'Availability', path: '/app/availability', icon: 'calendar' },
  { key: 'earnings', label: 'Earnings', path: '/app/earnings', icon: 'wallet' },
  { key: 'messages', label: 'Messages', path: '/messages', icon: 'chatbubble-ellipses' },
] as const;

type Phase = 'boot' | 'locked' | 'start' | 'login' | 'join' | 'forgot' | 'wrongApp' | 'shell';

// ─── Cross-tab nav fix (James-ruled): an in-page link to a TAB-ROOT route must
// switch the native tab, never navigate inside the current tab's WebView (which
// left e.g. the Today pane showing Availability while the tab bar said Today).
// Matches ONLY the five tab roots — deeper routes (/app/offer/123, /cleaner/*)
// stay in-pane by design. Regex, not new URL(): RN's URL polyfill is unreliable.
function tabRootKey(url: string): string | null {
  const m = url.match(
    /^https?:\/\/[^/]+\/(?:en\/)?(?:app\/(today|jobs|availability|earnings)|(messages))\/?(?:[?#].*)?$/
  );
  if (!m) return null;
  return m[1] || 'messages';
}

// ─── C7 binary trio (James-ruled: BUILT, NOT ACTIVATED) ──────────────────────
// The store binary ships push-capable — aps-environment entitlement, remote-
// notification background mode, the expo-notifications module, deep-link
// routing, and icon-badge sync — but NOTHING here prompts for notification
// permission or registers a push token. Offer-push ACTIVATION (permission ask,
// token registration with the server, actual sends) holds for James's separate
// explicit word once real cleaners are live. Until then no push ever arrives,
// so the handlers below are dormant plumbing, and the iOS icon badge stays
// invisible (badge display rides the notification permission that activation
// will request).

// How an arriving notification presents if the app is foregrounded — set once
// at module scope per expo-notifications docs. Inert until pushes exist.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

/**
 * C7 deep links: resolve any of our URL shapes to a shell tab key —
 * renapro://jobs, renapro://app/jobs, https://www.renacleaning.co.uk/en/app/jobs,
 * and notification payloads carrying data.url in those shapes. Unknown URLs
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
    return null;
  } catch {
    return null;
  }
}

// THE HAPTICS MAP (law — native and web bridge both follow it):
//   light   → navigation taps: tabs, chips, steppers, opening sheets/links
//   medium  → committing an action: lifecycle advance, accept/decline, copy-to-weekdays
//   success → a commit confirmed by the server: job accepted, saved, signed in
//   warning → cautionary states surfaced to the user
//   error   → a commit failed or was rejected
// Web pages fire these via window.ReactNativeWebView.postMessage({type:'haptic',style}).
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

// ─── Appearance item 1 (James-ruled): the breathing splash mark ──────────────
// The exact OS-splash picture (splash.png, contain, centred) with the mark
// breathing — scale 1.0 → 1.05 on a ~2s eased cycle. Used by the arrival
// overlay and the web loaders so the whole open is one living picture:
// no spinner, no white flash, no seam.
function BreathingMark() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  // R21 Piece 1 (James-ruled): the breath scaled the full-bleed splash
  // artwork — the whole screen — so at 1.05 its edges slid past the screen
  // bounds (born with A1's loader, a6397a2). The artwork stays full-bleed at
  // scale 1 so the OS-splash handoff is pixel-identical, and the breath now
  // clips at the container: edge growth is solid ground and clips invisibly,
  // while the centred mark breathes within bounds.
  return (
    <View style={[StyleSheet.absoluteFillObject, { overflow: 'hidden' }]}>
      <Animated.Image
        source={splashMark}
        style={[
          StyleSheet.absoluteFillObject,
          { width: undefined, height: undefined, transform: [{ scale }] },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

function RootView() {
  const [fontsLoaded] = useFonts(FONTS);
  const [phase, setPhase] = useState<Phase>('boot');
  // The URL the first WebView loads after login: the session-bridge, which sets
  // the WebView session cookie and redirects into the app. Null once bridged.
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('today');

  // ── Arrival overlay (Appearance item 1, James-ruled): the OS splash picture
  // itself — #EBEBEB with the PRO mark breathing — held until a real screen is
  // ready, then a ~300ms fade into the destination. OS splash → this overlay is
  // pixel-identical, so there is no seam and never a white flash. ──
  const overlay = useRef(new Animated.Value(1)).current;
  const [overlayMounted, setOverlayMounted] = useState(true);
  const reveal = useCallback(() => {
    Animated.timing(overlay, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
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

  // ── C7 deep links: a link can arrive before the shell is up (cold start
  // lands on the lock screen) — park the resolved tab and apply on shell entry.
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
    // Notification taps route through the same resolver — dormant until C7
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

  // C5: Face-ID-first. The lock screen (lockup + one Unlock button) is the
  // returning-user arrival; Face ID fires immediately on top of it. A failed or
  // cancelled prompt just settles onto the same screen with a quiet note (the
  // old A3 retry card is folded in) — password and switch-account live behind
  // text links.
  const [lockFailed, setLockFailed] = useState(false);
  const unlock = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      setPhase('shell');
      return;
    }
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Rena Pro',
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

  // Reveal the content the moment we land on a real screen (Start / lock / shell)
  // AND the brand fonts are ready — so no system-font text ever flashes behind
  // the fade. C5: the lock screen reveals immediately so the Face ID prompt is
  // seen firing over the designed screen, not over a blank overlay.
  useEffect(() => {
    if ((phase === 'start' || phase === 'shell' || phase === 'locked') && fontsLoaded) reveal();
  }, [phase, fontsLoaded, reveal]);

  const onLoggedIn = useCallback(async (token: string, bridgeCode: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    const url = `${BASE_URL}/api/auth/session-bridge?code=${encodeURIComponent(
      bridgeCode
    )}&callbackUrl=${encodeURIComponent('/app/today')}`;
    // R8 follow-up (James-ordered): redeem the bridge NATIVELY, so no pane
    // ever holds the bridge URL — the spent-code replay class dies at the
    // root. The native fetch's cookie jar is shared with the WebViews (iOS:
    // NSHTTPCookieStorage + sharedCookiesEnabled; Android: okhttp's cookie
    // handler is the webkit CookieManager). Fail-soft: if the native
    // redemption can't complete, the old in-WebView bridge runs as before —
    // now itself protected server-side by the R8 self-heal.
    let bridged = false;
    try {
      const res = await fetch(url, { headers: SHELL_HEADER });
      bridged = res.ok; // the follow of the 307 lands 200 with the cookie
    } catch {
      /* fall back to the in-WebView bridge */
    }
    setBridgeUrl(bridged ? null : url);
    setActiveTab('today');
    setPhase('shell');
  }, []);

  const logout = useCallback(async () => {
    await deregisterPush();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    // C7: a signed-out app must not keep a stale count on the icon.
    Notifications.setBadgeCountAsync(0).catch(() => {});
    setBridgeUrl(null);
    setPhase('login');
  }, []);

  // C5: leaving the lock screen for the password form or another account clears
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

  // C7 ACTIVATION (1.0.1 cargo — James's activation word SPENT for this
  // build): the one clean permission ask, fired on arrival in the shell,
  // then Expo-token registration to the signed-in account. Idempotent (the
  // stored token short-circuits) and fail-soft throughout — activation must
  // never break the shell. iOS grants the ask exactly one clean chance, so
  // it lands here: in a binary that also carries the camera string, one
  // coherent release (James's reasoning, on the record).
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
    if (phase === 'shell') registerPush();
  }, [phase, registerPush]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

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
        <StartScreen onLogin={() => setPhase('login')} onJoin={() => setPhase('join')} />
      )}
      {phase === 'login' && (
        <LoginScreen
          onLoggedIn={onLoggedIn}
          onWrongApp={() => setPhase('wrongApp')}
          onBack={() => setPhase('start')}
          onForgot={() => setPhase('forgot')}
        />
      )}
      {phase === 'wrongApp' && <WrongAppScreen onSwitchAccount={() => setPhase('login')} />}
      {phase === 'join' && <JoinScreen onBack={() => setPhase('start')} />}
      {phase === 'forgot' && <ForgotScreen onBack={() => setPhase('login')} />}
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
          <BreathingMark />
        </Animated.View>
      )}
    </View>
  );
}

// ─── C6: the editorial settle — fade + 4px rise, ~300ms, staggered ~60ms ──────
// One Animated.Value per step; step 0 leads (the lockup), each later step waits
// another 60ms, buttons always last. Returns ready-to-spread animated styles.
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

// ─── Start screen A (Pro Navy law, James-ruled) ───────────────────────────────
// Stripped layout: lockup, FOR CLEANERS eyebrow, "Earn on your terms.", navy
// Log In, outline "Apply to clean with Rena". One-brand-motion: the lockup sits
// at the same size and optical position as the arrival overlay (and the OS
// splash behind it), so icon → splash → start reads as one motion, no seam.
function StartScreen({ onLogin, onJoin }: { onLogin: () => void; onJoin: () => void }) {
  const insets = useSafeAreaInsets();
  const [lockupSettle, taglineSettle, actionsSettle] = useSettle(3);
  return (
    <View style={[styles.startWrap, { paddingTop: insets.top + 24 }]}>
      <View style={styles.startHero}>
        <Animated.Image
          source={logoLockup}
          style={[styles.startWordmark, lockupSettle]}
          resizeMode="contain"
        />
        <Animated.View style={[styles.startTaglineBlock, taglineSettle]}>
          <Text style={styles.startEyebrow}>FOR CLEANERS</Text>
          <Text style={styles.startTitle}>Earn on your terms.</Text>
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
            onJoin();
          }}
        >
          <Text style={styles.secondaryBtnText}>Apply to clean with Rena</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── C5: Face-ID-first lock screen (returning users) ──────────────────────────
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
        // Mirror role gate (James-ruled): a CLIENT login never enters the
        // cleaner shell — the bearer is NOT stored; the door screen points at
        // the Rena customer app. Kills the old silent-blank-shell behaviour
        // (a CLIENT used to bridge into /app/today with every cleaner API
        // returning 401 and nothing on screen).
        if (data?.user?.role === 'CLIENT') {
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
      // Login bug (b) fix: without this the keyboard slid OVER the centred
      // body — the Sign In button and Forgot password sat underneath it with
      // no way to scroll or dismiss, trapping the screen.
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
        <Image source={logoLockup} style={styles.loginWordmark} resizeMode="contain" />
        <Text style={styles.loginSub}>Sign in to your cleaner account</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={MUTED}
        />
        {/* A4: show-password toggle */}
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
        {/* A4: in-shell forgot-password (chrome hidden, same as /join) */}
        <Pressable onPress={onForgot} hitSlop={8} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={{ fontFamily: SANS_MEDIUM, color: INK2, fontSize: 14, lineHeight: 20 }}>
            Forgot password?
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Mirror role gate door (James-ruled: friendly, never a dead end) ─────────
// Shown when a CLIENT account signs in here. Offers the Rena customer-app
// deep link (or guidance while its store listing doesn't exist) and a
// different-account door. No session was stored — login is a clean slate.
function WrongAppScreen({ onSwitchAccount }: { onSwitchAccount: () => void }) {
  const insets = useSafeAreaInsets();
  const [lockupSettle, bodySettle, actionsSettle] = useSettle(3);
  const [renaMissing, setRenaMissing] = useState(false);

  const openRena = useCallback(async () => {
    fireHaptic('light');
    // openURL directly (no canOpenURL): the rena:// scheme is not declared in
    // LSApplicationQueriesSchemes, and adding it would be a native change —
    // openURL needs no declaration and rejects when the app isn't installed.
    try {
      await Linking.openURL('rena://');
      return;
    } catch {
      /* fall through to guidance */
    }
    if (CUSTOMER_STORE_URL) {
      Linking.openURL(CUSTOMER_STORE_URL).catch(() => setRenaMissing(true));
    } else {
      setRenaMissing(true);
    }
  }, []);

  return (
    <View style={[styles.startWrap, { paddingTop: insets.top + 24 }]}>
      <View style={[styles.startHero, styles.lockHero]}>
        <Animated.Image
          source={logoLockup}
          style={[styles.startWordmark, lockupSettle]}
          resizeMode="contain"
        />
        <Animated.View style={[{ alignItems: 'center', paddingHorizontal: 8 }, bodySettle]}>
          <Text style={styles.lockTitle}>This is the app cleaners use</Text>
          <Text style={[styles.mutedSmall, { textAlign: 'center' }]}>
            Book your cleans on Rena — the app for customers.
          </Text>
          {renaMissing && (
            <Text style={[styles.mutedSmall, { textAlign: 'center' }]}>
              The Rena app is on its way to the App Store. Until then, book your cleans at
              renacleaning.co.uk.
            </Text>
          )}
        </Animated.View>
      </View>
      <Animated.View
        style={[styles.startActions, { paddingBottom: insets.bottom + 16 }, actionsSettle]}
      >
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={openRena}
        >
          <Text style={styles.primaryBtnText}>Open Rena</Text>
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

// ─── A4: Forgot password, in-shell (marketing chrome hidden) ─────────────────
function ForgotScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <View style={[styles.joinHeader, { paddingTop: insets.top + 6 }]}>
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

// ─── Become a cleaner (in-shell /join, chrome hidden via injected CSS) ─────────
// The marketing nav/footer are stripped by native-injected CSS — zero web change,
// so nothing here can affect the website.
const HIDE_CHROME_JS = `
  (function(){
    var s=document.createElement('style');
    s.innerHTML='#layout-nav,#layout-footer{display:none!important}'
      /* James-ruled chrome strip: the contact/chat FAB never shows in-shell.
         (The components also self-suppress via UA; this CSS kills any
         pre-hydration flash. Selectors target existing markup only.) */
      + 'a[aria-label="Contact us"],button[aria-label="Open chat"],button[aria-label="Close chat"]{display:none!important}';
    document.documentElement.appendChild(s);
  })(); true;
`;

function JoinScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <View style={[styles.joinHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable style={styles.backRow} onPress={onBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={INK2} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <SeamlessWebView
        uri={`${BASE_URL}/en/join`}
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
  // Android hardware back (James-ruled, Phase 2 rule 6): active pane goBack()
  // when it can, else the Today tab, else system default. iOS never subscribes.
  const backHandlers = useRef<Record<string, () => boolean>>({});
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const paneBack = backHandlers.current[activeTabRef.current];
      if (paneBack && paneBack()) return true;
      if (activeTabRef.current !== 'today') {
        setActiveTab('today');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [setActiveTab]);

  const selectTab = useCallback(
    (k: string) => {
      fireHaptic('light');
      setActiveTab(k);
    },
    [setActiveTab]
  );

  // A7: tab badges — the web bell's countOnly pattern, natively: one cheap
  // Bearer-authed poll of /api/cleaner/badges every 60 seconds (offers +
  // unread messages). Fail-soft: any error clears nothing and retries next tick.
  const [badges, setBadges] = useState<{ offers: number; messages: number }>({
    offers: 0,
    messages: 0,
  });
  // R12 Lane 4 (James-ruled): the verification tab gate. null = unknown —
  // the shell FAILS OPEN (never locks a verified cleaner out over a blip);
  // the L2 pages hold the real gate either way. Derived from the same 60s
  // badges poll, so verification unlocks within a minute of approval.
  const [goLive, setGoLive] = useState<boolean | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);
  const lockNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showLockNotice = useCallback(() => {
    fireHaptic('light');
    setLockNotice('Available once you\u2019re verified');
    if (lockNoticeTimer.current) clearTimeout(lockNoticeTimer.current);
    lockNoticeTimer.current = setTimeout(() => setLockNotice(null), 1800);
  }, []);
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token) return;
        const res = await fetch(`${BASE_URL}/api/cleaner/badges`, {
          headers: { Authorization: `Bearer ${token}`, ...SHELL_HEADER },
        });
        if (!res.ok) return;
        const d = await res.json().catch(() => null);
        if (alive && d && typeof d.goLive === 'boolean') setGoLive(d.goLive);
        if (alive && d && typeof d.offers === 'number') {
          setBadges({ offers: d.offers, messages: d.messages ?? 0 });
          // C7: mirror the tab-badge total onto the app icon. Built now, but
          // iOS only DISPLAYS icon badges once notification permission is
          // granted — which is C7 activation's job — so this is invisible
          // until James's activation word. Fail-soft like the poll itself.
          Notifications.setBadgeCountAsync(d.offers + (d.messages ?? 0)).catch(() => {});
        }
      } catch {
        /* fail-soft */
      }
    };
    poll();
    const t = setInterval(poll, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.flex}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          // The Today tab loads the bridge URL first (sets the cookie); once
          // bridged it and every other tab load their route directly (shared
          // cookie jar). Keep tabs mounted to preserve scroll/state.
          const uri = tab.key === 'today' && bridgeUrl ? bridgeUrl : `${BASE_URL}${tab.path}`;
          return (
            <TabPane key={tab.key} active={isActive}>
              {/* A1: portal tabs hide the marketing nav/footer via native-injected
                  CSS (same mechanism as /join) - the tab bar owns the chrome. */}
              <SeamlessWebView
                uri={uri}
                injectBefore={HIDE_CHROME_JS + SEAM_KILL_JS}
                onSessionLost={onSessionLost}
                onBridged={tab.key === 'today' ? onBridged : undefined}
                tabKey={tab.key}
                onCrossTab={selectTab}
                active={isActive}
                registerBack={(h) => {
                  backHandlers.current[tab.key] = h;
                }}
              />
            </TabPane>
          );
        })}
      </View>
      {lockNotice && (
        <View style={styles.lockNotice} pointerEvents="none">
          <Text style={styles.lockNoticeText}>{lockNotice}</Text>
        </View>
      )}
      <TabBar
        active={activeTab}
        onSelect={selectTab}
        badges={badges}
        lockedKeys={goLive === false ? LOCKED_UNTIL_VERIFIED : EMPTY_LOCK}
        onLockedPress={showLockNotice}
      />
    </SafeAreaView>
  );
}

// ─── C6: tab cross-fade — the incoming pane fades in over 150ms ───────────────
// Panes stay mounted (scroll/state preserved); only the newly-shown pane
// animates. The tab bar itself is NEVER animated (law).
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
// injectedJavaScriptBeforeContentLoaded runs before first paint: it kills the
// tap-callout / long-press / pinch-zoom seams and installs a pull-to-refresh that
// prefers window.__renaRefresh (soft refetch) over a hard reload.
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
    // R13 Lane 3 (James-ruled): the gesture arms ONLY from rest at the exact
    // top; a deliberate continuous pull past 110px with the indicator
    // tracking; never from momentum, the rubber-band after a fling, or a
    // mid-page start; releasing early cancels. Mid-form rooms are exempt.
    var EXEMPT=[/^\\/(en\\/)?join(\\/|$)/,/^\\/(en\\/)?book\\//,/^\\/(en\\/)?services\\//,/^\\/(en\\/)?cleaner\\/complete-profile(\\/|$)/];
    function exempt(){var p=location.pathname;for(var i=0;i<EXEMPT.length;i++){if(EXEMPT[i].test(p))return true;}return false;}
    var startY=0,pulling=false,TH=110,lastScroll=0;
    var el=document.createElement('div');
    el.style.cssText='position:fixed;top:0;left:0;right:0;display:flex;justify-content:center;padding-top:12px;transform:translateY(-46px);transition:transform .18s ease;z-index:99999;pointer-events:none;';
    el.innerHTML='<div id="__rspin" style="width:26px;height:26px;border-radius:50%;border:2px solid #E4E9F0;border-top-color:#16296b;box-sizing:border-box;"></div>';
    var sty=document.createElement('style');sty.innerHTML='@keyframes __rspin{to{transform:rotate(360deg)}}';document.documentElement.appendChild(sty);
    function mount(){if(document.body&&!el.parentNode)document.body.appendChild(el);}
    document.addEventListener('DOMContentLoaded',mount);mount();
    function top(){return (document.scrollingElement||document.documentElement||document.body).scrollTop;}
    window.addEventListener('scroll',function(){lastScroll=Date.now();},{passive:true});
    window.addEventListener('touchstart',function(e){
      pulling=false;
      if(exempt())return;
      if(top()>0)return; // mid-page start never arms
      if(Date.now()-lastScroll<250)return; // momentum or bounce still settling — not at rest
      startY=e.touches[0].clientY;pulling=true;
    },{passive:true});
    window.addEventListener('touchmove',function(e){
      if(!pulling)return;
      var d=e.touches[0].clientY-startY;
      if(d<-8){pulling=false;el.style.transform='translateY(-46px)';return;} // reversed into a scroll — abort
      if(top()>0){pulling=false;el.style.transform='translateY(-46px)';return;} // page scrolled — this is navigation
      if(d>24){el.style.transform='translateY('+Math.min((d-24)*0.5-46,26)+'px)';} // indicator tracks only a real pull
    },{passive:true});
    window.addEventListener('touchend',function(e){
      if(!pulling)return;pulling=false;
      var d=e.changedTouches[0].clientY-startY;
      if(d>TH&&top()<=0){
        document.getElementById('__rspin').style.animation='__rspin .6s linear infinite';
        el.style.transform='translateY(20px)';
        setTimeout(function(){el.style.transform='translateY(-46px)';document.getElementById('__rspin').style.animation='';},650);
        if(typeof window.__renaRefresh==='function'){window.__renaRefresh();}else{location.reload();}
      }else{
        el.style.transform='translateY(-46px)'; // released early — clean cancel, no refresh
      }
    },{passive:true});
  })();
  true;
`;

// R5b port (customer-proven, James-ordered): Next.js App Router prefetches
// EVERY visible link's page; inside the shell panes reload on process
// recycling, so prefetch is pure budget burn. Kill it at the fetch layer
// before Next boots — a rejected prefetch just means the real navigation
// fetches normally. Shell bytes only.
const PREFETCH_KILL_JS = `
  (function(){
    var of = window.fetch;
    window.fetch = function(input, init){
      try{
        var h = (init && init.headers) || (input && input.headers) || null;
        var hit = false;
        if (h){
          if (typeof h.get === 'function'){ hit = !!h.get('Next-Router-Prefetch'); }
          else if (Array.isArray(h)){
            for (var i=0;i<h.length;i++){ if(String(h[i][0]).toLowerCase()==='next-router-prefetch'){ hit=true; break; } }
          } else {
            for (var k in h){ if(k.toLowerCase()==='next-router-prefetch'){ hit=true; break; } }
          }
        }
        if (hit){ return Promise.reject(new TypeError('prefetch disabled in shell')); }
      }catch(e){}
      return of.apply(this, arguments);
    };
  })(); true;
`;

// R5b port: the shell's OWN injected observer decides when a page is
// GENUINELY dressed — window load fired AND the DOM structurally quiet for
// 250ms (hydration's in-shell variant swap is a childList burst). The shell
// drops the loader on this message; a 6s long-stop guarantees a broken page
// can never trap it.
const DRESSED_JS = `
  (function(){
    var sent=false;
    function send(){
      if(sent)return; sent=true;
      try{ window.ReactNativeWebView.postMessage(JSON.stringify({type:'dressed'})); }catch(e){}
    }
    function watch(){
      var idle=setTimeout(send,250);
      try{
        var mo=new MutationObserver(function(){
          if(sent){mo.disconnect();return;}
          clearTimeout(idle); idle=setTimeout(function(){mo.disconnect();send();},250);
        });
        mo.observe(document.documentElement,{childList:true,subtree:true});
      }catch(e){ send(); }
    }
    if(document.readyState==='complete'){ watch(); }
    else{ window.addEventListener('load',watch); }
  })(); true;
`;

function SeamlessWebView({
  uri,
  injectBefore,
  onSessionLost,
  onBridged,
  tabKey,
  onCrossTab,
  loaderTone = 'light',
  active,
  registerBack,
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
  /** Whether this pane is the visible tab — gates lazy revival of a
   *  recycled content process (hidden panes revive on show, not en masse). */
  active?: boolean;
  /** Android back (rule 6): the pane registers "go back if you can". */
  registerBack?: (handler: () => boolean) => void;
}) {
  const [offline, setOffline] = useState(false);
  // A9: designed 5xx interstitial (main-document server errors only).
  const [serverError, setServerError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const ref = useRef<WebView>(null);
  // Cold-start false-alarm fix (James, on-device): iOS regularly fails the
  // very FIRST request after a cold open while the network path is still
  // waking — an INDETERMINATE state, not a confirmed dead connection. A
  // single onError therefore never declares offline any more: up to two
  // silent retries run behind the loader (0.6s / 1.2s back-off), and only a
  // third consecutive failure shows the offline screen. A successful load
  // resets the budget, so mid-session blips get the same treatment.
  const retryBudget = useRef(0);
  const retryPending = useRef(false);
  // R5b port: one cross-tab detection per actual navigation — nav events
  // replay the same URL, and each replay used to inject another
  // history.back(), able to walk the pane onto the spent session-bridge.
  const lastCrossTab = useRef<{ url: string; at: number } | null>(null);
  const crossTabDup = (url: string) => {
    const now = Date.now();
    if (
      lastCrossTab.current &&
      lastCrossTab.current.url === url &&
      now - lastCrossTab.current.at < 1500
    ) {
      return true;
    }
    lastCrossTab.current = { url, at: now };
    return false;
  };
  // Boot double-load fix (recorded R5b, James-ordered): onBridged clearing
  // bridgeUrl recomputed this pane's uri bridge→direct, and the changed
  // source prop re-loaded the page the pane was already on — a second full
  // document + API fan every boot. Latched: prop changes never navigate a
  // mounted pane; a remount re-latches the then-current (direct) uri.
  const initialUri = useRef(uri);
  // R5b port: veil long-stop + lazy revival of recycled content processes.
  const longStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsRevive = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const revive = useCallback(() => {
    needsRevive.current = false;
    setLoaded(false);
    fade.setValue(1);
    ref.current?.reload();
  }, [fade]);
  useEffect(() => {
    if (active !== false && needsRevive.current) revive();
  }, [active, revive]);
  // R14 Lane 2 (James-ruled): true while this pane is inside the
  // Stripe-hosted Connect flow. Set on a top-frame navigation to a
  // stripe.com host, cleared on any top-frame landing back on our origin.
  const inStripeFlow = useRef(false);
  // Android back (rule 6): the pane's half — go back through web history
  // when there is any. canGoBack rides onNavigationStateChange.
  const canGoBackRef = useRef(false);
  useEffect(() => {
    registerBack?.(() => {
      if (canGoBackRef.current) {
        ref.current?.goBack();
        return true;
      }
      return false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded) {
      // Appearance item 1: the ruled ~300ms fade into the destination page.
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [loaded, fade]);

  useEffect(
    () => () => {
      if (longStop.current) clearTimeout(longStop.current);
    },
    []
  );

  // If the web session expires, the portal redirects to /login — bounce back to
  // the native login screen instead of showing the web form inside the shell.
  const onNav = (nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
    if (onSessionLost && (/\/login(\?|$)/.test(nav.url) || /\/api\/auth\/signin/.test(nav.url))) {
      onSessionLost();
    }
    // Cross-tab nav fix: Next.js links are SPA pushState navigations, which
    // onShouldStartLoadWithRequest can't cancel — so when one lands on another
    // tab's root, switch the native tab and step this pane's history back to
    // its own route (state preserved; a later onNav for the back-step matches
    // this pane's own key and no-ops).
    if (tabKey && onCrossTab) {
      const target = tabRootKey(nav.url);
      if (target && target !== tabKey) {
        if (!crossTabDup(nav.url)) {
          onCrossTab(target);
          ref.current?.injectJavaScript('window.history.back(); true;');
        }
        return;
      }
    }
    // Fix: the Today tab boots on the single-use session-bridge URL, which
    // redirects here to /app/today. Once we've landed past the bridge, clear
    // bridgeUrl so Today reverts to loading its route directly like every other
    // tab — otherwise a reload / tab-switch / resume re-requests the spent code
    // and renders the bridge's "invalid or expired or already-used code" 401.
    // Honours the "Null once bridged" contract the shell always intended.
    if (
      onBridged &&
      /\/app\/today(\?|#|$)/.test(nav.url) &&
      !nav.url.includes('/api/auth/session-bridge')
    ) {
      onBridged();
    }
  };

  // R5 statement viewer (James-ruled: view first, save second). The tax
  // statement tap no longer goes straight to the share sheet: the shell still
  // downloads it natively with the stored Bearer (WebView cookies aren't
  // reliably shared with native requests; the API accepts Bearer), then opens
  // it IN APP — a WebView rendering the local PDF — with a pinned navy
  // DOWNLOAD button beneath that runs the share sheet (Save to Files,
  // AirDrop, Mail…). Inline render + interception coexist because the viewer
  // renders the LOCAL file: the intercepted navigation is never painted, so
  // the two paths never contend. Fail-soft: an error alerts, page untouched.
  const [statementUri, setStatementUri] = useState<string | null>(null);
  const fetchStatement = useCallback(async (url: string): Promise<string | null> => {
    try {
      const bearer = await SecureStore.getItemAsync(TOKEN_KEY);
      const year = /[?&]taxYear=(\d{4})/.exec(url)?.[1];
      const dest = `${FileSystem.cacheDirectory}rena-earnings-statement-${year ?? 'range'}.pdf`;
      const res = await FileSystem.downloadAsync(url, dest, {
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      });
      if (res.status === 200) return res.uri;
    } catch {
      /* fall through to the alert */
    }
    Alert.alert('Download failed', "We couldn't fetch your statement — try again.");
    return null;
  }, []);
  // iOS half (view first, save second): onFileDownload fires on the
  // Content-Disposition attachment and the local PDF renders in the viewer.
  const onFileDownload = useCallback(
    async ({ nativeEvent }: { nativeEvent: { downloadUrl: string } }) => {
      const uri = await fetchStatement(nativeEvent.downloadUrl);
      if (uri) setStatementUri(uri);
    },
    [fetchStatement]
  );
  // Android half (James-ruled, Phase 2 rule 5): onFileDownload is iOS-only
  // and Android's WebView can't render PDFs — the statement navigation is
  // intercepted, fetched natively with the Bearer, and the PDF handed to the
  // system sheet (Open/Save). expo-sharing is required lazily inside the
  // Android-only path so the module never evaluates on iOS binaries that
  // predate it (the version bump rides the google-services commit).
  const androidStatement = useCallback(
    async (url: string) => {
      const uri = await fetchStatement(url);
      if (!uri) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Sharing = require('expo-sharing') as {
          shareAsync: (u: string, o?: { mimeType?: string }) => Promise<void>;
        };
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
      } catch {
        Alert.alert('Download failed', "We couldn't open your statement — try again.");
      }
    },
    [fetchStatement]
  );

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'haptic') fireHaptic(String(msg.style || 'light'));
      // R5b port: the page says it is genuinely dressed — reveal clean.
      if (msg?.type === 'dressed' && !retryPending.current) {
        if (longStop.current) {
          clearTimeout(longStop.current);
          longStop.current = null;
        }
        retryBudget.current = 0; // O2: a genuine render resets the budget
        setLoaded(true);
      }
    } catch {
      /* ignore non-JSON messages */
    }
  };

  if (serverError) {
    return (
      <View style={styles.center}>
        <Image source={logoLockup} style={styles.loaderWordmark} resizeMode="contain" />
        <Text style={[styles.offlineTitle, { marginTop: 22 }]}>We&apos;re having a moment</Text>
        <Text style={styles.mutedSmall}>
          Something went wrong on our side. Your jobs and earnings are safe.
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
        source={{ uri: initialUri.current, headers: SHELL_HEADER }}
        applicationNameForUserAgent={UA_SUFFIX}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        onFileDownload={onFileDownload}
        // Native pull-to-refresh is OFF — the injected PTR routes to __renaRefresh.
        pullToRefreshEnabled={false}
        bounces
        decelerationRate="normal"
        allowsBackForwardNavigationGestures
        allowsLinkPreview={false}
        injectedJavaScriptBeforeContentLoaded={injectBefore + PREFETCH_KILL_JS + DRESSED_JS}
        onContentProcessDidTerminate={() => {
          if (activeRef.current !== false) revive();
          else needsRevive.current = true;
        }}
        // Rule 7: the Android twin of iOS process reclamation — a killed
        // renderer joins the same lazy-revival law.
        onRenderProcessGone={() => {
          if (activeRef.current !== false) revive();
          else needsRevive.current = true;
        }}
        // R5b port: EVERY document load in a pane wears the loader, however
        // caused — boot, a recycle revival, an in-pane full-load link, a
        // back-swipe. onLoadStart fires per document load (not for SPA
        // pushState), which is exactly the ruled coverage.
        onLoadStart={() => {
          if (longStop.current) {
            clearTimeout(longStop.current);
            longStop.current = null;
          }
          setLoaded(false);
          fade.setValue(1);
        }}
        // Cross-tab nav fix, full-document half: real document loads CAN be
        // cancelled here, so the origin pane never leaves its route at all.
        onShouldStartLoadWithRequest={(req) => {
          // Rule 5 (Android): the statement download navigation never paints —
          // intercept, fetch natively, hand to the system sheet.
          if (Platform.OS === 'android' && req.url.includes('/api/cleaner/statement')) {
            androidStatement(req.url);
            return false;
          }
          // R14 Lane 2 (James-ruled): EVERY exit from Stripe lands back in
          // the app. Inside the Connect flow the only sanctioned doors to our
          // origin are the return landing and the connect relaunch; any other
          // our-origin landing (Stripe's header brand link points at the
          // public website) reroutes to the dressed return room, which reads
          // the truth and shows connected, checking, or not finished.
          {
            const host = (req.url.match(/^https?:\/\/([^/:?#]+)/) || [])[1] || '';
            if (/(^|\.)stripe\.(com|network)$/i.test(host)) {
              if (req.isTopFrame !== false) inStripeFlow.current = true;
            } else if (inStripeFlow.current && host === BASE_HOST && req.isTopFrame !== false) {
              inStripeFlow.current = false;
              if (!/\/cleaner\/(onboarding-complete|stripe\/connect)([/?#]|$)/.test(req.url)) {
                ref.current?.injectJavaScript(
                  `window.location.replace(${JSON.stringify(
                    `${BASE_URL}/en/cleaner/onboarding-complete`
                  )}); true;`
                );
                return false;
              }
            }
          }
          if (tabKey && onCrossTab) {
            const target = tabRootKey(req.url);
            if (target && target !== tabKey) {
              if (!crossTabDup(req.url)) onCrossTab(target);
              return false;
            }
          }
          return true;
        }}
        onNavigationStateChange={onNav}
        onMessage={onMessage}
        onLoadEnd={() => {
          if (retryPending.current) return; // silent retry in flight — keep the loader up
          // O2 (James-ruled): no budget reset here — Android synthesises a
          // finish event before every error, which kept the budget at zero
          // and made the offline screen unreachable (the endless 600ms error
          // loop). Genuine renders reset it instead (dressed / long-stop).
          // R5b port: no fixed-duration guess — the loader holds until the
          // injected observer posts 'dressed'; this long-stop only trap-proofs
          // a page whose JS never settles or never runs.
          if (longStop.current) clearTimeout(longStop.current);
          longStop.current = setTimeout(() => {
            longStop.current = null;
            if (retryPending.current) return; // O3: a retry is waiting — not a render
            retryBudget.current = 0;
            setLoaded(true);
          }, 6000);
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
          // A9: a 5xx on OUR origin gets the designed interstitial; sub-resource
          // and third-party errors stay with the web pages' own states.
          const { statusCode, url } = e.nativeEvent;
          if (statusCode >= 500 && typeof url === 'string' && url.startsWith(BASE_URL)) {
            setServerError(true);
          }
        }}
        // A non-white base colour under the page means no stark flash before paint.
        style={[styles.flex, { backgroundColor: loaderTone === 'navy' ? INK : PAGE }]}
      />
      {!loaded && (
        <Animated.View
          style={[
            styles.webLoader,
            { opacity: fade, backgroundColor: loaderTone === 'navy' ? INK : SPLASH_GREY },
          ]}
          pointerEvents="none"
        >
          {/* Appearance item 1 (James-ruled): the loader IS the splash picture —
              the breathing mark on #EBEBEB. No spinner, no default state. */}
          {loaderTone === 'navy' ? (
            <>
              <Image source={logoLockup} style={styles.loaderWordmark} resizeMode="contain" />
              <ActivityIndicator color="#fff" style={{ marginTop: 18 }} />
            </>
          ) : (
            <BreathingMark />
          )}
        </Animated.View>
      )}
      {statementUri && (
        <View style={styles.statementOverlay}>
          <View style={styles.statementHeader}>
            <Pressable
              style={styles.statementBack}
              onPress={() => setStatementUri(null)}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={22} color={INK2} />
              <Text style={styles.statementBackText}>Back</Text>
            </Pressable>
            <Text style={styles.statementTitle}>Earnings Statement</Text>
            <View style={styles.statementBackGhost} />
          </View>
          <WebView
            source={{ uri: statementUri }}
            originWhitelist={['*']}
            style={styles.flex}
            // Local file, no scripts needed — the inline PDF render, in app.
            javaScriptEnabled={false}
          />
          <View style={styles.statementFooter}>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => {
                fireHaptic('light');
                Share.share({ url: statementUri }).catch(() => {});
              }}
            >
              <Text style={styles.primaryBtnText}>Download</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────
function TabBar({
  active,
  onSelect,
  badges,
  lockedKeys,
  onLockedPress,
}: {
  active: string;
  onSelect: (k: string) => void;
  badges?: { offers: number; messages: number };
  // R12 Lane 4: greyed, untappable tabs while unverified.
  lockedKeys?: ReadonlySet<string>;
  onLockedPress?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const badgeFor = (key: string): number => {
    if (!badges) return 0;
    if (key === 'jobs') return badges.offers;
    if (key === 'messages') return badges.messages;
    return 0;
  };
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t) => {
        const on = active === t.key;
        const locked = !!lockedKeys?.has(t.key);
        const count = locked ? 0 : badgeFor(t.key);
        return (
          <Pressable
            key={t.key}
            style={[styles.tab, locked && styles.tabLocked]}
            onPress={() => (locked ? onLockedPress?.() : onSelect(t.key))}
            hitSlop={6}
          >
            <View>
              <Ionicons
                name={(on ? t.icon : `${t.icon}-outline`) as keyof typeof Ionicons.glyphMap}
                size={23}
                color={on && !locked ? INK : MUTED}
              />
              {count > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
            </View>
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
  // R12 Lane 4: locked tabs are visibly asleep, untappable by interception.
  tabLocked: { opacity: 0.35 },
  lockNotice: {
    position: 'absolute',
    bottom: 86,
    alignSelf: 'center',
    backgroundColor: INK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    zIndex: 40,
  },
  lockNoticeText: { fontFamily: SANS, color: '#FFFFFF', fontSize: 13 },
  mutedSmall: { fontFamily: SANS, marginTop: 10, color: INK2, fontSize: 13, lineHeight: 18 },

  // Arrival overlay (light, matches the OS splash + Start screen)
  arrival: {
    ...StyleSheet.absoluteFillObject,
    // Appearance item 1: the OS splash ground exactly (#EBEBEB, app.json).
    backgroundColor: SPLASH_GREY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Logo lockup is ~1.85:1 (two lines: RENA / Cleaner) — box sized to that ratio.
  arrivalWordmark: { width: 230, height: 124 },

  // Start screen A (Pro Navy law) — lockup box identical to the arrival overlay
  // (230×124, centred) so splash → start is one motion with no seam.
  startWrap: {
    flex: 1,
    backgroundColor: PAGE,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  startHero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  startWordmark: { width: 230, height: 124 },
  startTaglineBlock: { alignItems: 'center', marginTop: 30 },
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

  // C5 lock screen
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

  // WebView seam-kill loader
  webLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWordmark: { width: 168, height: 91 },

  // Login
  loginWrap: { backgroundColor: PAGE, paddingHorizontal: 24 },
  loginBody: { flexGrow: 1, justifyContent: 'center', paddingBottom: 48 },
  loginWordmark: { width: 196, height: 106, alignSelf: 'center', marginBottom: 4 },
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

  // Join header
  joinHeader: { backgroundColor: PAGE, paddingHorizontal: 16, paddingBottom: 8 },
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

  // R5 statement viewer — view first, save second (the app's grammar).
  statementOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PAGE,
  },
  statementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
    backgroundColor: SURFACE,
  },
  statementBack: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  statementBackText: { fontFamily: SANS, color: INK2, fontSize: 16, lineHeight: 22 },
  statementBackGhost: { minWidth: 64 },
  statementTitle: { fontFamily: SANS_SEMI, color: INK, fontSize: 16, lineHeight: 22 },
  statementFooter: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    backgroundColor: SURFACE,
  },
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
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { fontFamily: SANS_SEMI, color: '#fff', fontSize: 9.5, lineHeight: 13 },
  tabTextActive: { fontFamily: SANS_SEMI, color: INK },
});
