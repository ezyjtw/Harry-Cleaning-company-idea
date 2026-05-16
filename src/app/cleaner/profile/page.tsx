'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

const specialtyOptions = [
  'Regular Cleaning',
  'Deep Cleaning',
  'End of Tenancy',
  'AirBnB / Short-Let',
  'Carpet Cleaning',
  'Window Cleaning',
  'Oven Cleaning',
];

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');
  const [bio, setBio] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [travelRadius, setTravelRadius] = useState('10');
  const [travelMode, setTravelMode] = useState('public_transport');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  const [customLanguages, setCustomLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState('');

  const markDirty = useCallback(() => {
    setDirty(true);
    setSaved(false);
    setSaveError('');
  }, []);

  useEffect(() => {
    fetch('/api/cleaner/profile')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
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
        setPostcode(data.postcode || '');
        setBio(data.bio || '');
        setYearsExperience(
          data.yearsExperience !== null && data.yearsExperience !== undefined
            ? String(data.yearsExperience)
            : ''
        );
        setSelectedSpecialties(data.specialties || []);
        setTravelRadius(String(data.radius || 10));
        setTravelMode(data.travelMode || 'public_transport');
        setPhoto(data.image || null);
        if (data.languages && data.languages.length > 0) {
          setSelectedLanguages(data.languages);
          const custom = data.languages.filter((l: string) => !languageOptions.includes(l));
          setCustomLanguages(custom);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

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
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
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
          radius: Number(travelRadius),
          travelMode,
          postcode,
          image: photo,
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
    travelRadius,
    travelMode,
    postcode,
    photo,
    yearsExperience,
  ]);

  const isPhotoComplete = !!photo;
  const isPostcodeComplete = !!postcode.trim();
  const isBioComplete = !!bio.trim();
  const isSpecialtiesComplete = selectedSpecialties.length > 0;
  const isLanguagesComplete = selectedLanguages.length > 0;

  const incompleteBadge = (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-jost text-[11px] font-medium text-amber-700"
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
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-cormorant text-2xl font-light text-ink">Edit Profile</h1>
        <p className="font-jost text-sm font-light text-ink-3 mt-1">
          Update your public profile information
        </p>
      </div>

      {/* Unsaved changes banner */}
      {dirty && (
        <div
          className="mb-6 flex items-center justify-between rounded-xl bg-amber-50 px-5 py-3"
          style={{ border: '1px solid rgba(217,119,6,0.2)' }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-amber-600"
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
            <span className="font-jost text-sm text-amber-800">You have unsaved changes</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full px-4 py-1.5 bg-ink text-cream font-jost text-[12px] font-light hover:bg-ink/90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save now'}
          </button>
        </div>
      )}

      {/* Save error */}
      {saveError && (
        <div
          className="mb-6 rounded-xl bg-red-50 px-5 py-3"
          style={{ border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <p className="font-jost text-sm text-red-700">{saveError}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Photo upload */}
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">
            Profile Photo{!isPhotoComplete && incompleteBadge}
          </h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-cream-2 border-2 border-dashed border-ink-3/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {photo ? (
                <Image
                  src={photo}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
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
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-cream text-ink font-jost text-sm font-light cursor-pointer hover:bg-cream-2 transition-colors"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
                <label
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-cream text-ink font-jost text-sm font-light cursor-pointer hover:bg-cream-2 transition-colors"
                  style={{ border: '0.5px solid rgba(14,14,12,0.1)' }}
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
              </div>
              <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
                JPG, PNG. Max 5MB. A clear headshot works best.
              </p>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">
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
                Postcode
              </label>
              <input
                type="text"
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value);
                  markDirty();
                }}
                placeholder="e.g. SW1A 1AA"
                className="mt-1.5 w-full rounded-lg bg-cream px-4 py-2.5 font-jost text-[14px] font-light text-ink placeholder:text-ink-3/50 focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
            </div>
          </div>
          <p className="mt-4 font-jost text-[11px] text-ink-3">
            To update your name, email, or phone, please contact support.
          </p>
        </div>

        {/* Bio */}
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">
            About You{!isBioComplete && incompleteBadge}
          </h2>
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value);
              markDirty();
            }}
            placeholder="Tell customers about yourself, your experience, and what makes you a great cleaner..."
            className="w-full rounded-lg px-4 py-3 font-jost font-light text-sm text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none transition"
            style={{ border: '1px solid rgba(14,14,12,0.1)' }}
            rows={4}
          />
          <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-1">
            {bio.length}/500 characters
          </p>
        </div>

        {/* Experience */}
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Experience</h2>
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
              className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
              style={{ border: '1px solid rgba(14,14,12,0.1)' }}
            />
            <span className="font-jost text-sm font-light text-ink-2">years</span>
          </div>
        </div>

        {/* Specialties */}
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">
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
                    ? 'bg-ink text-cream shadow-sm'
                    : 'bg-cream text-ink-2 hover:bg-cream-2'
                }`}
                style={
                  selectedSpecialties.includes(s)
                    ? undefined
                    : { border: '1px solid rgba(14,14,12,0.1)' }
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
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">
            Languages Spoken{!isLanguagesComplete && incompleteBadge}
          </h2>
          <div className="flex flex-wrap gap-2">
            {[...languageOptions, ...customLanguages].map((l) => (
              <button
                key={l}
                onClick={() => toggleLanguage(l)}
                className={`rounded-full px-4 py-2 font-jost text-[13px] font-light transition ${
                  selectedLanguages.includes(l)
                    ? 'bg-ink text-cream shadow-sm'
                    : 'bg-cream text-ink-2 hover:bg-cream-2'
                }`}
                style={
                  selectedLanguages.includes(l)
                    ? undefined
                    : { border: '1px solid rgba(14,14,12,0.1)' }
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
                className="w-48 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
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
                className="rounded-lg px-4 py-2.5 bg-ink text-cream font-jost text-sm font-light hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Travel & Location */}
        <div
          className="rounded-xl bg-white p-6"
          style={{ border: '1px solid rgba(14,14,12,0.06)' }}
        >
          <h2 className="font-cormorant text-lg font-light text-ink mb-4">Travel & Location</h2>

          <div className="mb-5">
            <p className="font-jost text-sm font-light text-ink-2 mb-3">
              How far from your postcode are you willing to travel?
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={travelRadius}
                onChange={(e) => {
                  setTravelRadius(e.target.value);
                  markDirty();
                }}
                min="1"
                max="50"
                placeholder="e.g. 10"
                className="w-32 rounded-lg px-4 py-2.5 font-jost font-light text-sm text-ink bg-cream focus:outline-none focus:ring-2 focus:ring-gold/30 transition"
                style={{ border: '1px solid rgba(14,14,12,0.1)' }}
              />
              <span className="font-jost text-sm font-light text-ink-2">miles</span>
            </div>
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
              Customers within this radius will be able to find you
            </p>
          </div>

          <div>
            <p className="font-jost text-sm font-light text-ink-2 mb-3">
              How do you travel to jobs?
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                {
                  value: 'car',
                  label: 'Car',
                  icon: 'M8 17h1m7 0h1M5 11h14M6 3h12l2 5H4l2-5zM4 8v8a1 1 0 001 1h14a1 1 0 001-1V8',
                },
                {
                  value: 'public_transport',
                  label: 'Public Transport',
                  icon: 'M8 21l-2-3h12l-2 3M12 3C7 3 4 5 4 8v6a2 2 0 002 2h12a2 2 0 002-2V8c0-3-3-5-8-5zM8 14h.01M16 14h.01M7 11h10',
                },
                {
                  value: 'bicycle',
                  label: 'Bicycle',
                  icon: 'M5 19a4 4 0 100-8 4 4 0 000 8zm14 0a4 4 0 100-8 4 4 0 000 8zM5 15l4-8h4l2 4h4',
                },
                {
                  value: 'walking',
                  label: 'Walking',
                  icon: 'M13 4a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-2 3l-2 8 3 3v4h2v-5l-2-2 1-4 2 2h4v-2h-3l-3-3z',
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => {
                    setTravelMode(mode.value);
                    markDirty();
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-jost text-[13px] font-light transition-all ${
                    travelMode === mode.value
                      ? 'bg-ink text-cream shadow-sm'
                      : 'bg-cream text-ink-2 hover:bg-cream-2'
                  }`}
                  style={
                    travelMode !== mode.value
                      ? { border: '1px solid rgba(14,14,12,0.1)' }
                      : undefined
                  }
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d={mode.icon}
                    />
                  </svg>
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="font-jost text-[11px] uppercase tracking-[0.1em] text-ink-3 mt-2">
              Helps us estimate realistic travel time to jobs
            </p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="font-jost text-sm font-light text-green-600 flex items-center gap-1">
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
            className="rounded-full px-8 py-2.5 bg-ink text-cream font-jost text-[13px] font-light shadow-sm hover:bg-ink/90 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
