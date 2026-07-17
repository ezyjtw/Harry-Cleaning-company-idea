'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';

import WebcamCaptureModal from '@/components/WebcamCaptureModal';
import {
  isBrowserDisplayableImage,
  resizeProfilePhoto,
  UNSUPPORTED_PHOTO_MESSAGE,
} from '@/lib/utils/client-image';
import { normalizeUkPostcode } from '@/lib/validation/inputs';

// Matches the customer wizard's specialty set. Existing stored specialties on
// a profile are left untouched — only the selectable options shown here change.
const specialtyOptions = ['Pet-Friendly', 'Eco-Friendly', 'Elderly-Friendly'];

const languageOptions = [
  'English',
  'Spanish',
  'French',
  'Portuguese',
  'Polish',
  'Romanian',
  'Arabic',
  'Hindi',
  'Mandarin',
  'Tagalog',
  'Italian',
  'German',
];

function capitalise(name: string) {
  return name
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

export default function CleanerProfilePage() {
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [homePostcode, setHomePostcode] = useState('');
  const [maxTravelMinutes, setMaxTravelMinutes] = useState('30');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  const [customLanguages, setCustomLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [showWebcam, setShowWebcam] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaved(false);
    setSaveError('');
  }, []);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => {
        if (res.status === 401) {
          // R3: signOut (not router.push) — clears the stale cookie so /login
          // renders instead of middleware bouncing back to /dashboard.
          signOut({ callbackUrl: '/login' });
          return null;
        }
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setName(data.name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setBio(data.bio || '');
        setYearsExperience(
          data.yearsExperience !== null && data.yearsExperience !== undefined
            ? String(data.yearsExperience)
            : ''
        );
        setSelectedSpecialties(data.specialties || []);
        setHomePostcode(data.homePostcode || data.postcode || '');
        setMaxTravelMinutes(String(data.maxTravelMinutes || 30));
        setPhoto(data.image || null);
        if (data.languages && data.languages.length > 0) {
          setSelectedLanguages(data.languages);
          const custom = data.languages.filter((l: string) => !languageOptions.includes(l));
          setCustomLanguages(custom);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Warn on browser close/refresh with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Intercept sidebar link clicks when dirty
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href === '/cleaner/profile') return;
      if (href.startsWith('/cleaner') || href === '/') {
        // eslint-disable-next-line no-alert
        const ok = window.confirm('You have unsaved changes. Leave without saving?');
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [dirty]);

  const toggleSpecialty = (s: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
    markDirty();
  };

  const toggleLanguage = (l: string) => {
    setSelectedLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
    markDirty();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // F11: same 800px q85 master pipeline as the wizard. F12: the raw-file
      // fallback only applies to formats the browser can display — anything
      // else (HEIC, TIFF…) gets a clear message instead of a dead preview and
      // a save the server will reject.
      resizeProfilePhoto(file)
        .then((d) => setPhoto(d))
        .catch(() => {
          if (!isBrowserDisplayableImage(file.type)) {
            setSaveError(UNSUPPORTED_PHOTO_MESSAGE);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => setPhoto(reader.result as string);
          reader.readAsDataURL(file);
        });
    }
    markDirty();
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/cleaner/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio,
          specialties: selectedSpecialties,
          languages: selectedLanguages,
          homePostcode,
          maxTravelMinutes: Number(maxTravelMinutes),
          // F12: only send the photo when it's a NEW upload (data URL). The
          // GET returns a presigned URL — echoing that back was overwriting
          // the stored R2 key with a URL that expires in 24h.
          ...(photo?.startsWith('data:') ? { image: photo } : {}),
          yearsExperience: yearsExperience ? Number(yearsExperience) : null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setDirty(false);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setSaveError(data?.error || 'Failed to save. Please try again.');
      }
    } catch {
      setSaveError('Network error. Please check your connection and try again.');
    }
    setSaving(false);
  }, [
    bio,
    selectedSpecialties,
    selectedLanguages,
    homePostcode,
    maxTravelMinutes,
    photo,
    yearsExperience,
  ]);

  const isPhotoComplete = !!photo;
  const isPostcodeComplete = !!homePostcode.trim();
  const isBioComplete = !!bio.trim();
  const isSpecialtiesComplete = selectedSpecialties.length > 0;
  const isLanguagesComplete = selectedLanguages.length > 0;

  const incompleteBadge = (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-0.5 font-jost text-[11px] font-medium text-warning"
      style={{ border: '1px solid rgba(217,119,6,0.2)' }}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
        />
      </svg>
      Incomplete
    </span>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-ink/5 rounded-lg w-32" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-ink/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="font-newsreader text-2xl font-semibold text-ink">Edit Profile</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Update your public profile information
        </p>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div
          className="mb-6 flex items-center justify-between rounded-xl bg-warning/10 px-5 py-3"
          style={{ border: '1px solid rgba(217,119,6,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z"
              />
            </svg>
            <span className="font-jost text-sm text-warning">You have unsaved changes</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-[10px] px-4 py-1.5 bg-primary text-white font-jost text-[12px] font-light hover:bg-primary-hover transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save now'}
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div
          className="mb-6 rounded-xl bg-danger/10 px-5 py-3"
          style={{ border: '1px solid rgb(var(--color-danger) / 0.2)' }}
        >
          <p className="font-jost text-sm text-danger">{saveError}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Photo upload */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">
            Profile Photo{!isPhotoComplete && incompleteBadge}
          </h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary-soft border-2 border-dashed border-ink-3/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {photo ? (
                /* F4: plain <img> — `photo` is a presigned R2 URL (or a fresh
                   data-URL preview); next/image rejects both hosts. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg
                  className="w-8 h-8 text-ink-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              )}
            </div>
            <div>
              <div className="flex flex-wrap gap-2">
                <label
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-page text-ink font-jost text-sm font-light cursor-pointer hover:bg-primary-soft transition-colors"
                  style={{ border: '0.5px solid rgb(var(--color-border))' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
                {isDesktop ? (
                  <button
                    type="button"
                    onClick={() => setShowWebcam(true)}
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-page text-ink font-jost text-sm font-light hover:bg-primary-soft transition-colors"
                    style={{ border: '0.5px solid rgb(var(--color-border))' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                    Take Photo
                  </button>
                ) : (
                  <label
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-page text-ink font-jost text-sm font-light cursor-pointer hover:bg-primary-soft transition-colors"
                    style={{ border: '0.5px solid rgb(var(--color-border))' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                    Take Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
                JPG, PNG. Max 5MB. A clear headshot works best.
              </p>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">
            Personal Information{!isPostcodeComplete && incompleteBadge}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Full Name
              </label>
              <p className="mt-1.5 font-jost text-sm text-ink">{capitalise(name) || '—'}</p>
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Email
              </label>
              <p className="mt-1.5 font-jost text-sm text-ink">{email || '—'}</p>
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Phone
              </label>
              <p className="mt-1.5 font-jost text-sm text-ink">{phone || '—'}</p>
            </div>
            <div>
              <label className="block font-jost text-[11px] uppercase tracking-[0.12em] text-ink-3">
                Home postcode
              </label>
              {/* B2: this IS the home postcode (single source — saves to
                  homePostcode and regenerates the travel-time catchment). The
                  old separate "postcode" input here was never sent on save. */}
              <input
                type="text"
                value={homePostcode}
                onChange={(e) => {
                  setHomePostcode(e.target.value);
                  markDirty();
                }}
                onBlur={() => {
                  const norm = normalizeUkPostcode(homePostcode);
                  if (norm && norm !== homePostcode) setHomePostcode(norm);
                }}
                placeholder="e.g. SW1A 1AA"
                className="mt-1.5 w-full rounded-lg bg-page px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition uppercase"
                style={{ border: '1px solid rgb(var(--color-border))' }}
              />
            </div>
          </div>
          <p className="mt-4 font-jost text-[11px] text-ink-3">
            To update your name, email, or phone, please contact support.
          </p>
        </div>

        {/* Bio */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">
            About You{!isBioComplete && incompleteBadge}
          </h2>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              markDirty();
            }}
            placeholder="Tell customers about yourself, your experience, and what makes you a great cleaner..."
            className="w-full rounded-lg px-4 py-3 font-jost font-light text-sm text-ink bg-page focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none transition"
            style={{ border: '1px solid rgb(var(--color-border))' }}
            rows={4}
          />
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            {bio.length}/500 characters
          </p>
        </div>

        {/* Experience */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">Experience</h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-3">
            How many years have you been cleaning professionally?
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={yearsExperience}
              onChange={(e) => {
                setYearsExperience(e.target.value);
                markDirty();
              }}
              min="0"
              max="50"
              placeholder="e.g. 5"
              className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-page focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
              style={{ border: '1px solid rgb(var(--color-border))' }}
            />
            <span className="font-jost text-sm font-light text-ink-2">years</span>
          </div>
        </div>

        {/* Specialties */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">
            Specialties{!isSpecialtiesComplete && incompleteBadge}
          </h2>
          <p className="font-jost text-sm font-light text-ink-2 mb-3">
            Select the cleaning specialties you offer
          </p>
          <div className="flex flex-wrap gap-2">
            {specialtyOptions.map((s) => (
              <button
                key={s}
                onClick={() => toggleSpecialty(s)}
                className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                  selectedSpecialties.includes(s)
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-page text-ink-2 hover:bg-primary-soft'
                }`}
                style={
                  selectedSpecialties.includes(s)
                    ? undefined
                    : { border: '1px solid rgb(var(--color-border))' }
                }
              >
                {selectedSpecialties.includes(s) && (
                  <svg
                    className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Languages */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">
            Languages Spoken{!isLanguagesComplete && incompleteBadge}
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...languageOptions, ...customLanguages].map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                  selectedLanguages.includes(l)
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-page text-ink-2 hover:bg-primary-soft'
                }`}
                style={
                  selectedLanguages.includes(l)
                    ? undefined
                    : { border: '1px solid rgb(var(--color-border))' }
                }
              >
                {l}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <p className="font-jost text-sm font-light text-ink-2 mb-2">
              Don&apos;t see your language?
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customLanguage}
                onChange={(e) => setCustomLanguage(e.target.value)}
                placeholder="e.g. Swahili"
                className="w-48 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-page focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                style={{ border: '1px solid rgb(var(--color-border))' }}
              />
              <button
                type="button"
                onClick={() => {
                  const lang = customLanguage.trim();
                  if (
                    lang &&
                    !selectedLanguages.includes(lang) &&
                    !languageOptions.includes(lang)
                  ) {
                    setCustomLanguages((prev) => [...prev, lang]);
                    setSelectedLanguages((prev) => [...prev, lang]);
                    setCustomLanguage('');
                    markDirty();
                  }
                }}
                disabled={!customLanguage.trim()}
                className="rounded-[10px] px-4 py-2.5 bg-primary text-white font-jost text-sm font-light hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Service Area */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-4">Service Area</h2>

          <div className="mb-5">
            {/* B2: the service area is derived from the home postcode + travel
                time — no second editable postcode here (the old duplicate input
                silently rewrote the home postcode too). */}
            <p className="font-jost text-sm font-light text-ink-2 mb-1">
              Your service area is centred on your home postcode
              {homePostcode ? <span className="font-medium text-ink"> {homePostcode}</span> : null}.
            </p>
            <p className="font-jost text-[12px] text-ink-3">
              To move it, edit your home postcode under Personal Information above.
            </p>
          </div>

          <div>
            <p className="font-jost text-sm font-light text-ink-2 mb-3">
              Maximum travel time to jobs (minutes)
            </p>
            <div className="flex items-center gap-3">
              {/* B (James-ruled): snapped choices — each change regenerates the
                  cleaner's travel-time catchment, so free-typing is out. A
                  legacy non-snapped value stays selectable until changed. */}
              <select
                value={maxTravelMinutes}
                onChange={(e) => {
                  setMaxTravelMinutes(e.target.value);
                  markDirty();
                }}
                className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-page focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
                style={{ border: '1px solid rgb(var(--color-border))' }}
              >
                {![10, 15, 20, 30, 45, 60].includes(Number(maxTravelMinutes)) && (
                  <option value={maxTravelMinutes}>{maxTravelMinutes} (current)</option>
                )}
                {[10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="font-jost text-sm font-light text-ink-2">minutes</span>
            </div>
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
              Only customers within this travel time will see your profile
            </p>
          </div>
        </div>

        {/* Insurance now lives on the dashboard (James-ruled — no duplicate
            upload surface). This is a signpost, not a second uploader. */}
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-newsreader text-xl font-semibold text-ink mb-2">
            Public Liability Insurance
          </h2>
          <p className="font-jost text-sm font-light text-ink-2">
            Manage your insurance — status, expiry and renewal — from your{' '}
            <Link href="/cleaner" className="text-primary underline">
              dashboard
            </Link>
            .
          </p>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="font-jost text-sm font-light text-trust flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Profile saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-[10px] px-8 py-2.5 bg-primary text-white font-jost text-[13px] font-light shadow-sm hover:bg-primary-hover transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      {showWebcam && (
        <WebcamCaptureModal
          onCapture={(dataUrl) => {
            // F11: webcam capture through the same master pipeline.
            resizeProfilePhoto(dataUrl)
              .then((d) => setPhoto(d))
              .catch(() => setPhoto(dataUrl));
            markDirty();
          }}
          onClose={() => setShowWebcam(false)}
          facingMode="user"
        />
      )}
    </div>
  );
}
