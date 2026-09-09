'use client';

// Profile Hub (shape A, James-ruled P3): the native L2 profile screen. Avatar
// with camera badge, name, area, Verified badge, the F26 visibility toggle as
// a native switch (same flag, same endpoint, same audit — this is the third
// door), and rows opening the skinned web pages: Edit Bio & Photos / My Rates
// / Reviews. Reached from the account menu; back is history (the shell's
// swipe-back also works).

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { haptic } from '@/components/app/job-cards';

interface HubProfile {
  name: string;
  image: string | null;
  location: string | null;
  postcode: string | null;
  verified: boolean;
  visibleInDirectory: boolean;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [profile, setProfile] = useState<HubProfile | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  // F26 third door: saves ON CLICK (the B1 precedent — a hidden/shown state
  // never sits unsaved), optimistic with revert, audit rides the endpoint.
  const [visSaving, setVisSaving] = useState(false);
  const [visFlash, setVisFlash] = useState<'saved' | 'error' | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch('/api/cleaner/profile');
      if (res.status === 401 || res.status === 403) {
        setAccessDenied(true);
        return;
      }
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data) {
        setLoadError(true);
        return;
      }
      setProfile({
        name: data.name || 'Cleaner',
        image: data.image || null,
        location: data.location || null,
        postcode: data.postcode || null,
        verified: !!data.verified,
        visibleInDirectory: data.visibleInDirectory !== false,
      });
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const w = window as unknown as { __renaRefresh?: () => void };
    w.__renaRefresh = fetchProfile;
    return () => {
      delete w.__renaRefresh;
    };
  }, [fetchProfile]);

  const saveVisibility = async (next: boolean) => {
    if (!profile || visSaving) return;
    haptic('light');
    setVisSaving(true);
    setVisFlash(null);
    const prev = profile.visibleInDirectory;
    setProfile({ ...profile, visibleInDirectory: next });
    try {
      const res = await fetch('/api/cleaner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleInDirectory: next }),
      });
      if (!res.ok) throw new Error();
      haptic('success');
      setVisFlash('saved');
      setTimeout(() => setVisFlash(null), 2500);
    } catch {
      setProfile((p) => (p ? { ...p, visibleInDirectory: prev } : p));
      haptic('error');
      setVisFlash('error');
    } finally {
      setVisSaving(false);
    }
  };

  const go = (path: string) => {
    haptic('light');
    router.push(path);
  };

  const rowCls =
    'flex w-full items-center justify-between px-5 py-4 text-left font-jost text-[15px] font-medium text-ink active:bg-page';
  const chevron = (
    <svg
      className="h-4 w-4 text-ink-3"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );

  if (accessDenied) {
    return (
      <div className="rounded-xl border border-danger/20 bg-danger/10 px-5 py-4">
        <p className="text-sm font-medium text-danger">Please sign in to view your profile.</p>
      </div>
    );
  }

  if (!loading && loadError) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <h1 className="font-jost text-xl font-semibold text-ink">
          Couldn&apos;t load your profile
        </h1>
        <p className="mt-2 font-jost text-sm text-ink-2">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            fetchProfile();
          }}
          className="mt-4 rounded-[10px] bg-primary px-5 py-2 font-jost text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading || !profile) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-line" />
        <div className="h-36 animate-pulse rounded-2xl bg-line" />
        <div className="h-44 animate-pulse rounded-2xl bg-line" />
      </div>
    );
  }

  return (
    <div>
      <header className="mb-5 flex items-center gap-2">
        <button
          type="button"
          aria-label="Back"
          onClick={() => {
            haptic('light');
            router.back();
          }}
          className="rounded-full border border-line bg-surface p-2 text-ink-2 active:bg-page"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="font-jost text-[26px] font-semibold leading-tight text-ink">My Profile</h1>
      </header>

      {/* Identity card */}
      <section className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-page ring-1 ring-line">
              {profile.image && !imageFailed ? (
                /* Presigned R2 URL — plain <img> (F4 pattern). */
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.image}
                  alt=""
                  width={72}
                  height={72}
                  onError={() => setImageFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-jost text-xl font-medium text-ink-2">
                  {initialsOf(profile.name)}
                </span>
              )}
            </div>
            {/* Camera badge — photo editing lives on Edit Bio & Photos; #photo
                deep-links to the photo card there (in-shell scroll-to). */}
            <button
              type="button"
              aria-label="Change photo"
              onClick={() => go('/cleaner/profile#photo')}
              className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white ring-2 ring-surface active:opacity-80"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                />
              </svg>
            </button>
          </div>
          <div className="min-w-0">
            <p className="truncate font-jost text-xl font-semibold text-ink">{profile.name}</p>
            {(profile.location || profile.postcode) && (
              <p className="truncate font-jost text-[13px] text-ink-2">
                {profile.location || profile.postcode}
              </p>
            )}
            {profile.verified && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 font-jost text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified
              </span>
            )}
          </div>
        </div>
      </section>

      {/* F26 visibility — the third door, native switch */}
      <section className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-jost text-[15px] font-medium text-ink">
              {profile.visibleInDirectory ? 'Your Profile Is Visible' : 'Your Profile Is Hidden'}
            </p>
            {/* F26.1 (James-ruled): the rescue/cover exclusion is stated, not
                implied — same wording as the web profile page. */}
            <p className="mt-1 font-jost text-[13px] font-light text-ink-2">
              {profile.visibleInDirectory
                ? 'New customers can find and book you in search, the cleaner directory, and quotes.'
                : 'New customers can’t find or book you. Your existing bookings, regular clients, and account are unaffected. You also won’t receive rescue or cover offers while hidden.'}
            </p>
            {visFlash === 'saved' && (
              <p className="mt-1.5 font-jost text-[12px] font-medium text-trust">Saved</p>
            )}
            {visFlash === 'error' && (
              <p className="mt-1.5 font-jost text-[12px] font-medium text-danger">
                Could not save — try again
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={profile.visibleInDirectory}
            aria-label="Profile visibility"
            data-testid="hub-visibility-toggle"
            disabled={visSaving}
            onClick={() => saveVisibility(!profile.visibleInDirectory)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              profile.visibleInDirectory ? 'bg-primary' : 'bg-ink-3/30'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-surface transition-transform ${
                profile.visibleInDirectory ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Doors to the skinned web pages */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="divide-y divide-line/60">
          <button type="button" className={rowCls} onClick={() => go('/cleaner/profile')}>
            Edit Bio &amp; Photos
            {chevron}
          </button>
          <button type="button" className={rowCls} onClick={() => go('/cleaner/pricing')}>
            My Rates
            {chevron}
          </button>
          <button type="button" className={rowCls} onClick={() => go('/cleaner/reviews')}>
            Reviews
            {chevron}
          </button>
        </div>
      </section>
    </div>
  );
}
