import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
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

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL: string =
  (Constants.expoConfig?.extra?.baseUrl as string) || 'https://www.renacleaning.co.uk';
const SHELL_HEADER = {
  'x-rena-shell': `pro-${Platform.OS}/${Constants.expoConfig?.version ?? '1'}`,
};
const UA_SUFFIX = `RenaPro/${Constants.expoConfig?.version ?? '1.0'}`;
const TOKEN_KEY = 'rena.pro.bearer';

// Design tokens (light theme, mirrors the web).
const INK = '#16296b';
const PAGE = '#FAFBFC';
const SURFACE = '#ffffff';
const LINE = '#E4E9F0';
const INK2 = '#3D5170';
const MUTED = '#7A8A9E';
// DELIBERATE DECISION (James-ruled): the teal in "Cleaner" is a brand colour that
// appears in EXACTLY ONE place — the logo lockup. It is intentionally NOT a UI
// accent: no teal buttons, links, chips, or highlights anywhere in the app. Do
// not introduce a teal token unless James rules otherwise. Primary UI accent is
// INK (#16296b).

// Brand typography — the real Newsreader (serif) + Jost (UI), loaded from the
// committed OFL TTFs so native text matches the web exactly (no system-font
// stand-in). Keys match the file family names registered via useFonts().
const FONTS = {
  'Newsreader-Regular': require('./assets/fonts/Newsreader-Regular.ttf'),
  'Newsreader-Medium': require('./assets/fonts/Newsreader-Medium.ttf'),
  'Newsreader-SemiBold': require('./assets/fonts/Newsreader-SemiBold.ttf'),
  'Jost-Regular': require('./assets/fonts/Jost-Regular.ttf'),
  'Jost-Medium': require('./assets/fonts/Jost-Medium.ttf'),
  'Jost-SemiBold': require('./assets/fonts/Jost-SemiBold.ttf'),
};
const SERIF_SEMI = 'Newsreader-SemiBold';
const SANS = 'Jost-Regular';
const SANS_MEDIUM = 'Jost-Medium';
const SANS_SEMI = 'Jost-SemiBold';

// Keep the native splash up until the JS arrival overlay has taken over, so there
// is never a white frame between the OS splash and our first paint.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Tab bar: first tab = the purpose-built Today screen; the rest are portal routes.
const TABS = [
  { key: 'today', label: 'Today', path: '/en/app/today', icon: 'today' },
  { key: 'jobs', label: 'Jobs', path: '/en/app/jobs', icon: 'briefcase' },
  { key: 'availability', label: 'Availability', path: '/en/app/availability', icon: 'calendar' },
  { key: 'earnings', label: 'Earnings', path: '/en/app/earnings', icon: 'wallet' },
  { key: 'messages', label: 'Messages', path: '/en/messages', icon: 'chatbubble-ellipses' },
] as const;

type Phase = 'boot' | 'locked' | 'start' | 'login' | 'join' | 'forgot' | 'shell';

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

