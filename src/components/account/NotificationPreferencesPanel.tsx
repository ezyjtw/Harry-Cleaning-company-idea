'use client';

import { useEffect, useState } from 'react';

// A11b: user-scoped notification preferences UI. Rendered from both
// /account/notifications (customer) and /cleaner/notifications (cleaner) — the
// preferences are per-user, so one panel + one API serves both roles.

interface Preferences {
  reminders: boolean;
  newMessage: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
  marketingConsentAt: string | null;
  unsubscribedAt: string | null;
}

type ToggleKey = 'reminders' | 'newMessage' | 'push' | 'sms' | 'marketing';

const TOGGLES: { key: ToggleKey; label: string; description: string }[] = [
  {
    key: 'reminders',
    label: 'Booking reminders & review requests',
    description: 'Upcoming-booking reminders and prompts to review a completed clean.',
  },
  {
    key: 'newMessage',
    label: 'New message alerts',
    description: 'Get notified when a cleaner or customer sends you a message.',
  },
  {
    key: 'push',
    label: 'Push notifications',
    description: 'Browser/device push for the alerts above (master switch).',
  },
  {
    key: 'sms',
    label: 'SMS notifications',
    description: 'Text-message alerts for the categories above (master switch).',
  },
  {
    key: 'marketing',
    label: 'Offers & product news',
    description: 'Occasional promotions, tips and updates. Off by default — opt in here.',
  },
];

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 ${
        checked ? 'bg-brand-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savingKey, setSavingKey] = useState<ToggleKey | null>(null);

  useEffect(() => {
    fetch('/api/account/notification-preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preferences) setPrefs(data.preferences);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(key: ToggleKey) {
    if (!prefs || savingKey) return;
    const next = !prefs[key];
    // Optimistic update.
    setPrefs({ ...prefs, [key]: next });
    setSavingKey(key);
    try {
      const res = await fetch('/api/account/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.preferences) setPrefs(data.preferences);
      } else {
        // Roll back on failure.
        setPrefs((p) => (p ? { ...p, [key]: !next } : p));
      }
    } catch {
      setPrefs((p) => (p ? { ...p, [key]: !next } : p));
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading your preferences…</p>;
  }

  if (error || !prefs) {
    return (
      <p className="text-sm text-red-600">
        We couldn&rsquo;t load your notification preferences. Please refresh and try again.
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
      <p className="mt-1 text-sm text-gray-500">
        Choose what we send you. Essential messages about your bookings, payments and account
        security are always sent and can&rsquo;t be turned off.
      </p>

      {/* Essential — informational, no toggle (it can never be disabled). */}
      <div className="mt-6 flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div>
          <p className="text-sm font-medium text-gray-900">Booking, payment & security</p>
          <p className="mt-0.5 text-sm text-gray-500">
            Booking and payment confirmations, receipts, and account-security emails.
          </p>
        </div>
        <span className="mt-0.5 shrink-0 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          Always on
        </span>
      </div>

      {/* Toggleable categories. */}
      <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {TOGGLES.map((t) => (
          <div key={t.key} className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{t.label}</p>
              <p className="mt-0.5 text-sm text-gray-500">{t.description}</p>
            </div>
            <Toggle
              checked={prefs[t.key]}
              disabled={savingKey !== null}
              onChange={() => handleToggle(t.key)}
              label={t.label}
            />
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Changes save automatically. Marketing emails require your explicit opt-in (UK PECR).
      </p>
    </div>
  );
}
