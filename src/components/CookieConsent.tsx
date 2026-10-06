'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';

import ShellConsentSheet from '@/components/app/ShellConsentSheet';
import {
  accountAnswerMissing,
  consentMode,
  currentConsent,
  loadAccountConsent,
  saveConsent,
  setConsentIdentity,
  subscribeConsent,
} from '@/lib/consent';
import { isAnyShellUA } from '@/lib/shell';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

// RENA-059 (B1b): the entry panes where the in-shell ask may appear, once,
// on the first signed-in entry (a pane that mounts later never repeats it).
const SHELL_ASK_PATHS = /^(?:\/en)?\/app\/(?:home|today)\/?$/;

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [forced, setForced] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });
  const t = useTranslations('Cookie');
  const { data: session, status } = useSession();
  // Re-render whenever the gate changes (identity, ledger answer, a choice).
  const [, setTick] = useState(0);
  useEffect(() => subscribeConsent(() => setTick((n) => n + 1)), []);

  // Identity sync: the gate learns who is browsing once the session resolves.
  // Signed in: the ledger answer is loaded (or the per-account cache used).
  useEffect(() => {
    if (status === 'loading') return;
    const userId = status === 'authenticated' ? (session?.user?.id ?? null) : null;
    setConsentIdentity(userId);
    if (userId) void loadAccountConsent(userId);
  }, [status, session?.user?.id]);

  useEffect(() => {
    setMounted(true);
    window.openCookieSettings = () => {
      setForced(true);
      setShowDetails(true);
    };
  }, []);

  const current = currentConsent();
  useEffect(() => {
    if (current)
      setPreferences({
        essential: true,
        analytics: current.analytics,
        marketing: current.marketing,
      });
  }, [current?.analytics, current?.marketing]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = useCallback((prefs: CookiePreferences) => {
    setForced(false);
    void saveConsent({ analytics: prefs.analytics, marketing: prefs.marketing });
  }, []);

  const acceptAll = useCallback(() => {
    choose({ essential: true, analytics: true, marketing: true });
  }, [choose]);

  const rejectNonEssential = useCallback(() => {
    choose({ essential: true, analytics: false, marketing: false });
  }, [choose]);

  const saveCustom = useCallback(() => {
    choose(preferences);
  }, [preferences, choose]);

  if (!mounted) return null;

  const mode = consentMode();
  const inShell = isAnyShellUA();

  // In-shell (D-b, James-ruled): never the website banner. The two-choice ask
  // appears once on the first signed-in entry pane when the account has no
  // answer in the ledger; it is changeable later from the profile room.
  if (inShell) {
    const onEntryPane =
      typeof window !== 'undefined' && SHELL_ASK_PATHS.test(window.location.pathname);
    if (mode === 'account' && accountAnswerMissing() && onEntryPane) {
      return (
        <ShellConsentSheet
          onAllow={() => choose({ essential: true, analytics: true, marketing: false })}
          onEssential={() => choose({ essential: true, analytics: false, marketing: false })}
        />
      );
    }
    return null;
  }

  // Website: anonymous visitors are asked until they answer in this browser;
  // a signed-in account is asked only once its ledger has been read and found
  // empty (the stored account answer suppresses the banner once loaded).
  const needsAnswer =
    mode === 'anonymous' ? current === null : mode === 'account' ? accountAnswerMissing() : false;
  if (!forced && !needsAnswer) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div
        className="pointer-events-auto mx-auto max-w-2xl bg-white shadow-lg"
        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
      >
        <div className="p-5 sm:p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink">{t('title')}</h2>
          <p className="mt-2 font-jost text-sm font-light text-ink-2 leading-relaxed">
            {t('description')}{' '}
            <Link href="/privacy#cookies" className="text-gold underline hover:text-gold/80">
              {t('readPrivacy')}
            </Link>
            .
          </p>

          {showDetails && (
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked disabled className="h-4 w-4 accent-gold" />
                <div>
                  <span className="font-jost text-sm font-normal text-ink">{t('essential')}</span>
                  <p className="font-jost text-xs font-light text-ink-3">{t('essentialDesc')}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences((p) => ({ ...p, analytics: e.target.checked }))}
                  className="h-4 w-4 accent-gold"
                />
                <div>
                  <span className="font-jost text-sm font-normal text-ink">{t('analytics')}</span>
                  <p className="font-jost text-xs font-light text-ink-3">{t('analyticsDesc')}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) => setPreferences((p) => ({ ...p, marketing: e.target.checked }))}
                  className="h-4 w-4 accent-gold"
                />
                <div>
                  <span className="font-jost text-sm font-normal text-ink">{t('marketing')}</span>
                  <p className="font-jost text-xs font-light text-ink-3">{t('marketingDesc')}</p>
                </div>
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={acceptAll}
              className="bg-ink px-5 py-2 font-jost text-sm text-cream hover:bg-ink/90"
            >
              {t('acceptAll')}
            </button>
            <button
              onClick={rejectNonEssential}
              className="border px-5 py-2 font-jost text-sm text-ink hover:bg-cream-2"
              style={{ borderColor: 'rgba(14,14,12,0.2)' }}
            >
              {t('essentialOnly')}
            </button>
            {showDetails ? (
              <button
                onClick={saveCustom}
                className="border px-5 py-2 font-jost text-sm text-gold hover:bg-cream-2"
                style={{ borderColor: 'rgba(184,151,90,0.3)' }}
              >
                {t('savePreferences')}
              </button>
            ) : (
              <button
                onClick={() => setShowDetails(true)}
                className="font-jost text-sm text-ink-3 underline hover:text-ink"
              >
                {t('customise')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