function RootView() {
  const [fontsLoaded] = useFonts(FONTS);
  const [phase, setPhase] = useState<Phase>('boot');
  // The URL the first WebView loads after login: the session-bridge, which sets
  // the WebView session cookie and redirects into the app. Null once bridged.
  const [bridgeUrl, setBridgeUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('today');

  // ── Arrival overlay: a LIGHT full-bleed cover with the logo that continues the
  // (now light) OS splash seamlessly, then fades to reveal content. Everything —
  // OS splash, this overlay, and the Start screen — is #FAFBFC, so the whole
  // arrival is light→light→light with no navy flash and an invisible seam. ──
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

  // C5: leaving the lock screen for the password form or another account clears
  // the stored bearer either way; the destinations differ.
  const goToPasswordLogin = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setBridgeUrl(null);
    setLockFailed(false);
    setPhase('login');
  }, []);
  const switchAccount = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setBridgeUrl(null);
    setLockFailed(false);
    setPhase('start');
  }, []);

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
          onBack={() => setPhase('start')}
          onForgot={() => setPhase('forgot')}
        />
      )}
      {phase === 'join' && <JoinScreen onBack={() => setPhase('start')} />}
      {phase === 'forgot' && <ForgotScreen onBack={() => setPhase('login')} />}
      {phase === 'shell' && (
        <ShellScreen
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          bridgeUrl={bridgeUrl}
          onSessionLost={logout}
        />
      )}

      {overlayMounted && (
        <Animated.View style={[styles.arrival, { opacity: overlay }]} pointerEvents="none">
          <Image source={logoLockup} style={styles.arrivalWordmark} resizeMode="contain" />
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

// ─── Arrival Start screen ─────────────────────────────────────────────────────
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
        <Animated.View style={taglineSettle}>
          <Text style={styles.startTitle}>Earn on your terms</Text>
          <Text style={styles.startSub}>
            Real cleaning jobs near you. Your rates, your hours, paid fast.
          </Text>
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
          <Text style={styles.primaryBtnText}>Log in</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={() => {
            fireHaptic('light');
            onJoin();
          }}
        >
          <Text style={styles.secondaryBtnText}>Become a cleaner</Text>
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
  onBack,
  onForgot,
}: {
  onLoggedIn: (token: string, bridgeCode: string) => void;
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
    <View style={[styles.flex, styles.loginWrap, { paddingTop: insets.top + 8 }]}>
      <Pressable style={styles.backRow} onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={22} color={INK2} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.loginBody}>
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
          <Text style={styles.primaryBtnText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>
        {/* A4: in-shell forgot-password (chrome hidden, same as /join) */}
        <Pressable onPress={onForgot} hitSlop={8} style={{ marginTop: 16, alignSelf: 'center' }}>
          <Text style={{ fontFamily: SANS_MEDIUM, color: INK2, fontSize: 14 }}>
            Forgot password?
          </Text>
        </Pressable>
      </View>
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
    s.innerHTML='#layout-nav,#layout-footer{display:none!important}';
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
  onSessionLost,
}: {
  activeTab: string;
  setActiveTab: (k: string) => void;
  bridgeUrl: string | null;
  onSessionLost: () => void;
}) {
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
        if (alive && d && typeof d.offers === 'number') {
          setBadges({ offers: d.offers, messages: d.messages ?? 0 });
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
              />
            </TabPane>
          );
        })}
      </View>
      <TabBar active={activeTab} onSelect={selectTab} badges={badges} />
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
  loaderTone = 'light',
}: {
  uri: string;
  injectBefore: string;
  onSessionLost?: () => void;
  loaderTone?: 'light' | 'navy';
}) {
  const [offline, setOffline] = useState(false);
  // A9: designed 5xx interstitial (main-document server errors only).
  const [serverError, setServerError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const ref = useRef<WebView>(null);

  useEffect(() => {
    if (loaded) {
      Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }
  }, [loaded, fade]);

  // If the web session expires, the portal redirects to /login — bounce back to
  // the native login screen instead of showing the web form inside the shell.
  const onNav = (nav: WebViewNavigation) => {
    if (onSessionLost && (/\/login(\?|$)/.test(nav.url) || /\/api\/auth\/signin/.test(nav.url))) {
      onSessionLost();
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
          <Text style={styles.primaryBtnText}>Try again</Text>
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
        // Native pull-to-refresh is OFF — the injected PTR routes to __renaRefresh.
        pullToRefreshEnabled={false}
        bounces
        decelerationRate="normal"
        allowsBackForwardNavigationGestures
        allowsLinkPreview={false}
        injectedJavaScriptBeforeContentLoaded={injectBefore}
        onNavigationStateChange={onNav}
        onMessage={onMessage}
        onLoadEnd={() => setLoaded(true)}
        onError={() => setOffline(true)}
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
            { opacity: fade, backgroundColor: loaderTone === 'navy' ? INK : PAGE },
          ]}
          pointerEvents="none"
        >
          <Image source={logoLockup} style={styles.loaderWordmark} resizeMode="contain" />
          <ActivityIndicator
            color={loaderTone === 'navy' ? '#fff' : INK}
            style={{ marginTop: 18 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────
function TabBar({
  active,
  onSelect,
  badges,
}: {
  active: string;
  onSelect: (k: string) => void;
  badges?: { offers: number; messages: number };
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
        const count = badgeFor(t.key);
        return (
          <Pressable key={t.key} style={styles.tab} onPress={() => onSelect(t.key)} hitSlop={6}>
            <View>
              <Ionicons
                name={(on ? t.icon : `${t.icon}-outline`) as keyof typeof Ionicons.glyphMap}
                size={23}
                color={on ? INK : MUTED}
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
  mutedSmall: { fontFamily: SANS, marginTop: 10, color: INK2, fontSize: 13 },

  // Arrival overlay (light, matches the OS splash + Start screen)
  arrival: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PAGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Logo lockup is ~1.85:1 (two lines: RENA / Cleaner) — box sized to that ratio.
  arrivalWordmark: { width: 230, height: 124 },

  // Start screen
  startWrap: {
    flex: 1,
    backgroundColor: PAGE,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  startHero: { flex: 1, justifyContent: 'center' },
  startWordmark: { width: 244, height: 132, marginBottom: 26 },
  startTitle: { fontFamily: SERIF_SEMI, fontSize: 34, color: INK, lineHeight: 40 },
  startSub: {
    fontFamily: SANS,
    marginTop: 12,
    fontSize: 16,
    lineHeight: 23,
    color: INK2,
    maxWidth: 300,
  },
  startActions: { gap: 12 },

  // C5 lock screen
  lockHero: { alignItems: 'center', justifyContent: 'center' },
  lockTitle: { fontFamily: SERIF_SEMI, fontSize: 26, color: INK, marginTop: 18 },
  lockLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  lockLink: { fontFamily: SANS_MEDIUM, color: INK2, fontSize: 14, paddingVertical: 6 },
  lockLinkDot: { fontFamily: SANS, color: MUTED, fontSize: 14 },

  // WebView seam-kill loader
  webLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWordmark: { width: 168, height: 91 },

  // Login
  loginWrap: { backgroundColor: PAGE, paddingHorizontal: 24 },
  loginBody: { flex: 1, justifyContent: 'center', paddingBottom: 48 },
  loginWordmark: { width: 196, height: 106, alignSelf: 'center', marginBottom: 4 },
  loginSub: {
    fontFamily: SANS,
    textAlign: 'center',
    color: INK2,
    marginTop: 4,
    marginBottom: 24,
    fontSize: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: SANS,
    fontSize: 16,
    color: INK,
    marginBottom: 12,
    backgroundColor: SURFACE,
  },
  error: { fontFamily: SANS, color: '#dc2626', marginBottom: 12, fontSize: 13 },
  pwRow: { position: 'relative' },
  pwInput: { paddingRight: 44 },
  pwEye: { position: 'absolute', right: 14, top: 15 },

  // Join header
  joinHeader: { backgroundColor: PAGE, paddingHorizontal: 16, paddingBottom: 8 },
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  backText: { fontFamily: SANS, color: INK2, fontSize: 16, marginLeft: 2 },

  // Buttons
  primaryBtn: {
    backgroundColor: INK,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: SANS_SEMI, color: '#fff', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryBtnText: { fontFamily: SANS_SEMI, color: INK, fontSize: 16 },
  retryBtn: { marginTop: 18, paddingHorizontal: 28 },

  offlineTitle: { fontFamily: SERIF_SEMI, fontSize: 20, color: INK, marginBottom: 6 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE,
    backgroundColor: SURFACE,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabText: { fontFamily: SANS_MEDIUM, fontSize: 10.5, color: MUTED },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: { fontFamily: SANS_SEMI, color: '#fff', fontSize: 9.5 },
  tabTextActive: { fontFamily: SANS_SEMI, color: INK },
});
