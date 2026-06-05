'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = 'rena_cookie_consent';
const COOKIE_CONSENT_VERSION = '1.0';

function getStoredConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    return parsed.preferences;
  } catch {
    return null;
  }
}

function storeConsent(preferences: CookiePreferences) {
  localStorage.setItem(
    COOKIE_CONSENT_KEY,
    JSON.stringify({
      version: COOKIE_CONSENT_VERSION,
      preferences,
      timestamp: new Date().toISOString(),
    })
  );
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });
  const t = useTranslations('Cookie');

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setVisible(true);
    } else {
      setPreferences(stored);
    }

    window.openCookieSettings = () => {
      setVisible(true);
      setShowDetails(true);
    };
  }, []);

  const saveConsent = useCallback((prefs: CookiePreferences) => {
    storeConsent(prefs);
    setPreferences(prefs);
    setVisible(false);

    fetch('/api/gdpr/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'anonymous@cookie-consent',
        consents: [
          { type: 'essential', granted: true },
          { type: 'analytics', granted: prefs.analytics },
          { type: 'marketing', granted: prefs.marketing },
        ],
      }),
    }).catch(() => {});
  }, []);

  const acceptAll = useCallback(() => {
    saveConsent({ essential: true, analytics: true, marketing: true });
  }, [saveConsent]);

  const rejectNonEssential = useCallback(() => {
    saveConsent({ essential: true, analytics: false, marketing: false });
  }, [saveConsent]);

  const saveCustom = useCallback(() => {
    saveConsent(preferences);
  }, [preferences, saveConsent]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6">
      <div
        className="pointer-events-auto mx-auto max-w-2xl bg-white shadow-lg"
        style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
      >
        <div className="p-5 sm:p-6">
          <h2 className="font-cormorant text-xl font-light text-ink">{t('title')}</h2>
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
