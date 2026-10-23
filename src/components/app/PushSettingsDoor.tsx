'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { PUSH_SETTINGS_CAPABILITY, postPushSettingsToShell, shellHasCapability } from '@/lib/shell';

// B5.8 settings door (RENA-046; James-ruled 23 Oct): the notifications row on
// the Pro profile room and the customer Account Settings page. It renders
// only inside a shell that advertises pushSettingsV1 (decided after mount,
// so the served markup is identical for every visitor and every browser
// sees nothing); the tap hands over to the shell, which re-asks the OS or
// opens the app's system Settings.
export default function PushSettingsDoor({
  variant = 'row',
  frame,
}: {
  variant?: 'row' | 'section';
  /** The host page's own card around the row, rendered only with the door. */
  frame: (door: ReactNode) => ReactNode;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(
      shellHasCapability(PUSH_SETTINGS_CAPABILITY) &&
        typeof (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView !==
          'undefined'
    );
  }, []);
  if (!available) return null;

  return frame(
    <button
      type="button"
      onClick={() => postPushSettingsToShell()}
      data-testid="push-settings-door"
      className={
        variant === 'row'
          ? 'flex w-full items-center justify-between gap-3 px-5 py-4 text-left'
          : 'flex w-full items-center justify-between gap-3 text-left'
      }
    >
      <span className="min-w-0">
        <span className="block font-jost text-[15px] font-medium text-ink">Notifications</span>
        <span className="mt-0.5 block font-jost text-[12px] font-normal text-ink-3">
          Turn them on or change them in your phone&apos;s settings
        </span>
      </span>
      <svg
        className="h-4 w-4 shrink-0 text-ink-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}
